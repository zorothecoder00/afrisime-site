// Sitemap XML (§13) : pages institutionnelles, produits, articles et pages légales publiés.
// Généré à la demande depuis la base, donc toujours à jour après une publication.
import type { APIRoute } from 'astro';
import { getCatalog, productUrl } from '../lib/catalog';
import { listArticles, listPublishedPages } from '../lib/content';

const STATIC_PAGES = ['/', '/afrisime', '/activites', '/boutique', '/b2b', '/partenaires', '/investir', '/carrieres', '/media', '/faq', '/contact'];

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
}

export const GET: APIRoute = async ({ site }) => {
  const [{ products }, articles, pages] = await Promise.all([getCatalog(), listArticles(1000), listPublishedPages()]);
  const entries: { path: string; lastmod?: Date }[] = [
    ...STATIC_PAGES.map((path) => ({ path })),
    ...products.map((p) => ({ path: productUrl(p) })),
    ...articles.map((a) => ({ path: `/media/${a.slug}`, lastmod: a.updatedAt })),
    ...pages.map((p) => ({ path: `/legal/${p.slug}`, lastmod: p.updatedAt })),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map((e) => `  <url><loc>${escapeXml(new URL(e.path, site).href)}</loc>${e.lastmod ? `<lastmod>${e.lastmod.toISOString()}</lastmod>` : ''}</url>`)
  .join('\n')}
</urlset>`;
  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=3600' },
  });
};
