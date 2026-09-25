// Appel du devis serveur (/api/checkout/quote) depuis le panier et la page de commande,
// et mémorisation du code promo saisi pour la durée de la visite.
import type { CartItem } from './cart';

export type QuoteLine = {
  productId: string;
  variantId: string;
  productName: string;
  variantLabel: string;
  name: string;
  slug: string;
  color: string;
  brandName: string;
  image: string | null;
  unitPrice: number;
  publicPrice: number;
  quantity: number;
};

export type QuoteResponse = {
  lines: QuoteLine[];
  problems: string[];
  totals: { subtotal: number; discount: number; delivery: number; total: number };
  promo: { code: string | null; applied: boolean; message: string } | null;
  pro: boolean;
  freeThreshold: number;
};

const PROMO_KEY = 'afs-promo';

export function getPromo() {
  try {
    return sessionStorage.getItem(PROMO_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setPromo(code: string) {
  try {
    if (code) sessionStorage.setItem(PROMO_KEY, code);
    else sessionStorage.removeItem(PROMO_KEY);
  } catch {
    /* stockage indisponible */
  }
}

export async function fetchQuote(items: CartItem[], options: { promoCode?: string; zoneId?: string } = {}): Promise<QuoteResponse | null> {
  try {
    const res = await fetch('/api/checkout/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: items.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })),
        promoCode: options.promoCode,
        zoneId: options.zoneId,
      }),
    });
    return res.ok ? ((await res.json()) as QuoteResponse) : null;
  } catch {
    return null;
  }
}
