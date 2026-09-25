// Prestataires de paiement en ligne. Choisi par PAYMENT_PROVIDER :
//   fedapay     : FedaPay (Mobile Money T-Money / Flooz et carte, Togo). Clés FEDAPAY_SECRET_KEY, FEDAPAY_ENV.
//   simulation  : faux prestataire pour le développement local uniquement.
// Pour un autre prestataire (CinetPay, PayDunya…), ajouter un objet respectant `PaymentProvider`.
import { FEDAPAY_ENV, FEDAPAY_SECRET_KEY, PAYMENT_PROVIDER } from 'astro:env/server';
import type { payments } from '../../db/schema';

export type PaymentState = 'en-attente' | 'reussi' | 'echoue' | 'annule';
type PaymentRow = typeof payments.$inferSelect;

export type CheckoutRequest = {
  paymentId: string;
  orderNumber: string;
  amount: number;
  method: string;
  returnUrl: string;
  customer: { name: string; email: string; phone: string };
};

export interface PaymentProvider {
  id: string;
  label: string;
  /** Crée la transaction et renvoie l'adresse de la page de paiement du prestataire. */
  createCheckout(request: CheckoutRequest): Promise<{ providerRef: string; redirectUrl: string; raw?: Record<string, unknown> }>;
  /** Interroge le prestataire : seule source de vérité sur l'état du paiement. */
  fetchStatus(payment: PaymentRow): Promise<{ state: PaymentState; raw?: Record<string, unknown> }>;
}

/* ───────── FedaPay ───────── */

function fedapayBase() {
  return FEDAPAY_ENV === 'live' ? 'https://api.fedapay.com/v1' : 'https://sandbox-api.fedapay.com/v1';
}

async function fedapay(path: string, init: RequestInit = {}) {
  const res = await fetch(`${fedapayBase()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${FEDAPAY_SECRET_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok) throw new Error(`FedaPay HTTP ${res.status} : ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

const FEDAPAY_STATES: Record<string, PaymentState> = {
  approved: 'reussi',
  transferred: 'reussi',
  declined: 'echoue',
  canceled: 'annule',
  refunded: 'annule',
  expired: 'annule',
};

/** Numéro local togolais (8 chiffres) pour le formulaire FedaPay. */
function localPhone(phone: string) {
  return phone.replace(/\D/g, '').slice(-8);
}

const fedapayProvider: PaymentProvider = {
  id: 'fedapay',
  label: 'FedaPay',
  async createCheckout(req) {
    const [firstname, ...rest] = req.customer.name.trim().split(/\s+/);
    const created = await fedapay('/transactions', {
      method: 'POST',
      body: JSON.stringify({
        description: `Commande AfriSime ${req.orderNumber}`,
        amount: req.amount,
        currency: { iso: 'XOF' },
        callback_url: req.returnUrl,
        merchant_reference: req.paymentId,
        customer: {
          firstname,
          lastname: rest.join(' ') || firstname,
          email: req.customer.email,
          phone_number: { number: localPhone(req.customer.phone), country: 'tg' },
        },
      }),
    });
    const transaction = created['v1/transaction'] ?? created.transaction ?? created;
    const token = await fedapay(`/transactions/${transaction.id}/token`, { method: 'POST' });
    return { providerRef: String(transaction.id), redirectUrl: String(token.url), raw: { reference: transaction.reference } };
  },
  async fetchStatus(payment) {
    const body = await fedapay(`/transactions/${encodeURIComponent(payment.providerRef ?? '')}`);
    const transaction = body['v1/transaction'] ?? body.transaction ?? body;
    return { state: FEDAPAY_STATES[transaction.status] ?? 'en-attente', raw: { status: transaction.status } };
  },
};

/* ───────── Simulation (développement) ───────── */

const simulationProvider: PaymentProvider = {
  id: 'simulation',
  label: 'Simulation',
  async createCheckout(req) {
    return { providerRef: `SIM-${req.paymentId}`, redirectUrl: `/commande/paiement/simulation?p=${encodeURIComponent(req.paymentId)}` };
  },
  async fetchStatus(payment) {
    const state = (payment.raw as { simulated?: PaymentState } | null)?.simulated ?? 'en-attente';
    return { state };
  },
};

/** Prestataire actif, ou null si le paiement en ligne n'est pas configuré. */
export function getPaymentProvider(): PaymentProvider | null {
  if (PAYMENT_PROVIDER === 'fedapay' && FEDAPAY_SECRET_KEY) return fedapayProvider;
  // Le simulateur n'est jamais disponible sur un site de production.
  if (PAYMENT_PROVIDER === 'simulation' && import.meta.env.DEV) return simulationProvider;
  return null;
}

export function providerById(id: string): PaymentProvider | null {
  if (id === 'fedapay') return FEDAPAY_SECRET_KEY ? fedapayProvider : null;
  if (id === 'simulation') return import.meta.env.DEV ? simulationProvider : null;
  return null;
}
