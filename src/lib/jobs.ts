// Offres d'emploi de la page Carrières, gérées dans le back-office (Offres d'emploi).
// Enregistrées dans la ligne `jobs` de la table `settings` : aucune offre par défaut.
import { eq } from 'drizzle-orm';
import { settings } from '../db/schema';
import { cached, invalidate } from './cache';
import { db } from './db';

export type Job = {
  id: string;
  title: string;
  place: string;
  contract: string;
  text: string;
  position: number;
  published: boolean;
};

const KEY = 'jobs';

function isJob(value: unknown): value is Job {
  const j = value as Job;
  return !!j && typeof j.id === 'string' && typeof j.title === 'string';
}

/** Toutes les offres (back-office), par ordre d'affichage. */
export function listJobs(): Promise<Job[]> {
  return cached('jobs', 60_000, async () => {
    const [row] = await db.select().from(settings).where(eq(settings.key, KEY));
    const jobs = Array.isArray(row?.value) ? (row.value as unknown[]).filter(isJob) : [];
    return jobs.sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
  });
}

/** Offres publiées (page Carrières). */
export async function listPublishedJobs() {
  return (await listJobs()).filter((j) => j.published);
}

export async function saveJobs(jobs: Job[], actorId: string) {
  await db
    .insert(settings)
    .values({ key: KEY, value: jobs, updatedBy: actorId })
    .onConflictDoUpdate({ target: settings.key, set: { value: jobs, updatedBy: actorId, updatedAt: new Date() } });
  invalidate('jobs');
}
