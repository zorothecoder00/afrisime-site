// @ts-check
import { defineConfig, envField } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import vercel from '@astrojs/vercel';

const secret = (options = {}) => envField.string({ context: 'server', access: 'secret', optional: true, ...options });

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()]
  },

  // Domaine public (sitemap, canonical, Open Graph). Défini par SITE_URL au moment du build.
  site: process.env.SITE_URL || "https://votre-domaine.com",

  // Toutes les pages sont rendues côté serveur : le catalogue, les contenus et les paramètres
  // viennent du back-office. Les pages publiques sont mises en cache par le CDN (src/middleware.ts).
  output: 'server',
  adapter: vercel(),

  // Variables lues à l'exécution côté serveur uniquement (jamais envoyées au navigateur).
  env: {
    schema: {
      DATABASE_URL: envField.string({ context: 'server', access: 'secret' }),
      BETTER_AUTH_SECRET: envField.string({ context: 'server', access: 'secret', min: 32 }),
      BETTER_AUTH_URL: envField.string({ context: 'server', access: 'secret', url: true }),

      // ERP / CRM (facultatif : sans eux, commandes et leads restent en base et sont renvoyés plus tard)
      ERP_API_URL: secret({ url: true }),
      ERP_API_TOKEN: secret(),
      CRM_API_URL: secret({ url: true }),
      CRM_API_TOKEN: secret(),
      // Secret que l'ERP envoie (Authorization: Bearer …) pour les webhooks statut de commande et catalogue.
      ERP_WEBHOOK_SECRET: secret({ min: 32 }),

      // Paiement en ligne
      PAYMENT_PROVIDER: envField.enum({ context: 'server', access: 'secret', values: ['fedapay', 'simulation'], optional: true }),
      FEDAPAY_SECRET_KEY: secret(),
      FEDAPAY_ENV: envField.enum({ context: 'server', access: 'secret', values: ['sandbox', 'live'], default: 'sandbox' }),

      // Notifications
      EMAIL_PROVIDER: envField.enum({ context: 'server', access: 'secret', values: ['resend', 'brevo'], optional: true }),
      EMAIL_API_KEY: secret(),
      EMAIL_FROM: secret(),
      STAFF_NOTIFY_EMAIL: secret(),
      NOTIFY_WEBHOOK_URL: secret({ url: true }),
      NOTIFY_WEBHOOK_SECRET: secret(),

      // Tâche planifiée (Vercel Cron envoie Authorization: Bearer <CRON_SECRET>)
      CRON_SECRET: secret({ min: 16 }),
    },
  },
});
