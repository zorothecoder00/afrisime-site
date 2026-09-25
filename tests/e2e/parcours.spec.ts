// Parcours critiques de la recette (§21). Base locale ou de CI avec le contenu de départ
// importé (npm run content:import) et PAYMENT_PROVIDER=simulation.
import { expect, test } from '@playwright/test';
import { addFirstProduct, dismissConsent, fillCheckout, submitOrder } from './helpers';

test('REC-01 navigation : les menus principaux mènent aux pages @mobile', async ({ page, isMobile }) => {
  await page.goto('/');
  await dismissConsent(page);
  await expect(page.locator('main h1')).toBeVisible();
  if (isMobile) {
    await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
    await page.locator('#menu-mobile').getByRole('link', { name: 'Boutique', exact: true }).click();
  } else {
    await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Boutique', exact: true }).click();
  }
  await expect(page).toHaveURL(/\/boutique/);
  for (const path of ['/afrisime', '/activites', '/b2b', '/partenaires', '/media', '/faq', '/contact', '/legal/cgv']) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
  }
  expect((await page.goto('/page-inexistante'))?.status()).toBe(404);
});

test('REC-02 recherche : produit trouvé malgré une faute, état utile sans résultat', async ({ page }) => {
  await page.goto('/boutique?q=hulie');
  await dismissConsent(page);
  await expect(page.locator('[data-product]:visible').first()).toBeVisible();
  await page.goto('/boutique?q=zzzproduitinexistant');
  await expect(page.getByRole('heading', { name: 'Aucun produit ne correspond' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Demander ce produit' })).toBeVisible();
});

test('REC-03 fiche produit : prix, disponibilité, données structurées', async ({ page }) => {
  await page.goto('/boutique?q=riz');
  await dismissConsent(page);
  await page.locator('[data-product]:visible h3 a').first().click();
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.locator('[data-price-display]')).toContainText('FCFA');
  await expect(page.getByText(/Disponible|Sur commande|indisponible|Sur devis/).first()).toBeVisible();
  const jsonLd = await page.locator('script[type="application/ld+json"]').allInnerTexts();
  expect(jsonLd.join()).toContain('"@type":"Product"');
});

test('REC-04/05 panier et commande à la livraison : total juste, numéro unique @mobile', async ({ page }) => {
  await addFirstProduct(page);
  await page.goto('/panier');
  const line = page.locator('[data-lines] li').first();
  await line.getByRole('button', { name: 'Augmenter' }).click();
  await expect(line.locator('[data-qty]')).toHaveValue('2');
  const unit = Number((await line.locator('[data-unit-price]').innerText()).replace(/\D/g, ''));
  const expected = `${new Intl.NumberFormat('fr-FR').format(unit * 2).replace(/\s/g, ' ')} FCFA`;
  await expect(page.locator('[data-subtotal]')).toHaveText(expected);

  await fillCheckout(page, { zone: /Retrait au dépôt/, payment: /Paiement à la livraison/ });
  await submitOrder(page);
  await expect(page).toHaveURL(/\/commande\/confirmation\?n=AFS-/);
  await expect(page.getByRole('heading', { name: /commande est confirmée/ })).toBeVisible();
  await expect(page.getByText(/^AFS-\d{8}-[A-Z0-9]{6}$/)).toBeVisible();
  // Le panier est vidé après la commande.
  await page.goto('/panier');
  await expect(page.getByRole('heading', { name: 'Votre panier est vide' })).toBeVisible();
});

test('Panier : seuls les articles cochés sont commandés, les autres restent', async ({ page }) => {
  await page.goto('/boutique');
  await dismissConsent(page);
  const buttons = page.locator('[data-product]:visible [data-add-to-cart]');
  await buttons.nth(0).click();
  await buttons.nth(1).click();
  await page.goto('/panier');
  await expect(page.locator('[data-lines] li')).toHaveCount(2);
  const kept = (await page.locator('[data-lines] li').nth(1).locator('[data-name]').innerText()).trim();
  await page.locator('[data-select-line]').nth(1).uncheck();
  await expect(page.locator('[data-checkout-count]').first()).toHaveText('1');

  await fillCheckout(page, { zone: /Retrait au dépôt/, payment: /Paiement à la livraison/ });
  await expect(page.locator('[data-summary-lines] li')).toHaveCount(1);
  await submitOrder(page);
  await expect(page).toHaveURL(/\/commande\/confirmation/);
  await page.goto('/panier');
  await expect(page.locator('[data-lines] li')).toHaveCount(1);
  await expect(page.locator('[data-lines] [data-name]')).toHaveText(kept);
});

test('REC-06 paiement en ligne : échec puis succès, sans double commande', async ({ page }) => {
  await addFirstProduct(page);
  await fillCheckout(page, { zone: /Lomé centre/, payment: /^Mobile Money/ });
  await submitOrder(page);

  await expect(page).toHaveURL(/\/commande\/paiement\/simulation/);
  await page.getByRole('button', { name: 'Simuler un échec' }).click();
  await expect(page.getByText("Le paiement n'a pas abouti")).toBeVisible();
  const url = page.url();
  const number = new URL(url).searchParams.get('n');

  await page.getByRole('button', { name: 'Réessayer le paiement' }).click();
  await page.getByRole('button', { name: 'Simuler un paiement réussi' }).click();
  await expect(page.getByText('Paiement reçu')).toBeVisible();
  await expect(page.getByText(number!).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /commande est confirmée/ })).toBeVisible();
});

test('REC-07 B2B : la demande de devis crée un lead', async ({ page }) => {
  await page.goto('/b2b#devis');
  await dismissConsent(page);
  const form = page.locator('form[data-lead-form]').first();
  await form.getByLabel('Entreprise / établissement').fill('Superette E2E');
  await form.getByLabel('Secteur').selectOption({ index: 1 });
  await form.getByLabel('Nom du contact').fill('Contact E2E');
  await form.getByLabel('Téléphone').fill('90 00 00 01');
  await form.getByLabel('Ville / quartier').fill('Lomé');
  await form.getByLabel('Produits et volumes souhaités').fill('20 sacs de riz 50 kg par mois');
  await form.getByLabel(/J'accepte/).check();
  await form.getByRole('button', { name: /Envoyer ma demande/ }).click();
  await expect(form.locator('[data-form-status]')).toContainText('Merci');
});

test('REC-10 SEO : sitemap, robots, balises', async ({ page, request }) => {
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBeTruthy();
  expect(await sitemap.text()).toContain('/boutique/');
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Sitemap:');
  expect(robots).toContain('Disallow: /admin');
  await page.goto('/');
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
});

test('REC-11 sécurité : espaces privés protégés, requêtes forgées refusées', async ({ page, request }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/compte\/connexion/);
  const forged = await request.post('/api/orders', { data: {}, headers: { Origin: 'https://site-malveillant.example' } });
  expect(forged.status()).toBe(403);
  const erp = await request.post('/api/erp/order-status', { data: { number: 'X', status: 'livree' } });
  expect([401, 503]).toContain(erp.status());
  // Aucun secret dans le code envoyé au navigateur.
  await page.goto('/');
  const html = await page.content();
  expect(html).not.toMatch(/BETTER_AUTH_SECRET|DATABASE_URL|sk_live|sk_sandbox/);
});
