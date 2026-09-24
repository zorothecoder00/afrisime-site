// Connecteurs vers les systèmes internes (ERP AfriGes, CRM, notifications).
// Serveur uniquement : aucun secret n'est exposé au navigateur.
//
// Tant que les variables d'environnement ne sont pas définies, les données sont
// seulement journalisées. Pour activer une intégration, renseigner dans .env :
//   CRM_API_URL, CRM_API_TOKEN, ERP_API_URL, ERP_API_TOKEN

export type Lead = {
  id: string;
  type: 'b2b' | 'fournisseur' | 'partenaire' | 'contact' | 'newsletter' | 'investisseur' | 'candidature';
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
  status: 'en-attente-paiement' | 'confirmee';
  customer: { name: string; phone: string; email: string; city: string; address: string };
  lines: OrderLine[];
  deliveryZone: string;
  paymentMethod: string;
  totals: { subtotal: number; discount: number; delivery: number; total: number };
  createdAt: string;
};

async function post(baseUrl: string | undefined, token: string | undefined, path: string, body: unknown, label: string) {
  if (!baseUrl) {
    console.info(`[integration:${label}] non configurée, données reçues :`, JSON.stringify(body));
    return;
  }
  const res = await fetch(new URL(path, baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`[integration:${label}] HTTP ${res.status}`);
}

export async function sendLeadToCrm(lead: Lead) {
  await post(import.meta.env.CRM_API_URL, import.meta.env.CRM_API_TOKEN, '/leads', lead, 'crm');
}

export async function sendOrderToErp(order: Order) {
  await post(import.meta.env.ERP_API_URL, import.meta.env.ERP_API_TOKEN, '/orders', order, 'erp');
}

export async function notifyCustomer(order: Order) {
  // À brancher sur le prestataire retenu (e-mail, SMS, WhatsApp Business).
  console.info(`[notification] commande ${order.number} → ${order.customer.phone}`);
}
