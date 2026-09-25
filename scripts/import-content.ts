// Importe le contenu de départ (scripts/seed/) dans la base : catégories, marques, produits,
// articles, pages légales, FAQ, code promo et campagne d'exemple.
//
//   npm run content:import
//
// Ne remplace jamais un élément déjà présent (ce qui a été modifié dans le back-office est conservé) :
// le script peut être relancé sans risque. Par sécurité, il refuse une base distante
// (Neon, production…) sauf avec l'option --distant, à n'utiliser qu'en connaissance de cause.
import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createDb } from '../src/db/client';
import { brands, campaigns, categories, contents, faqItems, products, promoCodes } from '../src/db/schema';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL manquante (.env).');
  process.exit(1);
}
const host = new URL(url).hostname;
if (!['localhost', '127.0.0.1', '::1', 'postgres'].includes(host) && !process.argv.includes('--distant')) {
  console.error(`Base distante (${host}) : import refusé. Relancez avec --distant si c'est vraiment voulu.`);
  process.exit(1);
}

const db = createDb(url);
const seed = (...parts: string[]) => join(import.meta.dirname, 'seed', ...parts);
const readJson = async <T>(file: string): Promise<T> => JSON.parse(await readFile(seed(file), 'utf8'));

/** Front matter YAML simple (clé: valeur sur une ligne) + corps Markdown. */
function parseMarkdown(source: string) {
  const match = source.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { data: {} as Record<string, string>, body: source };
  const data: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (m) data[m[1]] = m[2].trim().replace(/^"(.*)"$/, '$1');
  }
  return { data, body: match[2].trim() };
}

type SeedCategory = { id: string; name: string; description: string; icon: string; color: string; order: number };
type SeedBrand = { id: string; name: string; description: string };
type SeedProduct = {
  id: string;
  sku: string;
  name: string;
  category: string;
  brand: string;
  summary: string;
  description: string;
  features?: { label: string; value: string }[];
  origin: string;
  variants: { id: string; label: string; price: number; compareAtPrice?: number; unit: string; weightKg: number }[];
  status: 'disponible' | 'sur-commande' | 'indisponible' | 'devis';
  badges?: string[];
  popularity: number;
  createdAt: string;
  related?: string[];
};
type SeedFaq = { id: string; group: string; question: string; answer: string };

const count = { categories: 0, brands: 0, products: 0, contents: 0, faq: 0 };

const categoryRows = await readJson<SeedCategory[]>('categories.json');
for (const c of categoryRows) {
  const r = await db
    .insert(categories)
    .values({ id: c.id, name: c.name, description: c.description, icon: c.icon, color: c.color, position: c.order })
    .onConflictDoNothing()
    .returning({ id: categories.id });
  count.categories += r.length;
}

const brandRows = await readJson<SeedBrand[]>('brands.json');
for (const [i, b] of brandRows.entries()) {
  const r = await db.insert(brands).values({ id: b.id, name: b.name, description: b.description, position: i }).onConflictDoNothing().returning({ id: brands.id });
  count.brands += r.length;
}

const productRows = await readJson<SeedProduct[]>('products.json');
for (const p of productRows) {
  const r = await db
    .insert(products)
    .values({
      id: p.id,
      slug: p.id,
      sku: p.sku,
      name: p.name,
      categoryId: p.category,
      brandId: p.brand,
      summary: p.summary,
      description: p.description,
      features: p.features ?? [],
      origin: p.origin,
      variants: p.variants,
      status: p.status,
      badges: p.badges ?? [],
      popularity: p.popularity,
      related: p.related ?? [],
      createdAt: new Date(p.createdAt),
    })
    .onConflictDoNothing()
    .returning({ id: products.id });
  count.products += r.length;
}

for (const file of await readdir(seed('articles'))) {
  const { data, body } = parseMarkdown(await readFile(seed('articles', file), 'utf8'));
  const r = await db
    .insert(contents)
    .values({
      id: crypto.randomUUID(),
      type: data.type || 'actualite',
      slug: file.replace(/\.md$/, ''),
      title: data.title,
      excerpt: data.excerpt ?? '',
      body,
      status: 'publie',
      publishedAt: new Date(data.date),
    })
    .onConflictDoNothing()
    .returning({ id: contents.id });
  count.contents += r.length;
}

for (const file of await readdir(seed('pages'))) {
  const { data, body } = parseMarkdown(await readFile(seed('pages', file), 'utf8'));
  const r = await db
    .insert(contents)
    .values({ id: crypto.randomUUID(), type: 'page', slug: file.replace(/\.md$/, ''), title: data.title, body, status: 'publie', publishedAt: new Date() })
    .onConflictDoNothing()
    .returning({ id: contents.id });
  count.contents += r.length;
}

const faqRows = await readJson<SeedFaq[]>('faq.json');
for (const [i, q] of faqRows.entries()) {
  const r = await db
    .insert(faqItems)
    .values({ id: q.id, group: q.group, question: q.question, answer: q.answer, position: i })
    .onConflictDoNothing()
    .returning({ id: faqItems.id });
  count.faq += r.length;
}

await db
  .insert(promoCodes)
  .values({ code: 'BIENVENUE', description: '−5 % sur votre première commande (5 000 FCFA maximum).', kind: 'pourcentage', value: 5, maxDiscount: 5000 })
  .onConflictDoNothing();
await db
  .insert(campaigns)
  .values({
    id: 'promotions-du-mois',
    title: 'Promotions du mois',
    text: "Jusqu'à −10 % sur une sélection d'huiles et de produits d'entretien. Code BIENVENUE : −5 % sur votre première commande.",
    ctaLabel: 'Voir toutes les promotions',
    ctaHref: '/boutique?badge=promotion',
    placement: 'accueil-offres',
  })
  .onConflictDoNothing();

console.log('Import terminé (éléments ajoutés) :', count);
process.exit(0);
