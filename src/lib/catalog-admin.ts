// Lecture et validation du formulaire produit du back-office.
import type { ProductFeature, ProductVariant, products } from '../db/schema';
import { bool, int, isSlug, optionalStr, rows, slugify, str } from './admin';

export const PRODUCT_STATUSES = ['disponible', 'sur-commande', 'indisponible', 'devis'] as const;
export const PRODUCT_BADGES = ['nouveau', 'promotion', 'populaire', 'rupture', 'b2b', 'sur-commande'] as const;

type ProductInsert = typeof products.$inferInsert;

export function parseProductForm(form: FormData) {
  const errors: Record<string, string> = {};
  const name = str(form, 'name', 160);
  const slug = str(form, 'slug', 80) || slugify(name);
  const sku = str(form, 'sku', 40).toUpperCase();
  const status = str(form, 'status') as (typeof PRODUCT_STATUSES)[number];

  const variants: ProductVariant[] = [];
  const seenVariantIds = new Set<string>();
  for (const [i, r] of rows(form, 'variants').entries()) {
    if (!r.label && !r.price) continue; // ligne vide
    const id = slugify(r.id || r.label) || `v${i + 1}`;
    const price = Number(r.price);
    const variant: ProductVariant = {
      id,
      label: r.label,
      price: Math.round(price),
      unit: r.unit || 'unité',
      weightKg: Number(r.weightKg) || 0,
    };
    if (r.compareAtPrice) variant.compareAtPrice = Math.round(Number(r.compareAtPrice));
    if (r.proPrice) variant.proPrice = Math.round(Number(r.proPrice));
    if (!r.label || !Number.isFinite(price) || price < 0) errors.variants = `Format ${i + 1} : libellé et prix sont obligatoires.`;
    else if (seenVariantIds.has(id)) errors.variants = `Deux formats ont le même identifiant « ${id} ».`;
    else if (variant.compareAtPrice !== undefined && !(variant.compareAtPrice > variant.price)) errors.variants = `Format « ${r.label} » : le prix barré doit être supérieur au prix.`;
    else if (variant.proPrice !== undefined && !(variant.proPrice > 0 && variant.proPrice < variant.price)) errors.variants = `Format « ${r.label} » : le prix pro doit être inférieur au prix public.`;
    seenVariantIds.add(id);
    variants.push(variant);
  }
  if (!variants.length) errors.variants ??= 'Ajoutez au moins un format avec son prix.';

  const features: ProductFeature[] = rows(form, 'features')
    .filter((r) => r.label && r.value)
    .map((r) => ({ label: r.label.slice(0, 80), value: r.value.slice(0, 200) }));

  if (name.length < 2) errors.name = 'Nom obligatoire.';
  if (!isSlug(slug)) errors.slug = 'Adresse invalide : minuscules, chiffres et tirets uniquement.';
  if (!/^[A-Z0-9-]{3,40}$/.test(sku)) errors.sku = 'Référence (SKU) invalide : lettres, chiffres et tirets.';
  if (!str(form, 'categoryId')) errors.categoryId = 'Choisissez une catégorie.';
  if (!str(form, 'brandId')) errors.brandId = 'Choisissez une marque.';
  if (!PRODUCT_STATUSES.includes(status)) errors.status = 'Statut invalide.';

  const values: Omit<ProductInsert, 'id' | 'imageIds'> = {
    name,
    slug,
    sku,
    categoryId: str(form, 'categoryId', 80),
    brandId: str(form, 'brandId', 80),
    summary: str(form, 'summary', 300),
    description: str(form, 'description', 5000),
    features,
    origin: str(form, 'origin') === 'local' ? 'local' : 'importe',
    variants,
    status: PRODUCT_STATUSES.includes(status) ? status : 'disponible',
    stock: int(form, 'stock'),
    badges: form.getAll('badges').map(String).filter((b) => (PRODUCT_BADGES as readonly string[]).includes(b)),
    popularity: int(form, 'popularity') ?? 0,
    related: form.getAll('related').map(String).slice(0, 12),
    leadTime: optionalStr(form, 'leadTime', 80),
    published: bool(form, 'published'),
    seoTitle: optionalStr(form, 'seoTitle', 70),
    seoDescription: optionalStr(form, 'seoDescription', 170),
  };
  return { values, errors };
}

/** Images conservées (dans l'ordre choisi) après le formulaire. */
export function keptImages(form: FormData, current: string[]): string[] {
  const listed = rows(form, 'images')
    .filter((r) => current.includes(r.id) && r.remove !== 'on')
    .map((r, i) => ({ id: r.id, position: Number(r.position) || i + 1 }));
  return listed.sort((a, b) => a.position - b.position).map((r) => r.id);
}
