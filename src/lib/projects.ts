// Programmes et projets de la page Programmes & Projets, gérés dans le back-office
// (page Programmes & projets, ou API /api/admin/programmes).
// Enregistrés dans la ligne `projects` de la table `settings` : aucun par défaut.
import { eq } from 'drizzle-orm';
import { settings } from '../db/schema';
import { cached, invalidate } from './cache';
import { db } from './db';

export const PROJECT_KINDS = { programme: 'Programme', projet: 'Projet' } as const;
export const PROJECT_STATUSES = { 'a-venir': 'À venir', 'en-cours': 'En cours', termine: 'Terminé' } as const;

export type ProjectKind = keyof typeof PROJECT_KINDS;
export type ProjectStatus = keyof typeof PROJECT_STATUSES;

export type Project = {
  id: string;
  kind: ProjectKind;
  title: string;
  /** Résumé affiché en tête de carte. */
  summary: string;
  /** Description détaillée (paragraphes séparés par une ligne vide). */
  text: string;
  status: ProjectStatus;
  /** Lieu ou zone d'intervention. */
  place: string;
  /** Période en texte libre (ex. : 2025 – 2027). */
  period: string;
  /** Image (médiathèque) ; vide : pas d'image. */
  imageId: string;
  position: number;
  published: boolean;
};

export type ProjectInput = Omit<Project, 'id'>;

const KEY = 'projects';

function isProject(value: unknown): value is Project {
  const p = value as Project;
  return !!p && typeof p.id === 'string' && typeof p.title === 'string';
}

/** Tous les programmes et projets (back-office), par ordre d'affichage. */
export function listProjects(): Promise<Project[]> {
  return cached('projects', 60_000, async () => {
    const [row] = await db.select().from(settings).where(eq(settings.key, KEY));
    const projects = Array.isArray(row?.value) ? (row.value as unknown[]).filter(isProject) : [];
    return projects.sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
  });
}

/** Programmes et projets publiés (page publique). */
export async function listPublishedProjects() {
  return (await listProjects()).filter((p) => p.published);
}

export async function getProject(id: string) {
  return (await listProjects()).find((p) => p.id === id) ?? null;
}

async function saveProjects(projects: Project[], actorId: string) {
  await db
    .insert(settings)
    .values({ key: KEY, value: projects, updatedBy: actorId })
    .onConflictDoUpdate({ target: settings.key, set: { value: projects, updatedBy: actorId, updatedAt: new Date() } });
  invalidate('projects');
}

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/**
 * Valide des champs reçus (formulaire ou JSON). Seuls les champs présents sont retournés,
 * pour permettre une modification partielle (PATCH).
 */
export function parseProjectFields(input: Record<string, unknown>): { values: Partial<ProjectInput>; error?: string } {
  const values: Partial<ProjectInput> = {};
  if ('kind' in input) {
    if (!(String(input.kind) in PROJECT_KINDS)) return { values, error: 'Type invalide (programme ou projet).' };
    values.kind = input.kind as ProjectKind;
  }
  if ('status' in input) {
    if (!(String(input.status) in PROJECT_STATUSES)) return { values, error: 'Statut invalide (a-venir, en-cours ou termine).' };
    values.status = input.status as ProjectStatus;
  }
  if ('title' in input) {
    values.title = text(input.title, 140);
    if (values.title.length < 3) return { values, error: 'Indiquez le titre (3 caractères minimum).' };
  }
  if ('summary' in input) values.summary = text(input.summary, 300);
  if ('text' in input) values.text = text(input.text, 4000);
  if ('place' in input) values.place = text(input.place, 100);
  if ('period' in input) values.period = text(input.period, 60);
  if ('imageId' in input) values.imageId = text(input.imageId, 80);
  if ('position' in input) {
    const n = Number(input.position);
    values.position = Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
  }
  if ('published' in input) values.published = input.published === true || input.published === 'on' || input.published === 'true';
  return { values };
}

const DEFAULTS: ProjectInput = {
  kind: 'projet',
  title: '',
  summary: '',
  text: '',
  status: 'en-cours',
  place: '',
  period: '',
  imageId: '',
  position: 0,
  published: true,
};

export async function createProject(values: Partial<ProjectInput>, actorId: string): Promise<Project> {
  const projects = await listProjects();
  const project: Project = { ...DEFAULTS, position: projects.length + 1, ...values, id: crypto.randomUUID() };
  await saveProjects([...projects, project], actorId);
  return project;
}

/** Modifie un programme ou projet ; null s'il n'existe plus. */
export async function updateProject(id: string, values: Partial<ProjectInput>, actorId: string): Promise<Project | null> {
  const projects = await listProjects();
  const current = projects.find((p) => p.id === id);
  if (!current) return null;
  const updated = { ...current, ...values, id };
  await saveProjects(projects.map((p) => (p.id === id ? updated : p)), actorId);
  return updated;
}

/** Supprime un programme ou projet ; false s'il n'existait pas. */
export async function deleteProject(id: string, actorId: string): Promise<boolean> {
  const projects = await listProjects();
  if (!projects.some((p) => p.id === id)) return false;
  await saveProjects(projects.filter((p) => p.id !== id), actorId);
  return true;
}
