// Médiathèque : images (compressées en WebP, avec miniature) et documents PDF.
// Les fichiers sont stockés en base (table media) : aucun service de stockage externe
// n'est nécessaire. Pour un volume important, remplacer storeFile/readFile par un
// stockage objet (Vercel Blob, S3…) sans changer les pages.
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { media } from '../db/schema';
import { db } from './db';

export const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
export const DOCUMENT_MIME = ['application/pdf', ...IMAGE_MIME];
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

const FULL_SIZE = 1600;
const THUMB_SIZE = 600;

export class UploadError extends Error {}

function newMediaId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 20);
}

async function toWebp(buffer: Buffer) {
  const image = sharp(buffer, { failOn: 'error' }).rotate(); // rotate() applique l'orientation EXIF
  const full = await image
    .clone()
    .resize({ width: FULL_SIZE, height: FULL_SIZE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });
  const thumb = await image
    .clone()
    .resize({ width: THUMB_SIZE, height: THUMB_SIZE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer();
  return { data: full.data, thumb, width: full.info.width, height: full.info.height };
}

/**
 * Enregistre un fichier envoyé. Les images sont réencodées (ce qui supprime aussi
 * les métadonnées et tout contenu caché) ; les PDF sont vérifiés par leur signature.
 */
export async function storeUpload(
  file: File,
  options: { private?: boolean; uploadedBy?: string | null; alt?: string; allowDocuments?: boolean } = {},
) {
  if (!file || typeof file === 'string' || file.size === 0) throw new UploadError('Aucun fichier reçu.');
  const buffer = Buffer.from(await file.arrayBuffer());
  const isImage = IMAGE_MIME.includes(file.type);
  const isPdf = file.type === 'application/pdf';
  const filename = file.name.replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'fichier';

  if (isImage) {
    if (buffer.length > MAX_IMAGE_BYTES) throw new UploadError('Image trop lourde (8 Mo maximum).');
    let processed;
    try {
      processed = await toWebp(buffer);
    } catch {
      throw new UploadError(`« ${filename} » n'est pas une image lisible.`);
    }
    const id = newMediaId();
    await db.insert(media).values({
      id,
      kind: 'image',
      filename,
      mime: 'image/webp',
      size: processed.data.length,
      width: processed.width,
      height: processed.height,
      alt: options.alt?.slice(0, 300) ?? '',
      data: processed.data,
      thumb: processed.thumb,
      private: !!options.private,
      uploadedBy: options.uploadedBy ?? null,
    });
    return { id, kind: 'image' as const, filename };
  }

  if (isPdf && options.allowDocuments) {
    if (buffer.length > MAX_DOCUMENT_BYTES) throw new UploadError('Document trop lourd (5 Mo maximum).');
    if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') throw new UploadError(`« ${filename} » n'est pas un PDF valide.`);
    const id = newMediaId();
    await db.insert(media).values({
      id,
      kind: 'document',
      filename,
      mime: 'application/pdf',
      size: buffer.length,
      data: buffer,
      private: !!options.private,
      uploadedBy: options.uploadedBy ?? null,
    });
    return { id, kind: 'document' as const, filename };
  }

  throw new UploadError(options.allowDocuments ? 'Formats acceptés : PDF, JPG, PNG, WebP.' : 'Formats acceptés : JPG, PNG, WebP, AVIF, GIF.');
}

export async function readFile(id: string) {
  const [row] = await db.select().from(media).where(eq(media.id, id)).limit(1);
  return row;
}

/** URL publique d'une image (taille « mini » pour les vignettes). */
export function imageUrl(id: string, size: 'full' | 'mini' = 'full') {
  return `/img/${id}.webp${size === 'mini' ? '?taille=mini' : ''}`;
}
