import { getCollection, type CollectionEntry } from 'astro:content';

export type Product = CollectionEntry<'products'>;
export type Category = CollectionEntry<'categories'>;
export type Brand = CollectionEntry<'brands'>;

export async function getCatalog() {
  const [products, categories, brands] = await Promise.all([
    getCollection('products'),
    getCollection('categories'),
    getCollection('brands'),
  ]);
  categories.sort((a, b) => a.data.order - b.data.order);
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const brandById = new Map(brands.map((b) => [b.id, b]));
  return {
    products,
    categories,
    brands,
    categoryOf: (p: Product) => categoryById.get(p.data.category.id)!,
    brandOf: (p: Product) => brandById.get(p.data.brand.id)!,
  };
}

/** Prix « à partir de » : la variante la moins chère. */
export function lowestVariant(p: Product) {
  return p.data.variants.reduce((min, v) => (v.price < min.price ? v : min));
}

export function canBuyOnline(p: Product) {
  return p.data.status === 'disponible' || p.data.status === 'sur-commande';
}

/** Données minimales passées au bouton « Ajouter au panier ». */
export function cartPayload(p: Product, color: string, defaultVariant = lowestVariant(p).id) {
  return JSON.stringify({
    productId: p.id,
    name: p.data.name,
    slug: p.id,
    color,
    defaultVariant,
    variants: p.data.variants.map((v) => ({ id: v.id, label: v.label, price: v.price })),
  });
}
