// Redirections 301 administrables (§13). Consultées uniquement quand une page
// n'existe pas (404) : aucun coût sur les pages existantes.
import { eq, sql } from 'drizzle-orm';
import { redirects } from '../db/schema';
import { cached, invalidate } from './cache';
import { db } from './db';

export function normalizePath(path: string) {
  const clean = path.trim().replace(/^https?:\/\/[^/]+/i, '').split('#')[0];
  const withSlash = clean.startsWith('/') ? clean : `/${clean}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, '') : withSlash;
}

export async function findRedirect(pathname: string) {
  const map = await cached('redirects', 60_000, async () => {
    const rows = await db.select({ from: redirects.from, to: redirects.to, status: redirects.status }).from(redirects);
    return new Map(rows.map((r) => [r.from, r]));
  });
  const hit = map.get(normalizePath(pathname));
  if (hit) {
    db.update(redirects)
      .set({ hits: sql`${redirects.hits} + 1` })
      .where(eq(redirects.from, hit.from))
      .catch(() => {});
  }
  return hit;
}

/** Ajoute (ou remplace) une redirection, par exemple quand l'adresse d'un produit change. */
export async function addRedirect(from: string, to: string, status = 301) {
  const source = normalizePath(from);
  const target = to.startsWith('http') ? to : normalizePath(to);
  if (source === target) return;
  await db.insert(redirects).values({ from: source, to: target, status }).onConflictDoUpdate({ target: redirects.from, set: { to: target, status } });
  // Une ancienne redirection qui pointait vers l'ancienne adresse suit le changement (pas de chaîne).
  await db.update(redirects).set({ to: target }).where(eq(redirects.to, source));
  invalidate('redirects');
}

export function invalidateRedirects() {
  invalidate('redirects');
}
