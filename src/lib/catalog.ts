// Lecture du catalogue (produits, catégories, marques) administré dans le back-office.
// Les objets gardent la forme { id, data } utilisée par les pages et composants.
import { and, asc, eq, inArray } from 'drizzle-orm';
import { brands, categories, media, products, type ProductFeature, type ProductVariant } from '../db/schema';
import { cached, invalidate } from './cache';
import { db } from './db';

export type ImageRef = { id: string; alt: string; width: number | null; height: number | null };

export type Category = {
  id: string;
  data: { name: string; description: string; icon: string; color: string; order: number; image: ImageRef | null };
};

export type Brand = { id: string; data: { name: string; description: string; logo: ImageRef | null } };

export type ProductStatus = (typeof products.$inferSelect)['status'];

export type Product = {
  id: string;
  slug: string;
  data: {
    sku: string;
    name: string;
    category: { id: string };
    brand: { id: string };
    summary: string;
    description: string;
    features: ProductFeature[];
    origin: 'local' | 'importe';
    variants: ProductVariant[];
    status: ProductStatus;
    stock: number | null;
    badges: ('nouveau' | 'promotion' | 'populaire' | 'rupture' | 'b2b' | 'sur-commande')[];
    popularity: number;
    createdAt: Date;
    related: string[];
    images: ImageRef[];
    leadTime: string | null;
    published: boolean;
    seoTitle: string | null;
    seoDescription: string | null;
  };
};

async function loadImages(ids: string[]) {
  if (!ids.length) return new Map<string, ImageRef>();
  const rows = await db
    .select({ id: media.id, alt: media.alt, width: media.width, height: media.height })
    .from(media)
    .where(and(inArray(media.id, ids), eq(media.private, false)));
  return new Map(rows.map((r) => [r.id, r]));
}

async function loadCatalog(includeUnpublished: boolean) {
  const [productRows, categoryRows, brandRows] = await Promise.all([
    db
      .select()
      .from(products)
      .where(includeUnpublished ? undefined : eq(products.published, true))
      .orderBy(asc(products.name)),
    db.select().from(categories).orderBy(asc(categories.position), asc(categories.name)),
    db.select().from(brands).orderBy(asc(brands.position), asc(brands.name)),
  ]);
  const imageIds = [
    ...productRows.flatMap((p) => p.imageIds),
    ...categoryRows.flatMap((c) => (c.imageId ? [c.imageId] : [])),
    ...brandRows.flatMap((b) => (b.logoId ? [b.logoId] : [])),
  ];
  const images = await loadImages([...new Set(imageIds)]);

  const categoryList: Category[] = categoryRows.map((c) => ({
    id: c.id,
    data: { name: c.name, description: c.description, icon: c.icon, color: c.color, order: c.position, image: (c.imageId && images.get(c.imageId)) || null },
  }));
  const brandList: Brand[] = brandRows.map((b) => ({
    id: b.id,
    data: { name: b.name, description: b.description, logo: (b.logoId && images.get(b.logoId)) || null },
  }));
  const productList: Product[] = productRows.map((p) => ({
    id: p.id,
    slug: p.slug,
    data: {
      sku: p.sku,
      name: p.name,
      category: { id: p.categoryId },
      brand: { id: p.brandId },
      summary: p.summary,
      description: p.description,
      features: p.features,
      origin: p.origin === 'local' ? 'local' : 'importe',
      variants: p.variants,
      status: p.status,
      stock: p.stock,
      badges: p.badges as Product['data']['badges'],
      popularity: p.popularity,
      createdAt: p.createdAt,
      related: p.related,
      images: p.imageIds.map((id) => images.get(id)).filter((i): i is ImageRef => !!i),
      leadTime: p.leadTime,
      published: p.published,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
    },
  }));
  return { products: productList, categories: categoryList, brands: brandList };
}

/** Catalogue public (produits publiés). Avec `includeUnpublished`, pour le back-office. */
export async function getCatalog(options: { includeUnpublished?: boolean } = {}) {
  const all = !!options.includeUnpublished;
  const { products, categories, brands } = await cached(`catalog:${all}`, 30_000, () => loadCatalog(all));
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const brandById = new Map(brands.map((b) => [b.id, b]));
  const fallbackCategory: Category = { id: '', data: { name: '—', description: '', icon: 'box', color: '#56665f', order: 0, image: null } };
  const fallbackBrand: Brand = { id: '', data: { name: '—', description: '', logo: null } };
  return {
    products,
    categories,
    brands,
    categoryOf: (p: Product) => categoryById.get(p.data.category.id) ?? fallbackCategory,
    brandOf: (p: Product) => brandById.get(p.data.brand.id) ?? fallbackBrand,
  };
}

export function invalidateCatalog() {
  invalidate('catalog:');
}

export function productUrl(p: Product) {
  return `/boutique/${p.slug}`;
}

/** Prix « à partir de » : la variante la moins chère. */
export function lowestVariant(p: Product) {
  return p.data.variants.reduce((min, v) => (v.price < min.price ? v : min));
}

export function canBuyOnline(p: Product) {
  return p.data.status === 'disponible' || p.data.status === 'sur-commande';
}

/** Prix appliqué à un client : prix pro pour un compte professionnel validé, sinon prix public. */
export function unitPriceFor(variant: ProductVariant, isPro: boolean) {
  return isPro && variant.proPrice && variant.proPrice < variant.price ? variant.proPrice : variant.price;
}

/** Données minimales passées au bouton « Ajouter au panier ». */
export function cartPayload(p: Product, color: string, defaultVariant = lowestVariant(p).id) {
  return JSON.stringify({
    productId: p.id,
    name: p.data.name,
    slug: p.slug,
    color,
    image: p.data.images[0]?.id ?? null,
    defaultVariant,
    variants: p.data.variants.map((v) => ({ id: v.id, label: v.label, price: v.price })),
  });
}
