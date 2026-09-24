// Calcul des totaux, partagé par le panier (affichage) et l'API commandes (référence).
// Le montant facturé est toujours celui recalculé côté serveur.
import { DELIVERY_ZONES, FREE_DELIVERY_THRESHOLD } from '../data/site';

export type PricedLine = { unitPrice: number; quantity: number };

export type DeliveryZoneId = (typeof DELIVERY_ZONES)[number]['id'];

const FREE_DELIVERY_ZONES: DeliveryZoneId[] = ['lome-centre', 'lome-peripherie'];

// Codes promo d'exemple. En production, ils viendront du back-office.
const PROMO_CODES: Record<string, { rate: number; max: number }> = {
  BIENVENUE: { rate: 0.05, max: 5000 },
};

export function isValidPromoCode(code: string | undefined): boolean {
  return !!code && code.trim().toUpperCase() in PROMO_CODES;
}

export function computeTotals(lines: PricedLine[], zoneId?: string, promoCode?: string) {
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  const promo = promoCode ? PROMO_CODES[promoCode.trim().toUpperCase()] : undefined;
  const discount = promo ? Math.min(Math.round(subtotal * promo.rate), promo.max) : 0;

  const zone = DELIVERY_ZONES.find((z) => z.id === zoneId);
  let delivery = zone ? zone.fee : 0;
  if (zone && FREE_DELIVERY_ZONES.includes(zone.id) && subtotal >= FREE_DELIVERY_THRESHOLD) delivery = 0;

  return { subtotal, discount, delivery, total: Math.max(subtotal - discount, 0) + delivery };
}
