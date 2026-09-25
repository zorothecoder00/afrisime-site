// Tests de bout en bout des parcours critiques (§20, recette §21).
// Ils créent des commandes et des demandes : à lancer UNIQUEMENT sur une base locale ou de CI,
// jamais sur la production (le site doit tourner sur localhost).
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:4321';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(baseURL)) {
  throw new Error(`Tests E2E refusés sur ${baseURL} : ils écrivent des données. Utilisez un serveur local.`);
}

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL, locale: 'fr-FR', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npx astro dev --port 4321',
        url: 'http://localhost:4321',
        reuseExistingServer: true,
        timeout: 120_000,
        env: { PAYMENT_PROVIDER: 'simulation' },
      },
});
