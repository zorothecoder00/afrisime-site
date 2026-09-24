// Collections de contenu. Les données viennent aujourd'hui de fichiers JSON/Markdown ;
// pour brancher un CMS ou l'ERP AfriGes, il suffira de remplacer le loader
// de chaque collection sans toucher aux pages.
import { defineCollection, reference } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

const categories = defineCollection({
  loader: file('src/data/categories.json'),
  schema: z.object({
    name: z.string(),
    description: z.string(),
    icon: z.string(),
    color: z.string(),
    order: z.number(),
  }),
});

const brands = defineCollection({
  loader: file('src/data/brands.json'),
  schema: z.object({
    name: z.string(),
    description: z.string(),
  }),
});

const products = defineCollection({
  loader: file('src/data/products.json'),
  schema: z.object({
    sku: z.string(),
    name: z.string(),
    category: reference('categories'),
    brand: reference('brands'),
    summary: z.string(),
    description: z.string(),
    features: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
    origin: z.enum(['local', 'importe']),
    variants: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          price: z.number().int().nonnegative(),
          compareAtPrice: z.number().int().optional(),
          unit: z.string(),
          weightKg: z.number(),
        }),
      )
      .min(1),
    status: z.enum(['disponible', 'sur-commande', 'indisponible', 'devis']),
    badges: z.array(z.enum(['nouveau', 'promotion', 'populaire', 'rupture', 'b2b', 'sur-commande'])).default([]),
    popularity: z.number(),
    createdAt: z.coerce.date(),
    related: z.array(z.string()).default([]),
  }),
});

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/media' }),
  schema: z.object({
    title: z.string(),
    type: z.enum(['actualite', 'conseil', 'video', 'evenement', 'communique']),
    excerpt: z.string(),
    date: z.coerce.date(),
    author: z.string().default('Équipe AfriSime'),
  }),
});

const faq = defineCollection({
  loader: file('src/data/faq.json'),
  schema: z.object({
    group: z.enum(['general', 'commande', 'livraison', 'b2b']),
    question: z.string(),
    answer: z.string(),
  }),
});

export const collections = { categories, brands, products, articles, faq };
