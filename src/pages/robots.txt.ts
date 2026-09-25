import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) =>
  new Response(
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /api/',
      'Disallow: /admin',
      'Disallow: /panier',
      'Disallow: /commande',
      'Disallow: /compte',
      'Disallow: /suivi',
      '',
      `Sitemap: ${new URL('sitemap.xml', site).href}`,
    ].join('\n'),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } },
  );
