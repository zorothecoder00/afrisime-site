// Documents privés joints aux demandes (B2B, fournisseurs, réclamations) : équipe uniquement.
import type { APIRoute } from 'astro';
import { audit } from '../../../lib/audit';
import { readFile } from '../../../lib/media';
import { can } from '../../../lib/roles';

export const GET: APIRoute = async ({ params, locals, clientAddress }) => {
  const me = locals.user;
  if (!me || !can(me.role, { lead: ['read'] })) return new Response('Accès refusé.', { status: 403 });
  const file = await readFile(params.id ?? '');
  if (!file) return new Response('Document introuvable.', { status: 404 });
  await audit({ actorId: me.id, action: 'document-consulte', target: file.id, ipAddress: clientAddress });
  return new Response(new Uint8Array(file.data), {
    headers: {
      'Content-Type': file.mime,
      'Content-Disposition': `attachment; filename="${file.filename.replace(/"/g, '')}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
