// Images publiques de la médiathèque : /img/<id>.webp (taille « mini » avec ?taille=mini).
// Le contenu d'un identifiant ne change jamais : mise en cache longue par le navigateur et le CDN.
import type { APIRoute } from 'astro';
import { readFile } from '../../lib/media';

export const GET: APIRoute = async ({ params, url }) => {
  const id = (params.file ?? '').replace(/\.webp$/, '');
  if (!/^[a-f0-9]{20}$/.test(id)) return new Response(null, { status: 404 });
  const file = await readFile(id);
  if (!file || file.private || file.kind !== 'image') return new Response(null, { status: 404 });
  const data = url.searchParams.get('taille') === 'mini' && file.thumb ? file.thumb : file.data;
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': 'image/webp',
      'Content-Length': String(data.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
