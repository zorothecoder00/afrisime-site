// Panier sauvegardé d'un client connecté (cahier des charges §8).
// Seuls produit, variante et quantité sont stockés : nom, prix et libellé sont
// toujours relus dans le catalogue, pour ne jamais afficher un prix périmé.
import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { carts } from '../../db/schema';
import { quote } from '../../lib/checkout';
import { db } from '../../lib/db';
import { isSameOrigin, json } from '../../lib/server';

/** Garde les lignes valides, fusionne les doublons et complète avec les données du catalogue. */
async function resolve(raw: unknown, user: App.Locals['user']) {
  const { lines } = await quote({ items: raw, user });
  const items = lines.map((l) => ({
    productId: l.productId,
    variantId: l.variantId,
    name: l.productName,
    variantLabel: l.variantLabel,
    price: l.unitPrice,
    quantity: l.quantity,
    slug: l.slug,
    color: l.color,
    image: l.image,
  }));
  const saved = lines.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity }));
  return { saved, items };
}

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) return json({ error: 'Non connecté.' }, 401);
  const [row] = await db.select().from(carts).where(eq(carts.userId, locals.user.id));
  const { items } = await resolve(row?.items ?? [], locals.user);
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
  const { saved, items } = await resolve(body.items, locals.user);
  await db
    .insert(carts)
    .values({ userId: locals.user.id, items: saved })
    .onConflictDoUpdate({ target: carts.userId, set: { items: saved, updatedAt: new Date() } });
  return json({ items });
};
