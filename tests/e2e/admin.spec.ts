// Back-office (§10, REC-09) : un compte de l'équipe se connecte avec la double authentification,
// puis chaque rubrique du back-office s'affiche sans erreur serveur.
// Le compte de test est créé directement en base avant le test et supprimé après :
// uniquement sur une base locale ou de CI.
import 'dotenv/config';
import { expect, test } from '@playwright/test';
import { createOTP } from '@better-auth/utils/otp';
import { hashPassword, symmetricEncrypt } from 'better-auth/crypto';
import { randomBytes, randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { dismissConsent } from './helpers';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const SECRET = process.env.BETTER_AUTH_SECRET ?? '';
if (!/@(localhost|127\.0\.0\.1)(:\d+)?\//.test(DATABASE_URL)) {
  throw new Error('Test du back-office refusé : il crée un compte super administrateur, la base doit être locale.');
}

const USER_ID = 'e2e-super-admin';
const EMAIL = 'e2e-super-admin@afrisime.test';
const password = randomUUID();
const totpSecret = randomBytes(16).toString('hex');
const sql = postgres(DATABASE_URL, { max: 1 });

const ADMIN_PAGES = [
  '/admin',
  '/admin/commandes',
  '/admin/leads',
  '/admin/utilisateurs',
  '/admin/catalogue',
  '/admin/catalogue/categories',
  '/admin/catalogue/marques',
  '/admin/promotions',
  '/admin/contenus',
  '/admin/faq',
  '/admin/medias',
  '/admin/textes',
  '/admin/seo',
  '/admin/parametres',
  '/admin/rapports',
  '/admin/journal',
  '/admin/aide',
];

test.beforeAll(async () => {
  // Compteurs de limitation de débit de la connexion : une relance du test ne doit pas être bloquée.
  await sql`delete from rate_limit where key like '%/sign-in/email' or key like '%/two-factor/%'`;
  await sql`delete from "user" where id = ${USER_ID}`;
  await sql`insert into "user" (id, name, email, email_verified, role, two_factor_enabled)
            values (${USER_ID}, 'Admin E2E', ${EMAIL}, true, 'super-admin', true)`;
  await sql`insert into account (id, account_id, provider_id, user_id, password)
            values (${randomUUID()}, ${USER_ID}, 'credential', ${USER_ID}, ${await hashPassword(password)})`;
  await sql`insert into two_factor (id, secret, backup_codes, user_id, verified)
            values (${randomUUID()}, ${await symmetricEncrypt({ key: SECRET, data: totpSecret })},
                    ${await symmetricEncrypt({ key: SECRET, data: '[]' })}, ${USER_ID}, true)`;
});

test.afterAll(async () => {
  await sql`delete from audit_log where target = ${USER_ID}`;
  await sql`delete from notifications where target = ${USER_ID}`;
  await sql`delete from "user" where id = ${USER_ID}`;
  await sql.end();
});

test('REC-09 back-office : double authentification, alerte de sécurité, toutes les rubriques s’affichent', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/compte\/connexion/);
  await dismissConsent(page);
  // Les formulaires sont envoyés par script : attendre qu'il ait pris la main.
  const login = page.locator('form[data-login][data-ready]');
  await login.getByLabel('Adresse e-mail').fill(EMAIL);
  await login.getByLabel('Mot de passe').fill(password);
  await login.getByRole('button', { name: 'Se connecter' }).click();

  await expect(page).toHaveURL(/\/compte\/verification/);
  const verify = page.locator('form[data-verify][data-ready]');
  const code = verify.getByLabel('Code à 6 chiffres');
  const otp = createOTP(totpSecret, { period: 30, digits: 6 });

  // §15 : trois codes refusés sur un compte de l'équipe déclenchent une alerte (journal + e-mail).
  for (let i = 0; i < 3; i++) {
    const wrong = String((Number(await otp.totp()) + 500_000) % 1_000_000).padStart(6, '0');
    await code.fill(wrong);
    await verify.getByRole('button', { name: 'Valider' }).click();
    await expect(verify.locator('[data-form-status]')).toBeVisible();
  }
  await expect.poll(async () => (await sql`select count(*)::int n from notifications where template = 'alerte-securite' and target = ${USER_ID}`)[0].n).toBeGreaterThan(0);

  await code.fill(await otp.totp());
  await verify.getByRole('button', { name: 'Valider' }).click();
  await expect(page).toHaveURL(/\/admin\/?$/);

  for (const path of ADMIN_PAGES) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.locator('main h1'), path).toBeVisible();
  }

  // Textes du site : un titre modifié dans le back-office s'affiche sur l'accueil.
  await page.goto('/admin/textes?page=accueil');
  const title = page.locator('input[name="heroTitle"]');
  const original = await title.inputValue();
  const changed = `Titre E2E ${Date.now()}`;

  await title.fill(changed);
  await page.getByRole('button', { name: /Enregistrer les textes/ }).click();
  await expect(page.locator('.alert-success')).toBeVisible();
  await page.goto('/');
  await expect(page.locator('main h1')).toHaveText(changed);

  // Remet le texte d'origine (la base locale peut contenir des textes personnalisés).
  await page.goto('/admin/textes?page=accueil');
  await page.locator('input[name="heroTitle"]').fill(original);
  await page.getByRole('button', { name: /Enregistrer les textes/ }).click();
  await expect(page.locator('.alert-success')).toBeVisible();
});
