// Devis d'un panier (POST /api/checkout/quote) : lignes aux prix du catalogue, remise,
// frais de livraison et total, calculés par le serveur. Le panier et la page de commande
// l'utilisent pour afficher des montants identiques à ceux qui seront facturés.
import type { APIRoute } from 'astro';
import { quote } from '../../../lib/checkout';
import { isSameOrigin, json, rateLimit } from '../../../lib/server';

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  if (!isSameOrigin(request)) return json({ error: 'Origine non autorisée.' }, 403);
  if (!(await rateLimit(`quote:${clientAddress}`, 60))) return json({ error: 'Trop de requêtes.' }, 429);
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Requête invalide.' }, 400);
  }
  const result = await quote({ items: body.items, zoneId: body.zoneId, promoCode: body.promoCode, user: locals.user });
  return json({
    lines: result.lines,
    problems: result.problems,
    totals: result.totals,
    promo: result.promo,
    pro: result.pro,
    freeThreshold: result.freeThreshold,
  });
};
