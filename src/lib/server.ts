// Utilitaires des endpoints API : réponses JSON, limitation de débit, identifiants.
import { sql } from 'drizzle-orm';
import { apiRateLimit } from '../db/schema';
import { db } from './db';

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/**
 * Autorise `limit` requêtes par fenêtre de `windowMs` pour une même clé (IP + route).
 * Le compteur est en base : il est partagé par toutes les instances serverless.
 */
export async function rateLimit(key: string, limit = 10, windowMs = 60_000): Promise<boolean> {
  const expired = sql`${apiRateLimit.windowStart} < now() - make_interval(secs => ${windowMs / 1000})`;
  const [row] = await db
    .insert(apiRateLimit)
    .values({ key, count: 1 })
    .onConflictDoUpdate({
      target: apiRateLimit.key,
      set: {
        count: sql`CASE WHEN ${expired} THEN 1 ELSE ${apiRateLimit.count} + 1 END`,
        windowStart: sql`CASE WHEN ${expired} THEN now() ELSE ${apiRateLimit.windowStart} END`,
      },
    })
    .returning({ count: apiRateLimit.count });
  return row.count <= limit;
}

export function newId(prefix: string) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase().padStart(6, '0').slice(0, 6);
  return `${prefix}-${date}-${rand}`;
}

/** Vérifie que la requête vient bien de notre site (protection CSRF basique). */
export function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}
