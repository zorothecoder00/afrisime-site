// Prix réservés du visiteur connecté pour les produits demandés (GET /api/pro-prices?ids=a,b) :
// prix professionnels (compte pro validé) et types de prix réservés aux clients connectés
// ou aux comptes pro (Catalogue › Types de prix). Les pages produit sont identiques pour
// tous (cache CDN) : ces prix sont chargés à part.
import type { APIRoute } from 'astro';
import { getCatalog, unitPriceFor } from '../../lib/catalog';
import { isValidatedPro } from '../../lib/checkout';
import { canUsePriceType, listPriceTypes, typedPrice } from '../../lib/price-types';
import { json } from '../../lib/server';

export const GET: APIRoute = async ({ url, locals }) => {
  if (!locals.user) return json({ pro: false, prices: {}, types: {} });
  const pro = isValidatedPro(locals.user);
  const ids = new Set((url.searchParams.get('ids') ?? '').split(',').slice(0, 50));
  const [{ products }, allTypes] = await Promise.all([getCatalog(), listPriceTypes()]);
  // Les types ouverts à tous sont déjà dans la page.
  const types = allTypes.filter((t) => t.audience !== 'tous' && canUsePriceType(t, { loggedIn: true, pro }));
  const prices: Record<string, Record<string, number>> = {};
  const typed: Record<string, Record<string, { label: string; price: number; description: string }[]>> = {};
  for (const p of products) {
    if (!ids.has(p.id)) continue;
    if (pro) prices[p.id] = Object.fromEntries(p.data.variants.filter((v) => unitPriceFor(v, true) < v.price).map((v) => [v.id, unitPriceFor(v, true)]));
    typed[p.id] = Object.fromEntries(
      p.data.variants.map((v) => [v.id, types.flatMap((t) => (typedPrice(v, t.id) ? [{ label: t.label, price: typedPrice(v, t.id)!, description: t.description }] : []))]),
    );
  }
  return json({ pro, prices, types: typed });
};
