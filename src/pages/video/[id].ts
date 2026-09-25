// Vidéos vitrines envoyées dans le back-office : /video/<id>.
// Gère les requêtes partielles (Range), indispensables à la lecture vidéo sur Safari / iPhone.
// Le contenu d'un identifiant ne change jamais : cache long.
import type { APIRoute } from 'astro';
import { readFile } from '../../lib/media';

export const GET: APIRoute = async ({ params, request }) => {
  const id = params.id ?? '';
  if (!/^[a-f0-9]{20}$/.test(id)) return new Response(null, { status: 404 });
  const file = await readFile(id);
  if (!file || file.private || file.kind !== 'video') return new Response(null, { status: 404 });

  const size = file.data.length;
  const headers: Record<string, string> = {
    'Content-Type': file.mime,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  };
  const range = request.headers.get('range')?.match(/^bytes=(\d*)-(\d*)$/);
  if (range) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    return new Response(new Uint8Array(file.data.subarray(start, end + 1)), {
      status: 206,
      headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) },
    });
  }
  return new Response(new Uint8Array(file.data), { headers: { ...headers, 'Content-Length': String(size) } });
};
