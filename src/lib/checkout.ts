// Devis serveur d'un panier : prix du catalogue (prix pro pour les comptes validés),
// code promo, frais de livraison. Utilisé par le panier, la page de commande et
// l'enregistrement des commandes : un seul calcul fait foi.
import { canBuyOnline, getCatalog, unitPriceFor } from './catalog';
import { computeTotals } from './pricing';
import { checkPromo } from './promotions';
import { activeZones, getSettings } from './settings';

export const MAX_LINES = 100;
export const MAX_QTY = 999;

export type QuotedLine = {
  sku: string;
  productId: string;
  variantId: string;
  name: string;
  productName: string;
  variantLabel: string;
  slug: string;
  color: string;
  /** Marque (regroupement des lignes dans le panier). */
  brandName: string;
  image: string | null;
  unitPrice: number;
  publicPrice: number;
  quantity: number;
};

export function isValidatedPro(user: { accountType?: string | null; proStatus?: string | null } | null | undefined) {
  return !!user && user.accountType === 'pro' && user.proStatus === 'valide';
}

export async function quote(input: {
  items: unknown;
  zoneId?: unknown;
  promoCode?: unknown;
  user?: { accountType?: string | null; proStatus?: string | null } | null;
}) {
  const [{ products, categoryOf, brandOf }, settings] = await Promise.all([getCatalog(), getSettings()]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const pro = isValidatedPro(input.user);
  const lines: QuotedLine[] = [];
  const problems: string[] = [];
  let invalid = false;

  for (const entry of Array.isArray(input.items) ? input.items.slice(0, MAX_LINES) : []) {
    const product = byId.get(String(entry?.productId));
    const variant = product?.data.variants.find((v) => v.id === String(entry?.variantId));
    const quantity = Math.floor(Number(entry?.quantity));
    if (!product || !variant || !(quantity >= 1 && quantity <= MAX_QTY)) {
      invalid = true;
      problems.push('Un article du panier n’existe plus et a été retiré.');
      continue;
    }
    if (!canBuyOnline(product)) {
      problems.push(`« ${product.data.name} » ne peut plus être commandé en ligne et a été retiré.`);
      continue;
    }
    if (lines.some((l) => l.productId === product.id && l.variantId === variant.id)) continue;
    lines.push({
      sku: `${product.data.sku}-${variant.id}`,
      productId: product.id,
      variantId: variant.id,
      name: `${product.data.name} – ${variant.label}`,
      productName: product.data.name,
      variantLabel: variant.label,
      slug: product.slug,
      color: categoryOf(product).data.color,
      brandName: brandOf(product).data.name,
      image: product.data.images[0]?.id ?? null,
      unitPrice: unitPriceFor(variant, pro),
      publicPrice: variant.price,
      quantity,
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const promoCheck = await checkPromo(input.promoCode, subtotal);
  const zones = activeZones(settings);
  const zone = zones.find((z) => z.id === input.zoneId);
  const totals = computeTotals(lines, {
    zone,
    freeThreshold: settings.delivery.freeThreshold,
    promo: promoCheck?.ok ? promoCheck.rule : null,
  });

  return {
    lines,
    problems,
    /** Au moins une ligne était inconnue ou mal formée (≠ simplement retirée de la vente). */
    invalid,
    pro,
    zone,
    totals,
    freeThreshold: settings.delivery.freeThreshold,
    promo: promoCheck
      ? promoCheck.ok
        ? { code: promoCheck.rule.code, applied: true, message: promoCheck.description || `Code ${promoCheck.rule.code} appliqué.` }
        : { code: null, applied: false, message: promoCheck.message }
      : null,
  };
}

export type Quote = Awaited<ReturnType<typeof quote>>;
