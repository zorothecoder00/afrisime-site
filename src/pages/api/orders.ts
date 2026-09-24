import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { DELIVERY_ZONES, PAYMENT_METHODS } from '../../data/site';
import { notifyCustomer, sendOrderToErp, type Order, type OrderLine } from '../../lib/integrations';
import { computeTotals } from '../../lib/pricing';
import { getIdempotent, isSameOrigin, json, newId, rateLimit, setIdempotent } from '../../lib/server';
import { clean, isValidEmail, isValidPhone } from '../../lib/validation';

export const prerender = false;

const MAX_QTY = 999;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!isSameOrigin(request)) return json({ error: 'Origine non autorisée.' }, 403);
  if (!rateLimit(`orders:${clientAddress}`, 5)) {
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
  const previous = getIdempotent(idemKey);
  if (previous) return json(previous, 200);

  const customer = {
    name: clean(body.customer?.name, 120),
    phone: clean(body.customer?.phone, 30),
    email: clean(body.customer?.email, 160),
    city: clean(body.customer?.city, 120),
    address: clean(body.customer?.address, 300),
  };
  const errors: Record<string, string> = {};
  if (customer.name.length < 2) errors.name = 'Indiquez votre nom complet.';
  if (!isValidPhone(customer.phone)) errors.phone = 'Numéro de téléphone invalide.';
  if (!isValidEmail(customer.email)) errors.email = 'Adresse e-mail invalide.';
  const zone = DELIVERY_ZONES.find((z) => z.id === body.deliveryZone);
  if (!zone) errors.deliveryZone = 'Choisissez un mode de livraison.';
  if (zone && zone.id !== 'retrait' && customer.address.length < 4) errors.address = 'Indiquez une adresse ou un point de repère.';
  const payment = PAYMENT_METHODS.find((p) => p.id === body.paymentMethod);
  if (!payment) errors.paymentMethod = 'Choisissez un moyen de paiement.';

  // Les prix envoyés par le navigateur sont ignorés : on repart du catalogue.
  const products = await getCollection('products');
  const lines: OrderLine[] = [];
  for (const item of Array.isArray(body.items) ? body.items.slice(0, 100) : []) {
    const product = products.find((p) => p.id === item?.productId);
    const variant = product?.data.variants.find((v) => v.id === item?.variantId);
    const quantity = Math.floor(Number(item?.quantity));
    if (!product || !variant || !(quantity >= 1 && quantity <= MAX_QTY)) {
      errors.items = 'Un article du panier est invalide. Actualisez votre panier.';
      break;
    }
    if (product.data.status === 'indisponible' || product.data.status === 'devis') {
      errors.items = `« ${product.data.name} » ne peut pas être commandé en ligne pour le moment.`;
      break;
    }
    lines.push({
      sku: `${product.data.sku}-${variant.id}`,
      productId: product.id,
      variantId: variant.id,
      name: `${product.data.name} – ${variant.label}`,
      unitPrice: variant.price,
      quantity,
    });
  }
  if (!lines.length && !errors.items) errors.items = 'Votre panier est vide.';
  if (Object.keys(errors).length) return json({ error: 'Certains champs sont à corriger.', errors }, 422);

  const order: Order = {
    number: newId('AFS'),
    status: payment!.id === 'livraison' ? 'confirmee' : 'en-attente-paiement',
    customer,
    lines,
    deliveryZone: zone!.id,
    paymentMethod: payment!.id,
    totals: computeTotals(lines, zone!.id, clean(body.promoCode, 40)),
    createdAt: new Date().toISOString(),
  };

  try {
    await sendOrderToErp(order);
    await notifyCustomer(order);
  } catch (err) {
    console.error(err);
    return json({ error: "La commande n'a pas pu être enregistrée. Aucun paiement n'a été effectué." }, 502);
  }

  // En production : rediriger vers la page du prestataire de paiement si
  // status === 'en-attente-paiement', puis confirmer via son webhook.
  const response = { ok: true, order };
  setIdempotent(idemKey, response);
  return json(response, 201);
};
