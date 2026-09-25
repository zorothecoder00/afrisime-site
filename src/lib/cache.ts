// Cache mémoire de courte durée, par instance serveur, pour les lectures fréquentes
// (catalogue, paramètres, contenus). Une modification dans le back-office vide le cache
// de l'instance qui l'a faite ; les autres instances se mettent à jour au plus tard après `ttlMs`.
// Les pages publiques sont en plus mises en cache par le CDN (voir src/middleware.ts).

const store = new Map<string, { expires: number; value: Promise<unknown> }>();

export function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as Promise<T>;
  const value = load();
  store.set(key, { expires: Date.now() + ttlMs, value });
  // Une erreur (base indisponible) ne doit pas rester en cache.
  value.catch(() => store.delete(key));
  return value;
}

/** Vide les entrées dont la clé commence par `prefix` (tout le cache sans argument). */
export function invalidate(prefix = '') {
  for (const key of store.keys()) if (key.startsWith(prefix)) store.delete(key);
}
