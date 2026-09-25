// Cycle de paiement d'une commande : création de la transaction chez le prestataire,
// vérification de son état (retour du client, webhook, tâche planifiée) et confirmation.
// L'état n'est jamais déduit des paramètres renvoyés au navigateur : il est toujours
// relu chez le prestataire. Une commande n'est confirmée qu'une seule fois.
import { BETTER_AUTH_URL } from 'astro:env/server';
import { and, desc, eq, lt } from 'drizzle-orm';
import { orders, payments } from '../../db/schema';
import { audit } from '../audit';
import { db } from '../db';
import { afterStatusChange, setOrderStatus } from '../orders';
import { getPaymentProvider, providerById, type PaymentState } from './providers';

type OrderRow = typeof orders.$inferSelect;
type PaymentRow = typeof payments.$inferSelect;

export const ONLINE_METHODS = ['mobile-money', 'carte'];

export class PaymentError extends Error {}

export function onlinePaymentAvailable() {
  return !!getPaymentProvider();
}

function returnUrl(order: OrderRow, paymentId: string) {
  const base = BETTER_AUTH_URL.replace(/\/$/, '');
  return `${base}/commande/paiement?n=${encodeURIComponent(order.number)}&t=${order.accessToken}&p=${paymentId}`;
}

/** Démarre (ou redémarre après un échec) le paiement en ligne d'une commande. */
export async function startPayment(order: OrderRow) {
  if (order.status !== 'en-attente-paiement') throw new PaymentError('Cette commande n’attend pas de paiement.');
  const provider = getPaymentProvider();
  if (!provider) throw new PaymentError('Le paiement en ligne est momentanément indisponible. Un conseiller va vous contacter.');

  // Un paiement déjà en cours chez le prestataire est d'abord vérifié : s'il a abouti, pas de second paiement.
  const [pending] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.orderId, order.id), eq(payments.status, 'en-attente')))
    .orderBy(desc(payments.createdAt))
    .limit(1);
  if (pending) {
    const state = await refreshPayment(pending);
    if (state === 'reussi') throw new PaymentError('Cette commande est déjà payée.');
    if (state === 'en-attente' && pending.redirectUrl && pending.provider === provider.id) return pending.redirectUrl;
  }

  const paymentId = crypto.randomUUID();
  await db.insert(payments).values({ id: paymentId, orderId: order.id, provider: provider.id, amount: order.total });
  try {
    const checkout = await provider.createCheckout({
      paymentId,
      orderNumber: order.number,
      amount: order.total,
      method: order.paymentMethod,
      returnUrl: returnUrl(order, paymentId),
      customer: { name: order.customer.name, email: order.customer.email, phone: order.customer.phone },
    });
    await db
      .update(payments)
      .set({ providerRef: checkout.providerRef, redirectUrl: checkout.redirectUrl, raw: checkout.raw ?? null })
      .where(eq(payments.id, paymentId));
    return checkout.redirectUrl;
  } catch (err) {
    console.error('[paiement]', err);
    await db.update(payments).set({ status: 'echoue', raw: { error: String((err as Error).message).slice(0, 300) } }).where(eq(payments.id, paymentId));
    throw new PaymentError('Le prestataire de paiement ne répond pas. Réessayez dans quelques instants.');
  }
}

/** Relit l'état chez le prestataire et confirme la commande si le paiement a abouti. */
export async function refreshPayment(payment: PaymentRow): Promise<PaymentState> {
  if (payment.status !== 'en-attente') return payment.status;
  const provider = providerById(payment.provider);
  if (!provider || !payment.providerRef) return payment.status;

  let result;
  try {
    result = await provider.fetchStatus(payment);
  } catch (err) {
    console.error('[paiement]', err);
    return 'en-attente';
  }
  if (result.state === 'en-attente') return 'en-attente';

  // Mise à jour conditionnelle : un seul appel (retour client ou webhook) traite le changement.
  const updated = await db
    .update(payments)
    .set({ status: result.state, raw: { ...(payment.raw ?? {}), ...(result.raw ?? {}) } })
    .where(and(eq(payments.id, payment.id), eq(payments.status, 'en-attente')))
    .returning({ id: payments.id });
  if (!updated.length) {
    const [current] = await db.select({ status: payments.status }).from(payments).where(eq(payments.id, payment.id));
    return current?.status ?? result.state;
  }

  if (result.state === 'reussi') await confirmPaidOrder(payment);
  return result.state;
}

async function confirmPaidOrder(payment: PaymentRow) {
  const [order] = await db.select().from(orders).where(eq(orders.id, payment.orderId)).limit(1);
  if (!order) return;
  const confirmed = await setOrderStatus(order.id, 'confirmee', {
    source: 'paiement',
    from: 'en-attente-paiement',
    paidAt: new Date(),
    note: `Paiement reçu (${payment.provider} ${payment.providerRef ?? ''})`.trim(),
  });
  if (confirmed) {
    await afterStatusChange(order.number);
  } else {
    // Payée alors qu'elle avait été annulée entre-temps : à rembourser par l'équipe.
    await audit({ action: 'paiement-commande-non-en-attente', target: order.number, details: { status: order.status, payment: payment.id } });
  }
}

export async function findPayment(id: string) {
  const [row] = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
  return row;
}

export async function findPaymentByRef(provider: string, providerRef: string) {
  const [row] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.provider, provider), eq(payments.providerRef, providerRef)))
    .limit(1);
  return row;
}

export function listPaymentsForOrder(orderId: string) {
  return db.select().from(payments).where(eq(payments.orderId, orderId)).orderBy(desc(payments.createdAt));
}

/** Paiements restés en attente (webhook perdu) : revérifiés par la tâche planifiée. */
export async function refreshStalePayments(olderThanMinutes = 10) {
  const rows = await db
    .select()
    .from(payments)
    .where(and(eq(payments.status, 'en-attente'), lt(payments.createdAt, new Date(Date.now() - olderThanMinutes * 60_000))))
    .limit(50);
  let confirmed = 0;
  for (const row of rows) if ((await refreshPayment(row)) === 'reussi') confirmed++;
  return { checked: rows.length, confirmed };
}
