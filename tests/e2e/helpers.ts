import { expect, type Page } from '@playwright/test';

/** Accepte ou refuse le bandeau cookies pour qu'il ne masque pas la page. */
export async function dismissConsent(page: Page) {
  const refuse = page.getByRole('button', { name: 'Refuser' });
  if (await refuse.isVisible().catch(() => false)) await refuse.click();
}

/** Ajoute au panier le premier produit achetable de la recherche, renvoie son nom. */
export async function addFirstProduct(page: Page, query = 'riz') {
  await page.goto(`/boutique?q=${encodeURIComponent(query)}`);
  await dismissConsent(page);
  const card = page.locator('[data-product]:visible').first();
  await expect(card).toBeVisible();
  const name = (await card.locator('h3').innerText()).trim();
  await card.locator('[data-add-to-cart]').click();
  await expect(page.locator('#afs-toast')).toContainText('ajouté');
  return name;
}

/** Remplit la commande jusqu'à l'étape paiement incluse. */
export async function fillCheckout(page: Page, options: { zone: RegExp; payment: RegExp }) {
  await page.goto('/commande');
  const form = page.locator('form[data-checkout-form]');
  await form.getByLabel('Nom complet').fill('Client Test E2E');
  await form.getByLabel('Téléphone').fill('90 11 22 33');
  await form.getByLabel('E-mail').fill('e2e@exemple.tg');
  await form.getByRole('button', { name: 'Continuer vers la livraison' }).click();
  await form.getByRole('radio', { name: options.zone }).check();
  const address = form.getByLabel('Adresse ou point de repère');
  if (await address.isVisible()) {
    await form.getByLabel('Ville / quartier').fill('Lomé, Tokoin');
    await address.fill('Rue du marché, maison bleue');
  }
  await form.getByRole('button', { name: 'Continuer vers le paiement' }).click();
  await form.getByRole('radio', { name: options.payment }).check();
  await form.getByLabel(/J'accepte les conditions générales de vente/).check();
}
