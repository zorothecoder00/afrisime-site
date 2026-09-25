// Webhook ERP → site (§12, flux 5) : mise à jour des prix, statuts et stocks par SKU.
//
//   POST /api/erp/catalog
//   Authorization: Bearer <ERP_WEBHOOK_SECRET>
//   { "items": [
//       { "sku": "AFS-CER-001", "status": "disponible", "stock": 120 },
//       { "sku": "AFS-CER-001-25kg", "price": 22500, "proPrice": 21000 }
//   ] }
//
// « sku » est la référence produit (statut, stock) ou la référence d'un format
// (produit + « - » + identifiant du format, comme dans les commandes) pour ses prix.
// Stock à 0 sans statut précisé : un produit disponible passe « temporairement indisponible ».
import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { products } from '../../../db/schema';
import { audit } from '../../../lib/audit';
import { invalidateCatalog } from '../../../lib/catalog';
import { PRODUCT_STATUSES } from '../../../lib/catalog-admin';
import { db } from '../../../lib/db';
import { erpWebhookConfigured, isErpAuthorized } from '../../../lib/erp-auth';
import { json, rateLimit } from '../../../lib/server';

const MAX_ITEMS = 500;
const price = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : undefined);

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!erpWebhookConfigured()) return json({ error: 'Webhook non configuré.' }, 503);
  if (!(await rateLimit(`erp-catalog:${clientAddress}`, 60))) return json({ error: 'Trop de requêtes.' }, 429);
  if (!isErpAuthorized(request)) return json({ error: 'Non autorisé.' }, 401);

  let body: { items?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON invalide.' }, 400);
  }
  if (!Array.isArray(body.items) || body.items.length > MAX_ITEMS) return json({ error: `« items » : tableau de ${MAX_ITEMS} éléments au plus.` }, 422);

  const all = await db.select({ id: products.id, sku: products.sku, status: products.status, variants: products.variants }).from(products);
  const bySku = new Map(all.map((p) => [p.sku, p]));
  const changed = new Map<string, Partial<typeof products.$inferInsert>>();
  const unknown: string[] = [];

  for (const item of body.items as Record<string, unknown>[]) {
    const sku = String(item?.sku ?? '');
    let product = bySku.get(sku);
    let variantId: string | undefined;
    if (!product) {
      // Référence de format : le produit dont le SKU est le plus long préfixe.
      const parent = [...bySku.keys()].filter((s) => sku.startsWith(`${s}-`)).sort((a, b) => b.length - a.length)[0];
      product = parent ? bySku.get(parent) : undefined;
      variantId = parent ? sku.slice(parent.length + 1) : undefined;
    }
    if (!product) {
      unknown.push(sku);
      continue;
    }
    const patch = changed.get(product.id) ?? {};
    const currentStatus = patch.status ?? product.status;
    if (variantId) {
      const variants = (patch.variants ?? product.variants).map((v) => ({ ...v }));
      const variant = variants.find((v) => v.id === variantId);
      if (!variant) {
        unknown.push(sku);
        continue;
      }
      if (price(item.price) !== undefined) variant.price = price(item.price)!;
      if (item.compareAtPrice === null) delete variant.compareAtPrice;
      else if (price(item.compareAtPrice) !== undefined) variant.compareAtPrice = price(item.compareAtPrice);
      if (item.proPrice === null) delete variant.proPrice;
      else if (price(item.proPrice) !== undefined) variant.proPrice = price(item.proPrice);
      patch.variants = variants;
    }
    if (typeof item.stock === 'number' && Number.isInteger(item.stock) && item.stock >= 0) {
      patch.stock = item.stock;
      if (item.stock === 0 && !item.status && currentStatus === 'disponible') patch.status = 'indisponible';
      if (item.stock > 0 && !item.status && currentStatus === 'indisponible') patch.status = 'disponible';
    }
    if (typeof item.status === 'string' && (PRODUCT_STATUSES as readonly string[]).includes(item.status)) {
      patch.status = item.status as (typeof PRODUCT_STATUSES)[number];
    }
    changed.set(product.id, patch);
  }

  for (const [id, patch] of changed) await db.update(products).set(patch).where(eq(products.id, id));
  if (changed.size) {
    invalidateCatalog();
    await audit({ action: 'catalogue-maj-erp', details: { produits: changed.size, inconnus: unknown.length }, ipAddress: clientAddress });
  }
  return json({ ok: true, updated: changed.size, unknown });
};
