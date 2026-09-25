// Création d'une commande (POST /api/orders). Prix, remise et livraison sont recalculés
// par le serveur ; une même clé d'idempotence ne crée jamais deux commandes.
import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { orders } from '../../db/schema';
import { quote } from '../../lib/checkout';
import { db } from '../../lib/db';
import type { Order } from '../../lib/integrations';
import { notifyOrderPlaced } from '../../lib/notifications';
import { findOrderByIdempotencyKey, PromoLimitError, pushOrderToErp, saveOrder } from '../../lib/orders';
import { ONLINE_METHODS, PaymentError, startPayment } from '../../lib/payments/service';
import { enabledPaymentMethods, getSettings } from '../../lib/settings';
import { isSameOrigin, json, newId, rateLimit } from '../../lib/server';
import { clean, isValidEmail, isValidPhone } from '../../lib/validation';

function confirmationUrl(number: string, token: string) {
  return `/commande/confirmation?n=${encodeURIComponent(number)}&t=${token}`;
}

export const POST: APIRoute = async ({ request, clientAddress, locals }) => {
  if (!isSameOrigin(request)) return json({ error: 'Origine non autorisée.' }, 403);
  if (!(await rateLimit(`orders:${clientAddress}`, 5))) {
    return json({ error: 'Trop de tentatives. Réessayez dans une minute.' }, 429);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Requête invalide.' }, 400);
  }

  // Un double clic ou un rechargement renvoie la même commande au lieu d'en créer une seconde.
  const idemKey = clean(body.idempotencyKey, 80);
  if (!idemKey) return json({ error: 'Clé de commande manquante.' }, 400);
  const previous = await findOrderByIdempotencyKey(idemKey);
  if (previous) return json({ ok: true, order: previous.order, confirmationUrl: confirmationUrl(previous.order.number, previous.accessToken) }, 200);

  const customer = {
    name: clean(body.customer?.name, 120),
    phone: clean(body.customer?.phone, 30),
    email: clean(body.customer?.email, 160),
    city: clean(body.customer?.city, 120),
    address: clean(body.customer?.address, 300),
  };
  const settings = await getSettings();
  const payment = enabledPaymentMethods(settings).find((p) => p.id === body.paymentMethod);
  const q = await quote({ items: body.items, zoneId: body.deliveryZone, promoCode: body.promoCode, user: locals.user });

  const errors: Record<string, string> = {};
  if (customer.name.length < 2) errors.name = 'Indiquez votre nom complet.';
  if (!isValidPhone(customer.phone)) errors.phone = 'Numéro de téléphone invalide.';
  if (!isValidEmail(customer.email)) errors.email = 'Adresse e-mail invalide.';
  if (!q.zone) errors.deliveryZone = 'Choisissez un mode de livraison.';
  if (q.zone && q.zone.id !== 'retrait' && customer.address.length < 4) errors.address = 'Indiquez une adresse ou un point de repère.';
  if (!payment) errors.paymentMethod = 'Choisissez un moyen de paiement.';
  // Le client doit revoir son panier si un article a changé : on ne facture jamais autre chose que ce qu'il a vu.
  if (q.invalid || q.problems.length) errors.items = q.problems[0] ?? 'Un article du panier est invalide. Actualisez votre panier.';
  else if (!q.lines.length) errors.items = 'Votre panier est vide.';
  if (q.promo && !q.promo.applied) errors.promoCode = q.promo.message;
  if (Object.keys(errors).length) return json({ error: 'Certains champs sont à corriger.', errors }, 422);

  const draft: Order = {
    number: newId('AFS'),
    status: payment!.id === 'livraison' ? 'confirmee' : 'en-attente-paiement',
    customer,
    lines: q.lines.map(({ sku, productId, variantId, name, unitPrice, quantity }) => ({ sku, productId, variantId, name, unitPrice, quantity })),
    deliveryZone: q.zone!.id,
    paymentMethod: payment!.id,
    totals: q.totals,
    createdAt: new Date().toISOString(),
  };

  let saved;
  try {
    saved = await saveOrder(draft, idemKey, locals.user?.id ?? null, q.promo?.applied ? q.promo.code : null);
  } catch (err) {
    if (err instanceof PromoLimitError) {
      return json({ error: 'Ce code promo vient d’atteindre sa limite d’utilisation. Retirez-le pour continuer.', errors: { promoCode: 'Code épuisé.' } }, 409);
    }
    console.error(err);
    return json({ error: "La commande n'a pas pu être enregistrée. Aucun paiement n'a été effectué." }, 500);
  }
  const { order, accessToken, created } = saved;
  const response = { ok: true, order, confirmationUrl: confirmationUrl(order.number, accessToken) };
  if (!created) return json(response, 200);

  // La commande est enregistrée : un échec de l'ERP, des notifications ou du prestataire ne la bloque pas.
  const [row] = await db.select().from(orders).where(eq(orders.number, order.number)).limit(1);
  await notifyOrderPlaced(order, accessToken).catch(console.error);
  if (order.status === 'confirmee') await pushOrderToErp(row);

  let paymentUrl: string | undefined;
  if (order.status === 'en-attente-paiement' && ONLINE_METHODS.includes(order.paymentMethod)) {
    try {
      paymentUrl = await startPayment(row);
    } catch (err) {
      if (!(err instanceof PaymentError)) console.error(err);
      // La page de confirmation propose de relancer le paiement.
    }
  }
  return json({ ...response, paymentUrl }, 201);
};
