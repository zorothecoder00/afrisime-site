// Back-office (§10, REC-09) : un compte de l'équipe se connecte avec la double authentification,
// puis chaque rubrique du back-office s'affiche sans erreur serveur.
// Le compte de test est créé directement en base avant le test et supprimé après :
// uniquement sur une base locale ou de CI.
import 'dotenv/config';
import { expect, test, type Page } from '@playwright/test';
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
  '/admin/catalogue/types-de-prix',
  '/admin/promotions',
  '/admin/contenus',
  '/admin/faq',
  '/admin/offres-emploi',
  '/admin/programmes',
  '/admin/medias',
  '/admin/diaporamas',
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

/** Connexion du compte de test (mot de passe puis code de double authentification). */
async function signIn(page: Page) {
  // Compteurs de limitation de débit : le test précédent a déjà fait des tentatives.
  await sql`delete from rate_limit where key like '%/sign-in/email' or key like '%/two-factor/%'`;
  await page.goto('/admin');
  await dismissConsent(page);
  const login = page.locator('form[data-login][data-ready]');
  await login.getByLabel('Adresse e-mail').fill(EMAIL);
  await login.getByLabel('Mot de passe').fill(password);
  await login.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/compte\/verification/);
  const verify = page.locator('form[data-verify][data-ready]');
  await verify.getByLabel('Code à 6 chiffres').fill(await createOTP(totpSecret, { period: 30, digits: 6 }).totp());
  await verify.getByRole('button', { name: 'Valider' }).click();
  await expect(page).toHaveURL(/\/admin\/?$/);
}

test.afterAll(async () => {
  await sql`delete from audit_log where target = ${USER_ID}`;
  await sql`delete from notifications where target = ${USER_ID}`;
  await sql`delete from "user" where id = ${USER_ID}`;
  await sql.end();
});

