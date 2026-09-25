// Prix professionnels des produits demandés, pour un compte pro validé (GET /api/pro-prices?ids=a,b).
// Les pages produit sont identiques pour tous (cache CDN) : ce prix est chargé à part.
import type { APIRoute } from 'astro';
import { getCatalog, unitPriceFor } from '../../lib/catalog';
import { isValidatedPro } from '../../lib/checkout';
import { json } from '../../lib/server';

export const GET: APIRoute = async ({ url, locals }) => {
  if (!isValidatedPro(locals.user)) return json({ pro: false, prices: {} });
  const ids = new Set((url.searchParams.get('ids') ?? '').split(',').slice(0, 50));
  const { products } = await getCatalog();
  const prices: Record<string, Record<string, number>> = {};
  for (const p of products) {
    if (!ids.has(p.id)) continue;
    prices[p.id] = Object.fromEntries(p.data.variants.filter((v) => unitPriceFor(v, true) < v.price).map((v) => [v.id, unitPriceFor(v, true)]));
  }
  return json({ pro: true, prices });
};
