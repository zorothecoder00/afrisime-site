// Enregistrement et lecture des commandes en base.
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { orderLines, orders } from '../db/schema';
import { db } from './db';
import type { Order } from './integrations';

type OrderRow = typeof orders.$inferSelect;
type LineRow = typeof orderLines.$inferSelect;

function toOrder(row: OrderRow, lines: LineRow[]): Order {
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
