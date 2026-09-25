import { describe, expect, it } from 'vitest';
import { computeTotals, deliveryFee, discountFor, type PromoRule } from '../../src/lib/pricing';
import type { DeliveryZone } from '../../src/data/site';

const centre: DeliveryZone = { id: 'lome-centre', label: 'Lomé centre', fee: 1000, delay: '24 h', freeAbove: true, active: true };
const interieur: DeliveryZone = { id: 'interieur', label: 'Intérieur', fee: 7500, delay: '3 j', freeAbove: false, active: true };
const bienvenue: PromoRule = { code: 'BIENVENUE', kind: 'pourcentage', value: 5, maxDiscount: 5000, minSubtotal: 0 };

describe('computeTotals', () => {
  it('additionne les lignes (prix × quantité)', () => {
    const t = computeTotals([
      { unitPrice: 4750, quantity: 2 },
      { unitPrice: 1200, quantity: 3 },
    ]);
    expect(t).toEqual({ subtotal: 13100, discount: 0, delivery: 0, total: 13100 });
  });

  it('ajoute les frais de la zone choisie', () => {
    expect(computeTotals([{ unitPrice: 10_000, quantity: 1 }], { zone: centre, freeThreshold: 50_000 }).total).toBe(11_000);
  });

  it('offre la livraison au-delà du seuil pour les zones concernées uniquement', () => {
    const lines = [{ unitPrice: 25_000, quantity: 2 }];
    expect(computeTotals(lines, { zone: centre, freeThreshold: 50_000 }).delivery).toBe(0);
    expect(computeTotals(lines, { zone: interieur, freeThreshold: 50_000 }).delivery).toBe(7500);
  });

  it('applique la remise avant la livraison', () => {
    const t = computeTotals([{ unitPrice: 20_000, quantity: 1 }], { zone: centre, freeThreshold: 50_000, promo: bienvenue });
    expect(t).toEqual({ subtotal: 20_000, discount: 1000, delivery: 1000, total: 20_000 });
  });

  it('ne donne jamais un total négatif', () => {
    const big: PromoRule = { code: 'X', kind: 'montant', value: 99_999, maxDiscount: null, minSubtotal: 0 };
    expect(computeTotals([{ unitPrice: 500, quantity: 1 }], { promo: big }).total).toBe(0);
  });
});

describe('discountFor', () => {
  it('plafonne une remise en pourcentage', () => {
    expect(discountFor(200_000, bienvenue)).toBe(5000);
  });
  it("respecte le montant minimum d'achat", () => {
    const rule: PromoRule = { code: 'MIN', kind: 'montant', value: 2000, maxDiscount: null, minSubtotal: 30_000 };
    expect(discountFor(29_999, rule)).toBe(0);
    expect(discountFor(30_000, rule)).toBe(2000);
  });
  it('arrondit au franc', () => {
    expect(discountFor(1999, { ...bienvenue, maxDiscount: null })).toBe(100);
  });
  it('sans code : pas de remise', () => {
    expect(discountFor(10_000, null)).toBe(0);
  });
});

describe('deliveryFee', () => {
  it('sans zone : 0', () => expect(deliveryFee(undefined, 1000, 50_000)).toBe(0));
  it('seuil à 0 : jamais offerte', () => expect(deliveryFee(centre, 1_000_000, 0)).toBe(1000));
});
