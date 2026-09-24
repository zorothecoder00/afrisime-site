import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Connexion PostgreSQL, identique en local et sur Neon : seule l'URL change.
 * `prepare: false` est requis par le pooler de Neon (PgBouncer en mode transaction).
 */
export function createDb(url: string) {
  const client = postgres(url, { max: 5, prepare: false });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
