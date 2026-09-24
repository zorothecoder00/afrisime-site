// Schéma de la base PostgreSQL (Drizzle ORM).
// Après modification : `npm run db:generate` puis `npm run db:migrate`.
//
// Le catalogue et le stock n'y figurent pas : ils restent gérés par le CMS / l'ERP.
import { sql } from 'drizzle-orm';
import { bigint, boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/* ───────── Authentification (tables attendues par Better Auth) ───────── */

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  // Champs propres à AfriSime
  phone: text('phone'),
  accountType: text('account_type').notNull().default('particulier'), // particulier | pro
  company: text('company'),
  // Plugin admin : rôle (voir src/lib/roles.ts) et bannissement
  role: text('role').notNull().default('client'),
  banned: boolean('banned').default(false),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires', { withTimezone: true }),
  // Plugin two-factor
  twoFactorEnabled: boolean('two_factor_enabled').default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    token: text('token').notNull().unique(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    impersonatedBy: text('impersonated_by'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('session_user_idx').on(t.userId)],
);

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('account_user_idx').on(t.userId)],
);

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
);

export const twoFactor = pgTable(
  'two_factor',
  {
    id: text('id').primaryKey(),
    secret: text('secret').notNull(),
    backupCodes: text('backup_codes').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    verified: boolean('verified').default(true),
    failedVerificationCount: integer('failed_verification_count').default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
  },
  (t) => [index('two_factor_user_idx').on(t.userId), index('two_factor_secret_idx').on(t.secret)],
);

/** Limitation des tentatives sur les routes d'authentification (partagée entre instances). */
export const rateLimit = pgTable('rate_limit', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
});

/* ───────── Commerce ───────── */

export const orderStatus = pgEnum('order_status', [
  'en-attente-paiement',
  'confirmee',
  'en-preparation',
  'expediee',
  'livree',
  'annulee',
]);

export const orders = pgTable(
  'orders',
  {
    id: text('id').primaryKey(),
    number: text('number').notNull().unique(),
    /** Clé envoyée par le navigateur : une même tentative ne crée qu'une commande. */
    idempotencyKey: text('idempotency_key').notNull().unique(),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    status: orderStatus('status').notNull(),
    customer: jsonb('customer').$type<{ name: string; phone: string; email: string; city: string; address: string }>().notNull(),
    deliveryZone: text('delivery_zone').notNull(),
    paymentMethod: text('payment_method').notNull(),
    promoCode: text('promo_code'),
    subtotal: integer('subtotal').notNull(),
    discount: integer('discount').notNull(),
    delivery: integer('delivery').notNull(),
    total: integer('total').notNull(),
    /** Null tant que la commande n'a pas été transmise à l'ERP. */
    erpSyncedAt: timestamp('erp_synced_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('orders_user_idx').on(t.userId), index('orders_created_idx').on(t.createdAt)],
);

export const orderLines = pgTable(
  'order_lines',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    sku: text('sku').notNull(),
    productId: text('product_id').notNull(),
    variantId: text('variant_id').notNull(),
    name: text('name').notNull(),
    unitPrice: integer('unit_price').notNull(),
    quantity: integer('quantity').notNull(),
  },
  (t) => [index('order_lines_order_idx').on(t.orderId)],
);

/* ───────── Leads (B2B, fournisseurs, contact…) ───────── */

export const leadStatus = pgEnum('lead_status', ['nouveau', 'qualifie', 'devis', 'negociation', 'commande', 'cloture']);

export const leads = pgTable(
  'leads',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    source: text('source').notNull(),
    status: leadStatus('status').notNull().default('nouveau'),
    name: text('name').notNull(),
    phone: text('phone'),
    email: text('email'),
    company: text('company'),
    need: text('need').notNull(),
    details: jsonb('details').$type<Record<string, string>>().notNull().default({}),
    consent: boolean('consent').notNull(),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    assignedTo: text('assigned_to').references(() => user.id, { onDelete: 'set null' }),
    crmSyncedAt: timestamp('crm_synced_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('leads_type_status_idx').on(t.type, t.status), index('leads_created_idx').on(t.createdAt)],
);

/* ───────── Sécurité ───────── */

/** Compteurs de limitation de débit des endpoints publics (/api/orders, /api/leads). */
export const apiRateLimit = pgTable('api_rate_limit', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull().default(sql`now()`),
});

/** Journal des actions sensibles (connexions, changements de rôle…). */
export const auditLog = pgTable(
  'audit_log',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    target: text('target'),
    details: jsonb('details').$type<Record<string, unknown>>(),
    ipAddress: text('ip_address'),
    createdAt: createdAt(),
  },
  (t) => [index('audit_log_actor_idx').on(t.actorId), index('audit_log_created_idx').on(t.createdAt)],
);
