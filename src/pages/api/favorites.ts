// Favoris du client connecté : GET (liste des identifiants), POST / DELETE { productId }.
import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { favorites, products } from '../../db/schema';
import { db } from '../../lib/db';
import { isSameOrigin, json } from '../../lib/server';
import { clean } from '../../lib/validation';

const MAX_FAVORITES = 200;

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) return json({ error: 'Non connecté.' }, 401);
  const rows = await db.select({ id: favorites.productId }).from(favorites).where(eq(favorites.userId, locals.user.id));
  return json({ ids: rows.map((r) => r.id) });
};

async function readProductId(request: Request) {
  try {
    return clean((await request.json()).productId, 80);
  } catch {
    return '';
  }
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!isSameOrigin(request)) return json({ error: 'Origine non autorisée.' }, 403);
  if (!locals.user) return json({ error: 'Non connecté.' }, 401);
  const productId = await readProductId(request);
  const [product] = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1);
  if (!product) return json({ error: 'Produit inconnu.' }, 404);
  const existing = await db.select({ id: favorites.productId }).from(favorites).where(eq(favorites.userId, locals.user.id));
  if (existing.length >= MAX_FAVORITES) return json({ error: 'Liste de favoris pleine.' }, 422);
  await db.insert(favorites).values({ userId: locals.user.id, productId }).onConflictDoNothing();
  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  if (!isSameOrigin(request)) return json({ error: 'Origine non autorisée.' }, 403);
  if (!locals.user) return json({ error: 'Non connecté.' }, 401);
  const productId = await readProductId(request);
  await db.delete(favorites).where(and(eq(favorites.userId, locals.user.id), eq(favorites.productId, productId)));
  return json({ ok: true });
};
