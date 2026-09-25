// Tâche planifiée (Vercel Cron, voir vercel.json) : GET /api/cron/sync
// Authorization: Bearer <CRON_SECRET> (ajouté automatiquement par Vercel Cron).
//
//  1. Revérifie les paiements restés « en attente » (webhook perdu).
//  2. Renvoie à l'ERP les commandes confirmées non transmises, au CRM les leads non transmis.
//  3. Annule les commandes à payer en ligne restées impayées plus de UNPAID_CANCEL_HOURS.
//  4. Purge les compteurs anti-abus et le vieux journal de recherches.
import type { APIRoute } from 'astro';
import { CRON_SECRET } from 'astro:env/server';
import { and, eq, inArray, isNull, lt, notInArray, sql } from 'drizzle-orm';
import { timingSafeEqual } from 'node:crypto';
import { apiRateLimit, leads, orders, searchLog } from '../../../db/schema';
import { audit } from '../../../lib/audit';
import { db } from '../../../lib/db';
import { sendLeadToCrm, type Lead } from '../../../lib/integrations';
import { afterStatusChange, pushOrderToErp, setOrderStatus } from '../../../lib/orders';
import { ONLINE_METHODS, refreshStalePayments } from '../../../lib/payments/service';
import { json } from '../../../lib/server';

const UNPAID_CANCEL_HOURS = 72;
const BATCH = 50;

function authorized(request: Request) {
  if (!CRON_SECRET) return false;
  const given = Buffer.from(request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '');
  const expected = Buffer.from(CRON_SECRET);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export const GET: APIRoute = async ({ request }) => {
  if (!CRON_SECRET) return json({ error: 'CRON_SECRET non configuré.' }, 503);
  if (!authorized(request)) return json({ error: 'Non autorisé.' }, 401);
  const report: Record<string, unknown> = {};

  report.payments = await refreshStalePayments();

  const erpPending = await db
    .select()
    .from(orders)
    .where(and(isNull(orders.erpSyncedAt), notInArray(orders.status, ['en-attente-paiement', 'annulee'])))
    .limit(BATCH);
  let erpSent = 0;
  for (const row of erpPending) if (await pushOrderToErp(row)) erpSent++;
  report.erp = { pending: erpPending.length, sent: erpSent };

  const crmPending = await db.select().from(leads).where(isNull(leads.crmSyncedAt)).limit(BATCH);
  let crmSent = 0;
  for (const row of crmPending) {
    const lead: Lead = {
      id: row.id,
      type: row.type as Lead['type'],
      source: row.source,
      name: row.name,
      phone: row.phone ?? undefined,
      email: row.email ?? undefined,
      company: row.company ?? undefined,
      need: row.need,
      details: row.details,
      consent: row.consent,
      createdAt: row.createdAt.toISOString(),
    };
    try {
      if (await sendLeadToCrm(lead)) {
        await db.update(leads).set({ crmSyncedAt: new Date() }).where(eq(leads.id, row.id));
        crmSent++;
      } else break; // CRM non configuré : inutile d'essayer les suivants
    } catch (err) {
      console.error(err);
    }
  }
  report.crm = { pending: crmPending.length, sent: crmSent };

  const stale = await db
    .select({ id: orders.id, number: orders.number })
    .from(orders)
    .where(
      and(
        eq(orders.status, 'en-attente-paiement'),
        inArray(orders.paymentMethod, ONLINE_METHODS),
        lt(orders.createdAt, new Date(Date.now() - UNPAID_CANCEL_HOURS * 3600_000)),
      ),
    )
    .limit(BATCH);
  for (const o of stale) {
    if (await setOrderStatus(o.id, 'annulee', { source: 'site', from: 'en-attente-paiement', note: `Annulée automatiquement : non payée sous ${UNPAID_CANCEL_HOURS} h` })) {
      await afterStatusChange(o.number);
    }
  }
  report.cancelledUnpaid = stale.length;

  await db.delete(apiRateLimit).where(lt(apiRateLimit.windowStart, sql`now() - interval '1 day'`));
  await db.delete(searchLog).where(lt(searchLog.createdAt, sql`now() - interval '1 year'`));

  await audit({ action: 'tache-planifiee', details: report });
  return json({ ok: true, ...report });
};
