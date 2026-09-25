// Enregistrement et lecture des commandes en base.
import { and, asc, count, desc, eq, ilike, inArray, isNull, notInArray, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { timingSafeEqual } from 'node:crypto';
import { orderEvents, orderLines, orders, user } from '../db/schema';
import { db } from './db';
import { sendOrderToErp, type Order } from './integrations';
import { notifyOrderStatus } from './notifications';
import { consumePromo } from './promotions';

type OrderRow = typeof orders.$inferSelect;
type LineRow = typeof orderLines.$inferSelect;
export type OrderStatus = OrderRow['status'];
export type OrderEventSource = 'site' | 'back-office' | 'erp' | 'paiement' | 'client';

export class PromoLimitError extends Error {}

export function toOrder(row: OrderRow, lines: LineRow[]): Order {
  return {
    number: row.number,
    status: row.status,
    customer: row.customer,
    lines: lines.map(({ sku, productId, variantId, name, unitPrice, quantity }) => ({ sku, productId, variantId, name, unitPrice, quantity })),
    deliveryZone: row.deliveryZone,
    paymentMethod: row.paymentMethod,
    totals: { subtotal: row.subtotal, discount: row.discount, delivery: row.delivery, total: row.total },
    createdAt: row.createdAt.toISOString(),
    paidAt: row.paidAt?.toISOString() ?? null,
  };
}

async function withLines(rows: OrderRow[]): Promise<Order[]> {
  if (!rows.length) return [];
  const lines = await db
    .select()
    .from(orderLines)
    .where(inArray(orderLines.orderId, rows.map((r) => r.id)))
    .orderBy(asc(orderLines.id));
  return rows.map((row) => toOrder(row, lines.filter((l) => l.orderId === row.id)));
}

export async function findOrderByIdempotencyKey(key: string) {
  const rows = await db.select().from(orders).where(eq(orders.idempotencyKey, key)).limit(1);
  if (!rows[0]) return undefined;
  return { order: (await withLines(rows))[0], accessToken: rows[0].accessToken };
}

export function newAccessToken() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('base64url');
}

/**
 * Enregistre la commande. Si la même clé d'idempotence a déjà été utilisée
 * (double clic, requêtes simultanées), renvoie la commande existante sans en créer une autre.
 * Lève PromoLimitError si le code promo a atteint sa limite entre-temps.
 */
export async function saveOrder(order: Order, idempotencyKey: string, userId: string | null, promoCode: string | null) {
  const accessToken = newAccessToken();
  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(orders)
      .values({
        id: crypto.randomUUID(),
        number: order.number,
        idempotencyKey,
        accessToken,
        userId,
        status: order.status,
        customer: order.customer,
        deliveryZone: order.deliveryZone,
        paymentMethod: order.paymentMethod,
        promoCode,
        ...order.totals,
        createdAt: new Date(order.createdAt),
      })
      .onConflictDoNothing({ target: orders.idempotencyKey })
      .returning({ id: orders.id });
    if (!row) return false;
    if (promoCode && !(await consumePromo(tx, promoCode))) throw new PromoLimitError();
    await tx.insert(orderLines).values(order.lines.map((line) => ({ ...line, orderId: row.id })));
    await tx.insert(orderEvents).values({ orderId: row.id, status: order.status, source: 'site', note: 'Commande passée sur le site' });
    return true;
  });
  if (created) return { order, accessToken, created };
  const existing = (await findOrderByIdempotencyKey(idempotencyKey))!;
  return { ...existing, created };
}

export async function markOrderSynced(number: string) {
  await db.update(orders).set({ erpSyncedAt: new Date() }).where(eq(orders.number, number));
}

/**
 * Transmet à l'ERP une commande confirmée (payée ou payable à la livraison).
 * Une commande en attente de paiement n'est pas transmise : l'ERP ne prépare que ce qui est dû.
 */
export async function pushOrderToErp(row: OrderRow) {
  if (row.status === 'en-attente-paiement' || row.status === 'annulee' || row.erpSyncedAt) return false;
  const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, row.id)).orderBy(asc(orderLines.id));
  try {
    if (await sendOrderToErp(toOrder(row, lines))) {
      await markOrderSynced(row.number);
      return true;
    }
  } catch (err) {
    console.error(err);
  }
  return false;
}

export async function listOrdersForUser(userId: string, limit = 50) {
  const rows = await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt)).limit(limit);
  const list = await withLines(rows);
  return list.map((order, i) => ({ ...order, id: rows[i].id, accessToken: rows[i].accessToken }));
}

