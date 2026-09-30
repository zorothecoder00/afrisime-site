// Documentation visuelle du site (source : docs/guide-visuel.html), servie dans le back-office.
// L'accès est protégé par le middleware (/admin : équipe et double authentification).
import type { APIRoute } from 'astro';
import guide from '../../../docs/guide-visuel.html?raw';

export const GET: APIRoute = () =>
  new Response(guide, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
    },
  });
