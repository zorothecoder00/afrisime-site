// Contenus éditoriaux (Média, pages légales) et FAQ administrés dans le back-office.
// Cycle de publication : brouillon → à valider → publié (immédiat ou programmé) → archivé.
import { and, asc, desc, eq, lte, ne } from 'drizzle-orm';
import { contents, faqItems, media } from '../db/schema';
import { cached, invalidate } from './cache';
import { db } from './db';

export type Content = typeof contents.$inferSelect;
export type ContentType = 'actualite' | 'conseil' | 'video' | 'evenement' | 'communique' | 'page';

export const ARTICLE_TYPES = ['actualite', 'conseil', 'video', 'evenement', 'communique'] as const;

export const CONTENT_STATUS_LABELS = {
  brouillon: 'Brouillon',
  'a-valider': 'À valider',
  publie: 'Publié',
  archive: 'Archivé',
} as const;

export const FAQ_GROUPS = [
  { id: 'general', title: 'Questions générales' },
  { id: 'commande', title: 'Commande & paiement' },
  { id: 'livraison', title: 'Livraison' },
  { id: 'b2b', title: 'Professionnels (B2B)' },
] as const;

/** Publié et dont la date de publication est passée. */
const isLive = () => and(eq(contents.status, 'publie'), lte(contents.publishedAt, new Date()));

export function isPublished(c: Pick<Content, 'status' | 'publishedAt'>) {
  return c.status === 'publie' && !!c.publishedAt && c.publishedAt <= new Date();
}

/** Articles publiés de la section Média, du plus récent au plus ancien. */
export function listArticles(limit = 100): Promise<(Content & { coverAlt: string | null })[]> {
  // Pas de cache long : un contenu programmé doit apparaître à l'heure prévue.
  return cached(`content:articles:${limit}`, 30_000, async () => {
    const rows = await db
      .select({ content: contents, coverAlt: media.alt })
      .from(contents)
      .leftJoin(media, eq(media.id, contents.coverId))
      .where(and(isLive(), ne(contents.type, 'page')))
      .orderBy(desc(contents.publishedAt))
      .limit(limit);
    return rows.map((r) => ({ ...r.content, coverAlt: r.coverAlt }));
  });
}

export async function getPublishedArticle(slug: string) {
  const [row] = await db
    .select()
    .from(contents)
    .where(and(isLive(), ne(contents.type, 'page'), eq(contents.slug, slug)))
    .limit(1);
  return row;
}

export async function getPublishedPage(slug: string) {
  return cached(`content:page:${slug}`, 30_000, async () => {
    const [row] = await db
      .select()
      .from(contents)
      .where(and(isLive(), eq(contents.type, 'page'), eq(contents.slug, slug)))
      .limit(1);
    return row ?? null;
  });
}

export function listPublishedPages() {
  return db
    .select({ slug: contents.slug, title: contents.title, updatedAt: contents.updatedAt })
    .from(contents)
    .where(and(isLive(), eq(contents.type, 'page')))
    .orderBy(asc(contents.title));
}

export function listFaq() {
  return cached('content:faq', 60_000, () =>
    db.select().from(faqItems).where(eq(faqItems.published, true)).orderBy(asc(faqItems.position), asc(faqItems.question)),
  );
}

export function invalidateContent() {
  invalidate('content:');
}

/** URL d'intégration d'une vidéo YouTube ou Vimeo (domaine sans cookie pour YouTube). */
export function videoEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(u.pathname.slice(1))}`;
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = u.searchParams.get('v') ?? u.pathname.match(/^\/(?:embed|shorts)\/([\w-]+)/)?.[1];
      return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
    }
    if (host === 'vimeo.com') {
      const id = u.pathname.match(/^\/(\d+)/)?.[1];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    /* URL invalide */
  }
  return null;
}
