// Webhook du prestataire de paiement (POST /api/payments/webhook/fedapay).
// Le contenu reçu n'est pas cru sur parole : il sert seulement à retrouver la transaction,
// dont l'état est ensuite relu auprès du prestataire avec notre clé secrète.
import type { APIRoute } from 'astro';
import { findPaymentByRef, refreshPayment } from '../../../../lib/payments/service';
import { providerById } from '../../../../lib/payments/providers';
import { json, rateLimit } from '../../../../lib/server';

export const POST: APIRoute = async ({ params, request, clientAddress }) => {
  const provider = providerById(params.provider ?? '');
  if (!provider) return json({ error: 'Prestataire inconnu.' }, 404);
  if (!(await rateLimit(`webhook-paiement:${clientAddress}`, 300))) return json({ error: 'Trop de requêtes.' }, 429);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON invalide.' }, 400);
  }
  // FedaPay : { name: "transaction.approved", entity: { id, ... } }
  const ref = String(body?.entity?.id ?? body?.transaction?.id ?? body?.id ?? '');
  if (!ref) return json({ ok: true, ignored: true });
  const payment = await findPaymentByRef(provider.id, ref);
  if (!payment) return json({ ok: true, ignored: true });
  const state = await refreshPayment(payment);
  return json({ ok: true, state });
};
