// Webhook ERP → site (cahier des charges §12) : l'ERP signale l'avancement d'une commande.
//
//   POST /api/erp/order-status
//   Authorization: Bearer <ERP_WEBHOOK_SECRET>
//   { "number": "AFS-20260924-ABC123", "status": "expediee", "note": "Livreur : Koffi" }
//
// L'ERP fait foi : tous les statuts sont acceptés, sans les règles d'enchaînement du back-office.
import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { orders } from '../../../db/schema';
import { audit } from '../../../lib/audit';
import { db } from '../../../lib/db';
import { erpWebhookConfigured, isErpAuthorized } from '../../../lib/erp-auth';
import { ORDER_STATUS_LABELS } from '../../../lib/format';
import { afterStatusChange, setOrderStatus, type OrderStatus } from '../../../lib/orders';
import { json, rateLimit } from '../../../lib/server';
import { clean } from '../../../lib/validation';

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!erpWebhookConfigured()) return json({ error: 'Webhook non configuré.' }, 503);
  if (!(await rateLimit(`erp-webhook:${clientAddress}`, 120))) return json({ error: 'Trop de requêtes.' }, 429);
  if (!isErpAuthorized(request)) return json({ error: 'Non autorisé.' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON invalide.' }, 400);
  }
  const number = clean(body.number, 40);
  const status = clean(body.status, 40) as OrderStatus;
  if (!(status in ORDER_STATUS_LABELS)) return json({ error: `Statut inconnu. Valeurs : ${Object.keys(ORDER_STATUS_LABELS).join(', ')}.` }, 422);

  const [order] = await db.select().from(orders).where(eq(orders.number, number)).limit(1);
  if (!order) return json({ error: 'Commande introuvable.' }, 404);
  if (order.status === status) return json({ ok: true, unchanged: true });

  await setOrderStatus(order.id, status, { source: 'erp', note: clean(body.note, 500) });
  await audit({ action: 'commande-statut-erp', target: number, details: { from: order.status, to: status }, ipAddress: clientAddress });
  await afterStatusChange(number);
  return json({ ok: true });
};
