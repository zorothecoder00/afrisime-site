// Journal d'activité : traçabilité des actions sensibles (cahier des charges §10).
import { auditLog } from '../db/schema';
import { db } from './db';

export async function audit(entry: {
  actorId?: string | null;
  action: string;
  target?: string;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
}) {
  try {
    await db.insert(auditLog).values({ ...entry, actorId: entry.actorId ?? null, ipAddress: entry.ipAddress ?? null });
  } catch (err) {
    // Le journal ne doit jamais bloquer l'action elle-même.
    console.error('[audit]', err);
  }
}
