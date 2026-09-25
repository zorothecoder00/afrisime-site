// Export CSV des commandes d'une période (tableur, comptabilité). Séparateur « ; » pour Excel en français.
import type { APIRoute } from 'astro';
import { desc, gte } from 'drizzle-orm';
import { orders } from '../../../db/schema';
import { audit } from '../../../lib/audit';
import { db } from '../../../lib/db';
import { ORDER_STATUS_LABELS } from '../../../lib/format';
import { can } from '../../../lib/roles';

const cell = (value: unknown) => {
  const text = String(value ?? '');
  // Neutralise les formules (=, +, -, @) interprétées par les tableurs.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

export const GET: APIRoute = async ({ locals, url, clientAddress }) => {
  if (!can(locals.user?.role, { order: ['read'] })) return new Response('Accès refusé.', { status: 403 });
  const days = Math.min(730, Math.max(1, Number(url.searchParams.get('periode')) || 30));
  const rows = await db
    .select()
    .from(orders)
    .where(gte(orders.createdAt, new Date(Date.now() - days * 86_400_000)))
    .orderBy(desc(orders.createdAt));
  const header = ['Numéro', 'Date', 'Statut', 'Client', 'Téléphone', 'E-mail', 'Ville', 'Livraison', 'Paiement', 'Payée le', 'Code promo', 'Sous-total', 'Remise', 'Frais de livraison', 'Total', 'Transmise ERP'];
  const lines = rows.map((o) =>
    [
      o.number,
      o.createdAt.toISOString(),
      ORDER_STATUS_LABELS[o.status],
      o.customer.name,
      o.customer.phone,
      o.customer.email,
      o.customer.city,
      o.deliveryZone,
      o.paymentMethod,
      o.paidAt?.toISOString() ?? '',
      o.promoCode ?? '',
      o.subtotal,
      o.discount,
      o.delivery,
      o.total,
      o.erpSyncedAt ? 'oui' : 'non',
    ]
      .map(cell)
      .join(';'),
  );
  await audit({ actorId: locals.user!.id, action: 'export-commandes', details: { jours: days, lignes: rows.length }, ipAddress: clientAddress });
  return new Response(`﻿${[header.map(cell).join(';'), ...lines].join('\r\n')}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="commandes-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
};
