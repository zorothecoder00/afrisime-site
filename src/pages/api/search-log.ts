// Journal des recherches de la boutique (statistiques du back-office : recherches sans résultat).
import type { APIRoute } from 'astro';
import { searchLog } from '../../db/schema';
import { db } from '../../lib/db';
import { isSameOrigin, rateLimit } from '../../lib/server';
import { clean } from '../../lib/validation';

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!isSameOrigin(request) || !(await rateLimit(`search-log:${clientAddress}`, 30))) return new Response(null, { status: 204 });
  try {
    const body = JSON.parse(await request.text());
    const query = clean(body.q, 120).toLowerCase();
    const results = Math.max(0, Math.min(10_000, Math.floor(Number(body.results)) || 0));
    if (query.length >= 2) await db.insert(searchLog).values({ query, results });
  } catch {
    /* requête mal formée : ignorée */
  }
  return new Response(null, { status: 204 });
};
