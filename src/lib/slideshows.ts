// Diaporamas gérés dans le back-office (Diaporamas) : emplacement sur le site, style,
// délai, et diapositives (images de la médiathèque, vidéos envoyées ou liens YouTube / Vimeo).
// Enregistrés dans la ligne `slideshows` de la table `settings`.
import { eq, inArray } from 'drizzle-orm';
import { media, settings } from '../db/schema';
import { safeHref } from './admin';
import { cached, invalidate } from './cache';
import { showcaseSource } from './content';
import { db } from './db';

/** `hero` : affiché dans l'en-tête de la page, à droite du titre (une diapositive à la fois, en fondu). */
export const SLIDESHOW_PLACEMENTS = [
  { id: 'entete-afrisime', label: 'Qui sommes-nous — en-tête, à droite du titre', path: '/afrisime', hero: true },
  { id: 'entete-activites', label: 'Activités — en-tête, à droite du titre', path: '/activites', hero: true },
  { id: 'entete-b2b', label: 'Solutions B2B — en-tête, à droite du titre', path: '/b2b', hero: true },
  { id: 'entete-partenaires', label: 'Partenaires — en-tête, à droite du titre', path: '/partenaires', hero: true },
  { id: 'entete-media', label: 'Média — en-tête, à droite du titre', path: '/media', hero: true },
  { id: 'entete-contact', label: 'Contact — en-tête, à droite du titre', path: '/contact', hero: true },
  { id: 'accueil', label: 'Accueil — sous les rayons', path: '/', hero: false },
  { id: 'afrisime', label: 'Qui sommes-nous — après « Notre histoire »', path: '/afrisime', hero: false },
  { id: 'activites', label: 'Activités — sous l’en-tête', path: '/activites', hero: false },
  { id: 'b2b', label: 'Solutions B2B — sous les publics', path: '/b2b', hero: false },
  { id: 'partenaires', label: 'Partenaires — sous les types de partenariat', path: '/partenaires', hero: false },
  { id: 'carrieres', label: 'Carrières — sous l’en-tête', path: '/carrieres', hero: false },
  { id: 'investir', label: 'Investir — sous les arguments', path: '/investir', hero: false },
] as const;
export type SlideshowPlacement = (typeof SLIDESHOW_PLACEMENTS)[number]['id'];
export type HeroPlacement = Extract<(typeof SLIDESHOW_PLACEMENTS)[number], { hero: true }>['id'];

export const SLIDESHOW_MODES = [
  { id: 'carrousel', label: 'Carrousel', hint: 'plusieurs images côte à côte, avec flèches' },
  { id: 'defilement', label: 'Défilement automatique', hint: 'une grande image à la fois, qui glisse' },
] as const;
export type SlideshowMode = (typeof SLIDESHOW_MODES)[number]['id'];

/** `mediaId` : image ou fichier vidéo de la médiathèque ; `videoUrl` : lien YouTube, Vimeo ou .mp4 (sans mediaId). */
export type Slide = { mediaId: string; videoUrl?: string; caption: string; href: string };
export type Slideshow = {
  id: string;
  title: string;
  placement: SlideshowPlacement;
  mode: SlideshowMode;
  /** Secondes d'affichage d'une image. */
  interval: number;
  active: boolean;
  position: number;
  slides: Slide[];
};

/** Diapositive prête à afficher. */
export type RenderedSlide = Omit<Slide, 'href'> & { type: 'image' | 'video' | 'embed'; src: string; alt: string; href: string | null };

const KEY = 'slideshows';
export const MIN_INTERVAL = 2;
export const MAX_INTERVAL = 20;

export const isPlacement = (v: string): v is SlideshowPlacement => SLIDESHOW_PLACEMENTS.some((p) => p.id === v);
export const isHeroPlacement = (v: string) => SLIDESHOW_PLACEMENTS.some((p) => p.id === v && p.hero);
export const isMode = (v: string): v is SlideshowMode => SLIDESHOW_MODES.some((m) => m.id === v);

/** Tous les diaporamas (back-office), par ordre d'affichage. */
export function listSlideshows(): Promise<Slideshow[]> {
  return cached('slideshows', 60_000, async () => {
    const [row] = await db.select().from(settings).where(eq(settings.key, KEY));
    const list = Array.isArray(row?.value) ? (row.value as Slideshow[]).filter((s) => s && typeof s.id === 'string' && Array.isArray(s.slides)) : [];
    return list.sort((a, b) => a.position - b.position);
  });
}

export async function saveSlideshows(list: Slideshow[], actorId: string) {
  await db
    .insert(settings)
    .values({ key: KEY, value: list, updatedBy: actorId })
    .onConflictDoUpdate({ target: settings.key, set: { value: list, updatedBy: actorId, updatedAt: new Date() } });
  invalidate('slideshows');
}

/** Diaporamas actifs d'un emplacement, avec l'adresse et le type de chaque diapositive. */
export async function slideshowsFor(placement: SlideshowPlacement) {
  const shows = (await listSlideshows()).filter((s) => s.active && s.placement === placement && s.slides.length > 0);
  if (!shows.length) return [];
  const ids = [...new Set(shows.flatMap((s) => s.slides.map((sl) => sl.mediaId).filter(Boolean)))];
  const rows = ids.length ? await db.select({ id: media.id, alt: media.alt, kind: media.kind }).from(media).where(inArray(media.id, ids)) : [];
  const known = new Map(rows.map((r) => [r.id, r]));

  const render = (sl: Slide): RenderedSlide | null => {
    const base = { ...sl, href: safeHref(sl.href) };
    if (sl.mediaId) {
      // Un fichier supprimé de la médiathèque disparaît simplement du diaporama.
      const row = known.get(sl.mediaId);
      if (!row) return null;
      if (row.kind === 'video') return { ...base, type: 'video', src: `/video/${row.id}`, alt: sl.caption };
      return { ...base, type: 'image', src: `/img/${row.id}.webp`, alt: row.alt || sl.caption };
    }
    const source = showcaseSource({ mediaId: '', url: sl.videoUrl ?? '' });
    if (!source) return null;
    return { ...base, type: source.kind === 'file' ? 'video' : 'embed', src: source.src, alt: sl.caption };
  };

  return shows
    .map((s) => ({ ...s, slides: s.slides.map(render).filter((x): x is RenderedSlide => !!x) }))
    .filter((s) => s.slides.length > 0);
}

/** Nombre de diaporamas qui utilisent un fichier (empêche sa suppression dans la médiathèque). */
export async function slideshowUsage(mediaId: string) {
  return (await listSlideshows()).filter((s) => s.slides.some((sl) => sl.mediaId === mediaId)).length;
}