test('REC-09 back-office : double authentification, alerte de sécurité, toutes les rubriques s’affichent', async ({ page }) => {
  test.setTimeout(120_000);
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

  // Offres d'emploi : une offre publiée apparaît sur Carrières et dans le formulaire, puis est supprimée.
  const job = `Poste E2E ${Date.now()}`;
  await page.goto('/admin/offres-emploi');
  const create = page.locator('form', { has: page.getByRole('button', { name: "Ajouter l'offre" }) });
  await create.locator('input[name="title"]').fill(job);
  await create.locator('input[name="place"]').fill('Lomé');
  await create.getByRole('button', { name: "Ajouter l'offre" }).click();
  await expect(page.locator('.alert-success')).toBeVisible();
  await page.goto('/carrieres');
  await expect(page.getByRole('heading', { name: job })).toBeVisible();
  await expect(page.locator('select[name="poste"] option', { hasText: job })).toHaveCount(1);

  await page.goto('/admin/offres-emploi');
  const item = page.locator('details', { hasText: job });
  await item.locator('summary').click();
  page.once('dialog', (d) => d.accept());
  await item.getByRole('button', { name: 'Supprimer' }).click();
  await expect(page.locator('.alert-success')).toBeVisible();
  await expect(page.locator('details', { hasText: job })).toHaveCount(0);

  // Programmes & projets : une fiche créée dans le back-office s'affiche dans sa section, change de statut,
  // disparaît une fois masquée, puis est supprimée.
  const programme = `Programme E2E ${Date.now()}`;
  await page.goto('/admin/programmes');
  const newProject = page.locator('form', { has: page.getByRole('button', { name: 'Ajouter', exact: true }) });
  await newProject.locator('select[name="kind"]').selectOption('programme');
  await newProject.locator('input[name="title"]').fill(programme);
  await newProject.locator('input[name="place"]').fill('Région des Plateaux');
  await newProject.locator('input[name="summary"]').fill('Résumé du programme E2E');
  await newProject.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(page.locator('.alert-success')).toBeVisible();

  await page.goto('/programmes');
  const card = page.locator('#programmes article', { has: page.getByRole('heading', { name: programme }) });
  await expect(card).toContainText('En cours');
  await expect(card).toContainText('Région des Plateaux');

  await page.goto('/admin/programmes');
  const fiche = page.locator('details', { hasText: programme });
  await fiche.locator('summary').click();
  await fiche.locator('select[name="status"]').selectOption('termine');
  await fiche.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.locator('.alert-success')).toBeVisible();
  await page.goto('/programmes');
  await expect(page.locator('#programmes article', { has: page.getByRole('heading', { name: programme }) })).toContainText('Terminé');

  await page.goto('/admin/programmes');
  await fiche.locator('summary').click();
  await fiche.locator('input[name="published"]').uncheck();
  await fiche.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.locator('.alert-success')).toBeVisible();
  await page.goto('/programmes');
  await expect(page.getByRole('heading', { name: programme })).toHaveCount(0);

  await page.goto('/admin/programmes');
  await fiche.locator('summary').click();
  page.once('dialog', (d) => d.accept());
  await fiche.getByRole('button', { name: 'Supprimer' }).click();
  await expect(page.locator('.alert-success')).toBeVisible();
  await expect(page.locator('details', { hasText: programme })).toHaveCount(0);

  // API du back-office (même session) : création, lecture, modification partielle, suppression.
  const api = page.request;
  const created = await api.post('/api/admin/programmes', { data: { kind: 'projet', title: `Projet API E2E ${Date.now()}`, status: 'a-venir' } });
  expect(created.status()).toBe(201);
  const { item: apiProject } = await created.json();
  expect(apiProject).toMatchObject({ kind: 'projet', status: 'a-venir', published: true });
  expect((await api.post('/api/admin/programmes', { data: { title: 'AB' } })).status()).toBe(422);
  expect((await (await api.get('/api/admin/programmes')).json()).items.some((p: { id: string }) => p.id === apiProject.id)).toBe(true);
  const patched = await api.patch(`/api/admin/programmes/${apiProject.id}`, { data: { status: 'en-cours', published: false } });
  expect((await patched.json()).item).toMatchObject({ id: apiProject.id, title: apiProject.title, status: 'en-cours', published: false });
  // Comme un navigateur : un DELETE sans Origin ni Content-Type est refusé par la protection CSRF d'Astro.
  expect((await api.delete(`/api/admin/programmes/${apiProject.id}`, { headers: { origin: new URL(page.url()).origin } })).status()).toBe(200);
  expect((await api.get(`/api/admin/programmes/${apiProject.id}`)).status()).toBe(404);

  // Diaporamas : deux images envoyées, affichées sur Carrières en défilement automatique, puis supprimées.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const show = `Diaporama E2E ${Date.now()}`;
  await page.goto('/admin/diaporamas');
  const creation = page.locator('details', { has: page.locator(':scope > summary', { hasText: '+ Nouveau diaporama' }) });
  await creation.evaluate((d: HTMLDetailsElement) => (d.open = true));
  await creation.locator('input[name="title"]').fill(show);
  await creation.locator('select[name="placement"]').selectOption('carrieres');
  await creation.locator('select[name="mode"]').selectOption('defilement');
  await creation.locator('input[name="interval"]').fill('2');
  await creation.locator('input[name="files"]').setInputFiles([
    { name: 'e2e-1.png', mimeType: 'image/png', buffer: png },
    { name: 'e2e-2.png', mimeType: 'image/png', buffer: png },
  ]);
  await creation.getByRole('button', { name: 'Créer le diaporama' }).click();
  await expect(page.locator('.alert-success')).toBeVisible();

  await page.goto('/carrieres');
  const slideshow = page.locator('[data-slideshow]', { has: page.getByRole('heading', { name: show }) });
  await expect(slideshow.locator('[data-track] > li')).toHaveCount(2);
  await expect(slideshow.locator('[data-track]')).toHaveAttribute('style', /translateX\(-100%\)/, { timeout: 5000 });

  await page.goto('/admin/diaporamas');
  const saved = page.locator('details', { has: page.locator(':scope > summary', { hasText: show }) });
  await saved.evaluate((d: HTMLDetailsElement) => (d.open = true));
  page.once('dialog', (d) => d.accept());
  await saved.getByRole('button', { name: 'Supprimer' }).click();
  await expect(page.locator('.alert-success')).toBeVisible();
  await expect(saved).toHaveCount(0);

  // Médiathèque : plusieurs images envoyées d'un coup (une requête par image).
  await page.goto('/admin/medias');
  await page.locator('[data-media-upload] input[type="file"]').setInputFiles(
    ['e2e-a.png', 'e2e-b.png', 'e2e-c.png'].map((name) => ({ name, mimeType: 'image/png', buffer: png })),
  );
  await page.getByRole('button', { name: 'Envoyer les 3 images' }).click();
  await expect(page.getByText('3 image(s) ajoutée(s).')).toBeVisible();

  // Les images de test sont retirées de la médiathèque (elles ne sont plus utilisées).
  for (const name of ['e2e-1.png', 'e2e-2.png', 'e2e-a.png', 'e2e-b.png', 'e2e-c.png']) {
    page.once('dialog', (d) => d.accept());
    // Attendre le rechargement : le message de succès de la suppression précédente est encore affiché.
    const reloaded = page.waitForEvent('load');
    await page.locator('li', { hasText: name }).first().getByRole('button', { name: 'Supprimer' }).click();
    await reloaded;
    await expect(page.locator('.alert-success')).toBeVisible();
  }
});

