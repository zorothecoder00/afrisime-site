// Panier sauvegardé d'un client connecté (cahier des charges §8).
// Seuls produit, variante et quantité sont stockés : nom, prix et libellé sont
// toujours relus dans le catalogue, pour ne jamais afficher un prix périmé.
import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { carts, type SavedCartItem } from '../../db/schema';
import { canBuyOnline, getCatalog } from '../../lib/catalog';
import { db } from '../../lib/db';
import { isSameOrigin, json } from '../../lib/server';

export const prerender = false;

const MAX_LINES = 100;
const MAX_QTY = 999;

/** Garde les lignes valides, fusionne les doublons et complète avec les données du catalogue. */
async function resolve(raw: unknown) {
  const { products, categoryOf } = await getCatalog();
  const byId = new Map(products.map((p) => [p.id, p]));
  const saved = new Map<string, SavedCartItem>();
  const items = [];

  for (const entry of Array.isArray(raw) ? raw.slice(0, MAX_LINES) : []) {
    const product = byId.get(String(entry?.productId));
    const variant = product?.data.variants.find((v) => v.id === String(entry?.variantId));
    const quantity = Math.min(Math.floor(Number(entry?.quantity)), MAX_QTY);
    if (!product || !variant || !(quantity >= 1) || !canBuyOnline(product)) continue;
    const key = `${product.id}:${variant.id}`;
    if (saved.has(key)) continue;
    saved.set(key, { productId: product.id, variantId: variant.id, quantity });
    items.push({
      productId: product.id,
      variantId: variant.id,
      name: product.data.name,
      variantLabel: variant.label,
      price: variant.price,
      quantity,
      slug: product.id,
      color: categoryOf(product).data.color,
    });
  }
  return { saved: [...saved.values()], items };
}

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) return json({ error: 'Non connecté.' }, 401);
  const [row] = await db.select().from(carts).where(eq(carts.userId, locals.user.id));
  const { items } = await resolve(row?.items ?? []);
  return json({ items });
};

export const PUT: APIRoute = async ({ request, locals }) => {
  if (!isSameOrigin(request)) return json({ error: 'Origine non autorisée.' }, 403);
  if (!locals.user) return json({ error: 'Non connecté.' }, 401);
  let body: { items?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Requête invalide.' }, 400);
  }
  const { saved, items } = await resolve(body.items);
  await db
    .insert(carts)
    .values({ userId: locals.user.id, items: saved })
    .onConflictDoUpdate({ target: carts.userId, set: { items: saved, updatedAt: new Date() } });
  return json({ items });
};
