// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import sitemap from '@astrojs/sitemap';

import vercel from '@astrojs/vercel';

const PRIVATE_PAGES = ['/panier', '/commande', '/compte'];

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()]
  },

  // À remplacer par le domaine définitif (utilisé pour le sitemap, les canonical et Open Graph).
  site: "https://votre-domaine.com",
  integrations: [
    sitemap({
      filter: (page) => !PRIVATE_PAGES.some((p) => new URL(page).pathname.startsWith(p)),
    }),
  ],
  adapter: vercel()
});
