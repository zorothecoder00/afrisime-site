// Un programme ou projet (back-office), réservé à l'équipe avec la permission contenus :
//   GET    /api/admin/programmes/:id    détail
//   PATCH  /api/admin/programmes/:id    modification partielle (mêmes champs que la création)
//   DELETE /api/admin/programmes/:id    suppression
import type { APIRoute } from 'astro';
import { denyApi } from '../../../../lib/admin';
import { audit } from '../../../../lib/audit';
import { deleteProject, getProject, parseProjectFields, updateProject } from '../../../../lib/projects';
import { json } from '../../../../lib/server';

const NOT_FOUND = 'Programme ou projet introuvable.';

export const GET: APIRoute = async ({ request, locals, params }) => {
  const denied = denyApi(request, locals.user, { content: ['read'] });
  if (denied) return denied;
  const project = await getProject(params.id ?? '');
  return project ? json({ item: project }) : json({ error: NOT_FOUND }, 404);
};

export const PATCH: APIRoute = async ({ request, locals, params, clientAddress }) => {
  const denied = denyApi(request, locals.user, { content: ['update'] });
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Corps JSON attendu.' }, 400);
  const { values, error } = parseProjectFields(body);
  if (error) return json({ error }, 422);
  const project = await updateProject(params.id ?? '', values, locals.user!.id);
  if (!project) return json({ error: NOT_FOUND }, 404);
  await audit({ actorId: locals.user!.id, action: 'programme-update', target: project.id, ipAddress: clientAddress });
  return json({ item: project });
};

export const DELETE: APIRoute = async ({ request, locals, params, clientAddress }) => {
  const denied = denyApi(request, locals.user, { content: ['update'] });
  if (denied) return denied;
  const id = params.id ?? '';
  if (!(await deleteProject(id, locals.user!.id))) return json({ error: NOT_FOUND }, 404);
  await audit({ actorId: locals.user!.id, action: 'programme-delete', target: id, ipAddress: clientAddress });
  return json({ ok: true });
};
