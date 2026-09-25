// Tests unitaires (Vitest). Les modules virtuels d'Astro sont remplacés par des valeurs de test :
// aucun test unitaire ne se connecte à une base de données.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'astro:env/server': fileURLToPath(new URL('./tests/stubs/astro-env.ts', import.meta.url)),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