// Types de prix (Catalogue › Types de prix) : un type « à valider » créé et modifié dans le back-office,
// ses montants saisis sur un produit, affichés sur la fiche, choisis à la commande (total recalculé,
// pas de paiement), commande « À valider » dans le back-office puis annulée ; tout est retiré à la fin.
test('Types de prix : création, prix du produit, fiche, commande à valider, suppression', async ({ page }) => {
  test.setTimeout(120_000);
  const [product] = await sql<{ id: string; slug: string; variants: { id: string; price: number }[] }[]>`
    select id, slug, variants from products
    where published and status in ('disponible', 'sur-commande') order by name limit 1`;
  const label = `Crédit E2E ${Date.now()}`;
  // Identifiant tiré du nom, comme src/lib/price-types.ts (priceTypeId).
  const typeId = label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  try {
    await signIn(page);

    // 1. Création puis modification du type de prix.
    await page.goto('/admin/catalogue/types-de-prix');
    const create = page.locator('form', { has: page.getByRole('button', { name: 'Ajouter le type de prix' }) });
    await create.locator('input[name="label"]').fill(label);
    await create.locator('textarea[name="description"]').fill('Paiement en 3 fois.');
    await create.locator('input[name="validation"]').check();
    await create.getByRole('button', { name: 'Ajouter le type de prix' }).click();
    await expect(page.locator('.alert-success')).toBeVisible();

    const type = page.locator('details', { hasText: label });
    await type.locator('summary').click();
    await type.locator('textarea[name="description"]').fill('Paiement en 3 mensualités après étude du dossier.');
    await type.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('.alert-success')).toBeVisible();
    await expect(page.locator('details', { hasText: label }).locator('summary')).toContainText('commande à valider');

    // 2. Montants saisis sur chaque format du produit (colonne du type).
    await page.goto(`/admin/catalogue/produits/${product.id}`);
    for (const [i, v] of product.variants.entries()) await page.locator(`input[name="variants[${i}][tp_${typeId}]"]`).fill(String(v.price + 1000));
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(page.locator('.alert-success')).toBeVisible();
    const [saved] = await sql<{ variants: { prices?: Record<string, number> }[] }[]>`select variants from products where id = ${product.id}`;
    expect(saved.variants.map((v) => v.prices?.[typeId])).toEqual(product.variants.map((v) => v.price + 1000));

    // 3. Fiche produit : le prix du type et ses conditions sont affichés.
    await page.goto(`/boutique/${product.slug}`);
    const typePrices = page.locator('[data-type-prices-box]');
    await expect(typePrices).toBeVisible();
    await expect(typePrices).toContainText(label);
    await expect(typePrices).toContainText('3 mensualités');

    // 4. Commande : le type est proposé, le total est recalculé et le paiement disparaît.
    await page.getByRole('button', { name: 'Ajouter au panier' }).click();
    await expect(page.locator('#afs-toast')).toContainText('ajouté');
    await page.goto('/commande');
    const form = page.locator('form[data-checkout-form]');
    const typeChoice = form.getByRole('radio', { name: new RegExp(label) });
    await expect(typeChoice).toBeVisible();
    const total = page.locator('[data-total]');
    await expect(total).not.toBeEmpty();
    const normalTotal = await total.innerText();
    await typeChoice.check();
    await expect(total).not.toHaveText(normalTotal);
    await expect(form.locator('[data-payment-methods]')).toBeHidden();
    await expect(form.locator('[data-validation-note]')).toContainText('rien à payer');

    await form.getByLabel('Nom complet').fill('Client Crédit E2E');
    await form.getByLabel('Téléphone').fill('90 11 22 33');
    await form.getByLabel('E-mail').fill('e2e-credit@exemple.tg');
    await form.getByRole('radio', { name: /Retrait au dépôt/ }).check();
    await form.getByLabel(/J'accepte les conditions générales de vente/).check();
    await page.locator('[data-submit]:visible').last().click();

    await expect(page).toHaveURL(/\/commande\/confirmation\?n=AFS-/);
    await expect(page.getByRole('heading', { name: 'Commande enregistrée' })).toBeVisible();
    await expect(page.getByText(label)).toBeVisible();
    await expect(page.getByText('À convenir avec AfriSime')).toBeVisible();
    const number = new URL(page.url()).searchParams.get('n')!;
    const cheapest = Math.min(...product.variants.map((v) => v.price));
    const [order] = await sql<{ status: string; price_type: string; total: number }[]>`select status, price_type, total from orders where number = ${number}`;
    expect(order).toMatchObject({ status: 'a-valider', price_type: typeId, total: cheapest + 1000 });

    // 5. Back-office : commande « À valider » avec son type de prix, puis annulée.
    await page.goto(`/admin/commandes/${number}`);
    await expect(page.locator('main')).toContainText(label);
    await expect(page.locator('main')).toContainText('À valider');
    await page.locator('select[name="status"]').selectOption('annulee');
    await page.locator('form', { has: page.locator('select[name="status"]') }).getByRole('button', { name: 'Enregistrer' }).click();
    await expect.poll(async () => (await sql`select status from orders where number = ${number}`)[0].status).toBe('annulee');

    // 6. Suppression du type : il disparaît du back-office et de la fiche produit.
    await page.goto('/admin/catalogue/types-de-prix');
    const item = page.locator('details', { hasText: label });
    await item.locator('summary').click();
    page.once('dialog', (d) => d.accept());
    await item.getByRole('button', { name: 'Supprimer' }).click();
    await expect(page.locator('.alert-success')).toBeVisible();
    await expect(page.locator('details', { hasText: label })).toHaveCount(0);
    await page.goto(`/boutique/${product.slug}`);
    await expect(page.locator('[data-type-prices-box]')).toBeHidden();
  } finally {
    // Base locale remise en état même si le test échoue : formats du produit et type de prix.
    await sql`update products set variants = ${sql.json(product.variants)} where id = ${product.id}`;
    const [row] = await sql<{ value: { id: string }[] }[]>`select value from settings where key = 'price-types'`;
    if (row) await sql`update settings set value = ${sql.json(row.value.filter((t) => t.id !== typeId))} where key = 'price-types'`;
  }
});
