// Programmes et projets (back-office), réservé à l'équipe avec la permission contenus :
//   GET  /api/admin/programmes          liste complète (publiés et masqués)
//   POST /api/admin/programmes          création
//        { "kind": "programme" | "projet", "title": "…", "summary": "…", "text": "…",
//          "status": "a-venir" | "en-cours" | "termine", "place": "…", "period": "…",
//          "imageId": "…", "position": 1, "published": true }
import type { APIRoute } from 'astro';
import { denyApi } from '../../../../lib/admin';
import { audit } from '../../../../lib/audit';
import { createProject, listProjects, parseProjectFields } from '../../../../lib/projects';
import { json } from '../../../../lib/server';

export const GET: APIRoute = async ({ request, locals }) => {
  const denied = denyApi(request, locals.user, { content: ['read'] });
  if (denied) return denied;
  return json({ items: await listProjects() });
};

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  const denied = denyApi(request, locals.user, { content: ['update'] });
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Corps JSON attendu.' }, 400);
  const { values, error } = parseProjectFields(body);
  if (error) return json({ error }, 422);
  if (!values.title) return json({ error: 'Indiquez le titre.' }, 422);
  const project = await createProject(values, locals.user!.id);
  await audit({ actorId: locals.user!.id, action: 'programme-create', target: project.id, ipAddress: clientAddress });
  return json({ item: project }, 201);
};
