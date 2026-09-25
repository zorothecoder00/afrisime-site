// Statistiques du back-office (§16 Analytics & KPI) calculées depuis la base :
// commerce, paniers abandonnés, leads et temps de réponse, recherches, catalogue.
import { and, count, desc, eq, gte, ne, sql } from 'drizzle-orm';
import { carts, leadEvents, leads, orderLines, orders, searchLog, user } from '../db/schema';
import { getCatalog } from './catalog';
import { db } from './db';

export const ABANDONED_AFTER_HOURS = 24;

export async function commerceStats(since: Date) {
  const inPeriod = gte(orders.createdAt, since);
  const [totals] = await db
    .select({
      orders: count(),
      revenue: sql<number>`coalesce(sum(${orders.total}) filter (where ${orders.status} <> 'annulee'), 0)`.mapWith(Number),
      valid: sql<number>`count(*) filter (where ${orders.status} <> 'annulee')`.mapWith(Number),
      cancelled: sql<number>`count(*) filter (where ${orders.status} = 'annulee')`.mapWith(Number),
      awaitingPayment: sql<number>`count(*) filter (where ${orders.status} = 'en-attente-paiement')`.mapWith(Number),
      paidOnline: sql<number>`count(*) filter (where ${orders.paidAt} is not null)`.mapWith(Number),
      withPromo: sql<number>`count(*) filter (where ${orders.promoCode} is not null)`.mapWith(Number),
      customers: sql<number>`count(distinct ${orders.customer}->>'phone')`.mapWith(Number),
    })
    .from(orders)
    .where(inPeriod);

  const byDay = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${orders.createdAt}), 'YYYY-MM-DD')`,
      orders: count(),
      revenue: sql<number>`coalesce(sum(${orders.total}) filter (where ${orders.status} <> 'annulee'), 0)`.mapWith(Number),
    })
    .from(orders)
    .where(inPeriod)
    .groupBy(sql`1`)
    .orderBy(sql`1 desc`);

  const topProducts = await db
    .select({
      name: orderLines.name,
      quantity: sql<number>`sum(${orderLines.quantity})`.mapWith(Number),
      revenue: sql<number>`sum(${orderLines.quantity} * ${orderLines.unitPrice})`.mapWith(Number),
    })
    .from(orderLines)
    .innerJoin(orders, eq(orders.id, orderLines.orderId))
    .where(and(inPeriod, ne(orders.status, 'annulee')))
    .groupBy(orderLines.name)
    .orderBy(desc(sql`2`))
    .limit(10);

  const byZone = await db
    .select({ zone: orders.deliveryZone, orders: count() })
    .from(orders)
    .where(inPeriod)
    .groupBy(orders.deliveryZone)
    .orderBy(desc(count()));

  return { ...totals, averageBasket: totals.valid ? Math.round(totals.revenue / totals.valid) : 0, byDay, topProducts, byZone };
}

/**
 * Paniers abandonnés : panier sauvegardé d'un client connecté, non vide, sans mise à jour
 * depuis 24 h et sans commande passée depuis. (Les paniers des visiteurs anonymes restent
 * dans leur navigateur : ils sont mesurés par l'outil d'analytics, événement begin_checkout.)
 */
export async function abandonedCarts(limit = 50) {
  const cutoff = new Date(Date.now() - ABANDONED_AFTER_HOURS * 3600_000);
  const rows = await db
    .select({ userId: carts.userId, items: carts.items, updatedAt: carts.updatedAt, name: user.name, email: user.email, phone: user.phone })
    .from(carts)
    .innerJoin(user, eq(user.id, carts.userId))
    .where(
      and(
        sql`jsonb_array_length(${carts.items}) > 0`,
        sql`${carts.updatedAt} < ${cutoff}`,
        sql`not exists (select 1 from ${orders} where ${orders.userId} = ${carts.userId} and ${orders.createdAt} > ${carts.updatedAt})`,
      ),
    )
    .orderBy(desc(carts.updatedAt))
    .limit(limit);
  const { products } = await getCatalog({ includeUnpublished: true });
  const byId = new Map(products.map((p) => [p.id, p]));
  return rows.map((r) => ({
    ...r,
    value: r.items.reduce((sum, i) => sum + (byId.get(i.productId)?.data.variants.find((v) => v.id === i.variantId)?.price ?? 0) * i.quantity, 0),
    count: r.items.reduce((n, i) => n + i.quantity, 0),
  }));
}

export async function leadStats(since: Date) {
  const inPeriod = gte(leads.createdAt, since);
  const [byType, byStatus] = await Promise.all([
    db.select({ type: leads.type, total: count() }).from(leads).where(inPeriod).groupBy(leads.type).orderBy(desc(count())),
    db.select({ status: leads.status, total: count() }).from(leads).where(inPeriod).groupBy(leads.status),
  ]);
  // Temps de première réponse : délai entre la demande et la première action de l'équipe.
  const [response] = await db
    .select({
      hours: sql<number | null>`avg(extract(epoch from (first_event - ${leads.createdAt})) / 3600)`.mapWith((v) => (v === null ? null : Number(v))),
      answered: sql<number>`count(first_event)`.mapWith(Number),
    })
    .from(
      sql`${leads} left join lateral (select min(${leadEvents.createdAt}) as first_event from ${leadEvents} where ${leadEvents.leadId} = ${leads.id} and ${leadEvents.actorId} is not null) fe on true`,
    )
    .where(inPeriod);
  return { byType, byStatus, responseHours: response?.hours ?? null, answered: response?.answered ?? 0 };
}

export async function searchStats(since: Date) {
  const inPeriod = gte(searchLog.createdAt, since);
  const [top, zero, [{ total }]] = await Promise.all([
    db.select({ query: searchLog.query, total: count() }).from(searchLog).where(inPeriod).groupBy(searchLog.query).orderBy(desc(count())).limit(15),
    db
      .select({ query: searchLog.query, total: count() })
      .from(searchLog)
      .where(and(inPeriod, eq(searchLog.results, 0)))
      .groupBy(searchLog.query)
      .orderBy(desc(count()))
      .limit(15),
    db.select({ total: count() }).from(searchLog).where(inPeriod),
  ]);
  return { top, zero, total };
}

export async function unsyncedCounts() {
  const [[o], [l]] = await Promise.all([
    db
      .select({ total: count() })
      .from(orders)
      .where(and(sql`${orders.erpSyncedAt} is null`, sql`${orders.status} not in ('en-attente-paiement', 'annulee')`)),
    db.select({ total: count() }).from(leads).where(sql`${leads.crmSyncedAt} is null`),
  ]);
  return { orders: o.total, leads: l.total };
}

