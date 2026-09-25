// Connecteurs vers les systèmes internes (ERP AfriGes, CRM). Serveur uniquement.
//
// Commandes et leads sont d'abord enregistrés en base ; tant que les variables
// d'environnement ne sont pas définies, l'envoi est seulement journalisé.
// Pour activer une intégration : CRM_API_URL, CRM_API_TOKEN, ERP_API_URL, ERP_API_TOKEN.
// Les éléments non transmis sont renvoyés automatiquement par la tâche planifiée
// (src/pages/api/cron/sync.ts).
import { CRM_API_TOKEN, CRM_API_URL, ERP_API_TOKEN, ERP_API_URL } from 'astro:env/server';

export type LeadType = 'b2b' | 'fournisseur' | 'partenaire' | 'contact' | 'newsletter' | 'investisseur' | 'candidature' | 'reclamation';

export type Lead = {
  id: string;
  type: LeadType;
  source: string;
  name: string;
  phone?: string;
  email?: string;
  company?: string;
  need: string;
  details: Record<string, string>;
  consent: boolean;
  createdAt: string;
};

export type OrderLine = { sku: string; productId: string; variantId: string; name: string; unitPrice: number; quantity: number };

export type Order = {
  number: string;
  status: 'en-attente-paiement' | 'confirmee' | 'en-preparation' | 'expediee' | 'livree' | 'annulee';
  customer: { name: string; phone: string; email: string; city: string; address: string };
  lines: OrderLine[];
  deliveryZone: string;
  paymentMethod: string;
  totals: { subtotal: number; discount: number; delivery: number; total: number };
  createdAt: string;
  paidAt?: string | null;
};

/** Renvoie `true` si les données ont été transmises, `false` si l'intégration n'est pas configurée. */
async function post(baseUrl: string | undefined, token: string | undefined, path: string, body: unknown, label: string) {
  if (!baseUrl) {
    console.info(`[integration:${label}] non configurée, données conservées en base.`);
    return false;
  }
  const res = await fetch(new URL(path, baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`[integration:${label}] HTTP ${res.status}`);
  return true;
}

export function crmConfigured() {
  return !!CRM_API_URL;
}

export function erpConfigured() {
  return !!ERP_API_URL;
}

export async function sendLeadToCrm(lead: Lead) {
  return post(CRM_API_URL, CRM_API_TOKEN, '/leads', lead, 'crm');
}

export async function sendOrderToErp(order: Order) {
  return post(ERP_API_URL, ERP_API_TOKEN, '/orders', order, 'erp');
}
