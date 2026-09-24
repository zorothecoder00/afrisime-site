// Enregistrement et lecture des commandes en base.
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { orderEvents, orderLines, orders, user } from '../db/schema';
import { db } from './db';
import type { Order } from './integrations';

type OrderRow = typeof orders.$inferSelect;
type LineRow = typeof orderLines.$inferSelect;

export function toOrder(row: OrderRow, lines: LineRow[]): Order {
  return {
    number: row.number,
    status: row.status,
    customer: row.customer,
    lines: lines.map(({ sku, productId, variantId, name, unitPrice, quantity }) => ({ sku, productId, variantId, name, unitPrice, quantity })),
    deliveryZone: row.deliveryZone,
    paymentMethod: row.paymentMethod,
    totals: { subtotal: row.subtotal, discount: row.discount, delivery: row.delivery, total: row.total },
    createdAt: row.createdAt.toISOString(),
  };
}

async function withLines(rows: OrderRow[]): Promise<Order[]> {
  if (!rows.length) return [];
  const lines = await db
    .select()
    .from(orderLines)
    .where(inArray(orderLines.orderId, rows.map((r) => r.id)))
    .orderBy(asc(orderLines.id));
  return rows.map((row) => toOrder(row, lines.filter((l) => l.orderId === row.id)));
}

export async function findOrderByIdempotencyKey(key: string): Promise<Order | undefined> {
  const rows = await db.select().from(orders).where(eq(orders.idempotencyKey, key)).limit(1);
  return (await withLines(rows))[0];
}

/**
 * Enregistre la commande. Si la même clé d'idempotence a déjà été utilisée
 * (double clic, requêtes simultanées), renvoie la commande existante sans en créer une autre.
 */
export async function saveOrder(order: Order, idempotencyKey: string, userId: string | null, promoCode: string | null) {
  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(orders)
      .values({
        id: crypto.randomUUID(),
        number: order.number,
        idempotencyKey,
        userId,
        status: order.status,
        customer: order.customer,
        deliveryZone: order.deliveryZone,
        paymentMethod: order.paymentMethod,
        promoCode,
        ...order.totals,
        createdAt: new Date(order.createdAt),
      })
      .onConflictDoNothing({ target: orders.idempotencyKey })
      .returning({ id: orders.id });
    if (!row) return false;
    await tx.insert(orderLines).values(order.lines.map((line) => ({ ...line, orderId: row.id })));
    await tx.insert(orderEvents).values({ orderId: row.id, status: order.status, source: 'site', note: 'Commande passée sur le site' });
    return true;
  });
  if (created) return { order, created };
  return { order: (await findOrderByIdempotencyKey(idempotencyKey))!, created };
}

export async function markOrderSynced(number: string) {
  await db.update(orders).set({ erpSyncedAt: new Date() }).where(eq(orders.number, number));
}

export async function listOrdersForUser(userId: string, limit = 50) {
  const rows = await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt)).limit(limit);
  return withLines(rows);
}

export type OrderStatus = (typeof orders.$inferSelect)['status'];

/** Étapes possibles depuis chaque statut (back-office). Livrée et annulée sont définitives. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  'en-attente-paiement': ['confirmee', 'annulee'],
  confirmee: ['en-preparation', 'annulee'],
  'en-preparation': ['expediee', 'annulee'],
  expediee: ['livree'],
  livree: [],
  annulee: [],
};

const actor = alias(user, 'actor');

/** Commande complète pour le back-office : lignes et historique (avec l'auteur de chaque changement). */
export async function getOrderDetail(number: string) {
  const [row] = await db.select().from(orders).where(eq(orders.number, number)).limit(1);
  if (!row) return undefined;
  const [lines, events] = await Promise.all([
    db.select().from(orderLines).where(eq(orderLines.orderId, row.id)).orderBy(asc(orderLines.id)),
    db
      .select({ event: orderEvents, actorName: actor.name })
      .from(orderEvents)
      .leftJoin(actor, eq(actor.id, orderEvents.actorId))
      .where(eq(orderEvents.orderId, row.id))
      .orderBy(desc(orderEvents.createdAt), desc(orderEvents.id)),
  ]);
  return { row, lines, events };
}

/**
 * Change le statut et l'enregistre dans l'historique. Avec `from`, le changement n'a lieu
 * que si la commande est toujours dans ce statut (deux personnes ne s'écrasent pas) :
 * renvoie `false` si elle a été modifiée entre-temps.
 */
export async function setOrderStatus(
  orderId: string,
  status: OrderStatus,
  meta: { source: 'back-office' | 'erp'; actorId?: string | null; note?: string | null; from?: OrderStatus },
) {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(orders)
      .set({ status })
      .where(meta.from ? and(eq(orders.id, orderId), eq(orders.status, meta.from)) : eq(orders.id, orderId))
      .returning({ id: orders.id });
    if (!updated.length) return false;
    await tx.insert(orderEvents).values({ orderId, status, source: meta.source, actorId: meta.actorId ?? null, note: meta.note || null });
    return true;
  });
}

/** 8 derniers chiffres : « +228 90 11 22 33 » et « 90112233 » désignent le même numéro. */
function phoneKey(phone: string) {
  return phone.replace(/\D/g, '').slice(-8);
}

/**
 * Suivi pour un visiteur sans compte : il faut le numéro de commande ET le téléphone utilisé,
 * pour qu'un numéro de commande seul ne suffise pas à voir la commande d'un autre.
 */
export async function findOrderForTracking(number: string, phone: string) {
  const detail = await getOrderDetail(number.trim().toUpperCase());
  if (!detail || phoneKey(detail.row.customer.phone) !== phoneKey(phone) || phoneKey(phone).length < 8) return undefined;
  return detail;
}

/** Liste filtrée pour le back-office (statut, commandes non transmises à l'ERP, recherche). */
export async function listOrders(filters: { status?: string; erpPending?: boolean; q?: string; limit?: number; offset?: number }) {
  const where: SQL[] = [];
  if (filters.status) where.push(eq(orders.status, filters.status as OrderStatus));
  if (filters.erpPending) where.push(isNull(orders.erpSyncedAt));
  if (filters.q) {
    const term = `%${filters.q.replace(/[%_\\]/g, '\\$&')}%`;
    where.push(
      or(
        ilike(orders.number, term),
        ilike(sql`${orders.customer}->>'name'`, term),
        ilike(sql`${orders.customer}->>'phone'`, term),
        ilike(sql`${orders.customer}->>'email'`, term),
      )!,
    );
  }
  const condition = where.length ? and(...where) : undefined;
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(orders).where(condition).orderBy(desc(orders.createdAt)).limit(filters.limit ?? 25).offset(filters.offset ?? 0),
    db.select({ total: count() }).from(orders).where(condition),
  ]);
  return { rows, total };
}