/** Étapes possibles depuis chaque statut (back-office). Livrée et annulée sont définitives. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  'en-attente-paiement': ['confirmee', 'annulee'],
  confirmee: ['en-preparation', 'annulee'],
  'en-preparation': ['expediee', 'annulee'],
  expediee: ['livree'],
  livree: [],
  annulee: [],
};

/** Le client peut annuler lui-même tant que la préparation n'a pas commencé (CGV). */
export const CUSTOMER_CANCELLABLE: OrderStatus[] = ['en-attente-paiement', 'confirmee'];

const actor = alias(user, 'actor');

/** Commande complète : lignes et historique (avec l'auteur de chaque changement). */
export async function getOrderDetail(number: string) {
  const [row] = await db.select().from(orders).where(eq(orders.number, number)).limit(1);
  if (!row) return undefined;
  const [lines, events] = await Promise.all([
    db.select().from(orderLines).where(eq(orderLines.orderId, row.id)).orderBy(asc(orderLines.id)),
    db
      .select({ event: orderEvents, actorName: actor.name })
      .from(orderEvents)
      .leftJoin(actor, eq(actor.id, orderEvents.actorId))
      .where(eq(orderEvents.orderId, row.id))
      .orderBy(desc(orderEvents.createdAt), desc(orderEvents.id)),
  ]);
  return { row, lines, events };
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrderDetail>>>;

function sameSecret(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Accès sans compte par le lien secret envoyé au client (page de confirmation, paiement). */
export async function findOrderByToken(number: string, token: string) {
  if (!number || !token) return undefined;
  const detail = await getOrderDetail(number.trim().toUpperCase());
  return detail && sameSecret(detail.row.accessToken, token) ? detail : undefined;
}

/**
 * Change le statut et l'enregistre dans l'historique. Avec `from`, le changement n'a lieu
 * que si la commande est toujours dans ce statut (deux personnes ne s'écrasent pas) :
 * renvoie `false` si elle a été modifiée entre-temps.
 */
export async function setOrderStatus(
  orderId: string,
  status: OrderStatus,
  meta: { source: OrderEventSource; actorId?: string | null; note?: string | null; from?: OrderStatus; paidAt?: Date },
) {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(orders)
      .set({ status, ...(meta.paidAt ? { paidAt: meta.paidAt } : {}) })
      .where(meta.from ? and(eq(orders.id, orderId), eq(orders.status, meta.from)) : eq(orders.id, orderId))
      .returning({ id: orders.id });
    if (!updated.length) return false;
    await tx.insert(orderEvents).values({ orderId, status, source: meta.source, actorId: meta.actorId ?? null, note: meta.note || null });
    return true;
  });
}

/** Suite d'un changement de statut : notification du client et transmission à l'ERP si besoin. */
export async function afterStatusChange(number: string) {
  const [row] = await db.select().from(orders).where(eq(orders.number, number)).limit(1);
  if (!row) return;
  await notifyOrderStatus({ number, phone: row.customer.phone, email: row.customer.email, status: row.status, accessToken: row.accessToken }).catch(console.error);
  if (row.status === 'confirmee') await pushOrderToErp(row);
}

/** 8 derniers chiffres : « +228 90 11 22 33 » et « 90112233 » désignent le même numéro. */
function phoneKey(phone: string) {
  return phone.replace(/\D/g, '').slice(-8);
}

/**
 * Suivi pour un visiteur sans compte : il faut le numéro de commande ET le téléphone utilisé,
 * pour qu'un numéro de commande seul ne suffise pas à voir la commande d'un autre.
 */
export async function findOrderForTracking(number: string, phone: string) {
  const detail = await getOrderDetail(number.trim().toUpperCase());
  if (!detail || phoneKey(detail.row.customer.phone) !== phoneKey(phone) || phoneKey(phone).length < 8) return undefined;
  return detail;
}

/** Liste filtrée pour le back-office (statut, commandes non transmises à l'ERP, recherche). */
export async function listOrders(filters: { status?: string; erpPending?: boolean; q?: string; limit?: number; offset?: number }) {
  const where: SQL[] = [];
  if (filters.status) where.push(eq(orders.status, filters.status as OrderStatus));
  if (filters.erpPending) where.push(isNull(orders.erpSyncedAt), notInArray(orders.status, ['en-attente-paiement', 'annulee']));
  if (filters.q) {
    const term = `%${filters.q.replace(/[%_\\]/g, '\\$&')}%`;
    where.push(
      or(
        ilike(orders.number, term),
        ilike(sql`${orders.customer}->>'name'`, term),
        ilike(sql`${orders.customer}->>'phone'`, term),
        ilike(sql`${orders.customer}->>'email'`, term),
      )!,
    );
  }
  const condition = where.length ? and(...where) : undefined;
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(orders).where(condition).orderBy(desc(orders.createdAt)).limit(filters.limit ?? 25).offset(filters.offset ?? 0),
    db.select({ total: count() }).from(orders).where(condition),
  ]);
  return { rows, total };
}
