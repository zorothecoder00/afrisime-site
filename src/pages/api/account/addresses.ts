// Coordonnées et adresses enregistrées du client connecté, pour pré-remplir la commande.
import type { APIRoute } from 'astro';
import { asc, desc, eq } from 'drizzle-orm';
import { addresses } from '../../../db/schema';
import { db } from '../../../lib/db';
import { json } from '../../../lib/server';

export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user) return json({ error: 'Non connecté.' }, 401);
  const rows = await db
    .select({ id: addresses.id, label: addresses.label, city: addresses.city, address: addresses.address, isDefault: addresses.isDefault })
    .from(addresses)
    .where(eq(addresses.userId, user.id))
    .orderBy(desc(addresses.isDefault), asc(addresses.label));
  return json({ user: { name: user.name, email: user.email, phone: user.phone ?? null }, addresses: rows });
};
