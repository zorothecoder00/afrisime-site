// Utilitaires des endpoints API : réponses JSON, limitation de débit, idempotence.
//
// Le stockage est en mémoire : il suffit pour le prototype, mais sur Vercel chaque
// instance a sa propre mémoire. En production, utiliser un stockage partagé
// (Redis / Vercel KV / base de données).

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

const hits = new Map<string, number[]>();

/** Autorise `limit` requêtes par fenêtre de `windowMs` pour une même clé (IP + route). */
export function rateLimit(key: string, limit = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length <= limit;
}

const idempotency = new Map<string, { at: number; body: unknown }>();

/** Renvoie la réponse déjà produite pour cette clé, pour éviter les doubles commandes. */
export function getIdempotent(key: string) {
  const entry = idempotency.get(key);
  if (entry && Date.now() - entry.at < 24 * 3600_000) return entry.body;
  return undefined;
}

export function setIdempotent(key: string, body: unknown) {
  idempotency.set(key, { at: Date.now(), body });
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
