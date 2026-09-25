// Calcul des totaux (fonctions pures, testées dans tests/unit/pricing.test.ts).
// Le montant facturé est toujours recalculé côté serveur (src/lib/checkout.ts).
import type { DeliveryZone } from '../data/site';

export type PricedLine = { unitPrice: number; quantity: number };

export type PromoRule = {
  code: string;
  kind: 'pourcentage' | 'montant';
  /** Pourcentage (5 = 5 %) ou montant en FCFA. */
  value: number;
  maxDiscount: number | null;
  minSubtotal: number;
};

export function discountFor(subtotal: number, promo?: PromoRule | null) {
  if (!promo || subtotal < promo.minSubtotal) return 0;
  const raw = promo.kind === 'pourcentage' ? Math.round((subtotal * promo.value) / 100) : promo.value;
  const capped = promo.maxDiscount ? Math.min(raw, promo.maxDiscount) : raw;
  return Math.max(0, Math.min(capped, subtotal));
}

export function deliveryFee(zone: DeliveryZone | undefined, subtotal: number, freeThreshold: number) {
  if (!zone) return 0;
  return zone.freeAbove && freeThreshold > 0 && subtotal >= freeThreshold ? 0 : zone.fee;
}

export function computeTotals(
  lines: PricedLine[],
  options: { zone?: DeliveryZone; freeThreshold?: number; promo?: PromoRule | null } = {},
) {
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const discount = discountFor(subtotal, options.promo);
  const delivery = deliveryFee(options.zone, subtotal, options.freeThreshold ?? 0);
  return { subtotal, discount, delivery, total: Math.max(subtotal - discount, 0) + delivery };
}
