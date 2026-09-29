// Types de prix supplémentaires (ex. « Prix à crédit »), définis dans le back-office
// (Catalogue › Types de prix). Chaque format de produit peut avoir un prix par type
// (ProductVariant.prices) ; le client choisit le type à la commande et le serveur
// recalcule le total avec ces prix (src/lib/checkout.ts).
// Enregistrés dans la ligne `price-types` de la table `settings` : aucun par défaut.
import { eq } from 'drizzle-orm';
import { settings, type ProductVariant } from '../db/schema';
import { cached, invalidate } from './cache';
import { db } from './db';

export const PRICE_AUDIENCES = {
  tous: 'Tout le monde',
  connectes: 'Clients connectés',
  pro: 'Comptes pro validés',
} as const;
export type PriceAudience = keyof typeof PRICE_AUDIENCES;

export type PriceType = {
  /** Identifiant stable (lettres, chiffres, _), clé des prix dans les formats des produits. */
  id: string;
  label: string;
  /** Conditions affichées au client (fiche produit, commande). */
  description: string;
  audience: PriceAudience;
  /** Commande à valider par l'équipe (pas de paiement en ligne), ex. vente à crédit. */
  validation: boolean;
  position: number;
  active: boolean;
};

const KEY = 'price-types';

function isPriceType(value: unknown): value is PriceType {
  const t = value as PriceType;
  return !!t && typeof t.id === 'string' && typeof t.label === 'string' && t.audience in PRICE_AUDIENCES;
}

/** Tous les types de prix (back-office), par ordre d'affichage. */
export function listPriceTypes(): Promise<PriceType[]> {
  return cached('price-types', 60_000, async () => {
    const [row] = await db.select().from(settings).where(eq(settings.key, KEY));
    const types = Array.isArray(row?.value) ? (row.value as unknown[]).filter(isPriceType) : [];
    return types.sort((a, b) => a.position - b.position || a.label.localeCompare(b.label));
  });
}

export async function savePriceTypes(types: PriceType[], actorId: string) {
  await db
    .insert(settings)
    .values({ key: KEY, value: types, updatedBy: actorId })
    .onConflictDoUpdate({ target: settings.key, set: { value: types, updatedBy: actorId, updatedAt: new Date() } });
  invalidate('price-types');
}

/** Identifiant tiré du libellé : « Prix à crédit » → « prix_a_credit ». */
export function priceTypeId(label: string) {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

export type Viewer = { loggedIn: boolean; pro: boolean };

/** Le visiteur peut-il voir et utiliser ce type de prix ? */
export function canUsePriceType(type: PriceType, viewer: Viewer) {
  if (!type.active) return false;
  if (type.audience === 'connectes') return viewer.loggedIn;
  if (type.audience === 'pro') return viewer.pro;
  return true;
}

/** Prix d'un format pour un type donné ; undefined si le format n'a pas ce prix. */
export function typedPrice(variant: ProductVariant, typeId: string) {
  const price = variant.prices?.[typeId];
  return typeof price === 'number' && price > 0 ? price : undefined;
}
