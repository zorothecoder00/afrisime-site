// Schéma de la base PostgreSQL (Drizzle ORM).
// Après modification : `npm run db:generate` puis `npm run db:migrate`.
//
// Le catalogue et les contenus sont administrés dans le back-office (CMS) ; l'ERP peut
// mettre à jour prix, statuts et stock par SKU (src/pages/api/erp/catalog.ts).
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });

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
  /** Compte professionnel : aucun | en-attente | valide (validé par un commercial, donne accès aux prix pro). */
  proStatus: text('pro_status').notNull().default('aucun'),
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
    /** Jeton secret donnant accès à la page de confirmation et au paiement sans compte. */
    accessToken: text('access_token').notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
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
    /** Documents joints (identifiants de la table media, privés). */
    attachments: jsonb('attachments').$type<string[]>().notNull().default([]),
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

/* ───────── Historiques et panier sauvegardé ───────── */

/** Historique des statuts d'une commande (création, back-office, ERP). */
export const orderEvents = pgTable(
  'order_events',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    status: orderStatus('status').notNull(),
    note: text('note'),
    /** Null pour les changements automatiques (création, ERP). */
    actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
    source: text('source').notNull(), // site | back-office | erp
    createdAt: createdAt(),
  },
  (t) => [index('order_events_order_idx').on(t.orderId)],
);

/** Suivi commercial d'un lead : changements de statut, attribution, notes. */
export const leadEvents = pgTable(
  'lead_events',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    leadId: text('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    status: leadStatus('status'),
    assignedTo: text('assigned_to').references(() => user.id, { onDelete: 'set null' }),
    note: text('note'),
    actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('lead_events_lead_idx').on(t.leadId)],
);

export type SavedCartItem = { productId: string; variantId: string; quantity: number };

/** Panier d'un client connecté, retrouvé sur tous ses appareils. */
export const carts = pgTable('carts', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  items: jsonb('items').$type<SavedCartItem[]>().notNull().default([]),
  updatedAt: updatedAt(),
});

/* ───────── Catalogue (CMS) ───────── */

export const categories = pgTable('categories', {
  /** Identifiant = slug utilisé dans les URL (/boutique?categorie=…). */
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  icon: text('icon').notNull().default('basket'),
  color: text('color').notNull().default('#2e7d5b'),
  imageId: text('image_id'),
  parentId: text('parent_id'),
  position: integer('position').notNull().default(0),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const brands = pgTable('brands', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  logoId: text('logo_id'),
  position: integer('position').notNull().default(0),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type ProductVariant = {
  id: string;
  label: string;
  price: number;
  compareAtPrice?: number;
  /** Prix réservé aux comptes professionnels validés. */
  proPrice?: number;
  unit: string;
  weightKg: number;
};
export type ProductFeature = { label: string; value: string };

export const productStatus = pgEnum('product_status', ['disponible', 'sur-commande', 'indisponible', 'devis']);

export const products = pgTable(
  'products',
  {
    /** Identifiant stable (paniers, commandes, favoris) ; l'URL utilise `slug`, modifiable. */
    id: text('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    sku: text('sku').notNull().unique(),
    name: text('name').notNull(),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id),
    brandId: text('brand_id')
      .notNull()
      .references(() => brands.id),
    summary: text('summary').notNull().default(''),
    description: text('description').notNull().default(''),
    features: jsonb('features').$type<ProductFeature[]>().notNull().default([]),
    origin: text('origin').notNull().default('importe'), // local | importe
    variants: jsonb('variants').$type<ProductVariant[]>().notNull(),
    status: productStatus('status').notNull().default('disponible'),
    /** Quantité communiquée par l'ERP (facultative). */
    stock: integer('stock'),
    badges: jsonb('badges').$type<string[]>().notNull().default([]),
    popularity: integer('popularity').notNull().default(0),
    imageIds: jsonb('image_ids').$type<string[]>().notNull().default([]),
    related: jsonb('related').$type<string[]>().notNull().default([]),
    /** Délai indicatif affiché sur la fiche (sinon déduit du statut). */
    leadTime: text('lead_time'),
    published: boolean('published').notNull().default(true),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('products_category_idx').on(t.categoryId), index('products_brand_idx').on(t.brandId)],
);

/* ───────── Médias ───────── */

export const media = pgTable(
  'media',
  {
    id: text('id').primaryKey(),
    kind: text('kind').notNull(), // image | document
    filename: text('filename').notNull(),
    mime: text('mime').notNull(),
    size: integer('size').notNull(),
    width: integer('width'),
    height: integer('height'),
    alt: text('alt').notNull().default(''),
    data: bytea('data').notNull(),
    /** Miniature WebP (images uniquement). */
    thumb: bytea('thumb'),
    /** Documents joints aux demandes : visibles par l'équipe uniquement. */
    private: boolean('private').notNull().default(false),
    uploadedBy: text('uploaded_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('media_kind_idx').on(t.kind, t.private)],
);

/* ───────── Contenus (Média, pages) ───────── */

export const contentStatus = pgEnum('content_status', ['brouillon', 'a-valider', 'publie', 'archive']);

export const contents = pgTable(
  'contents',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(), // actualite | conseil | video | evenement | communique | page
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    excerpt: text('excerpt').notNull().default(''),
    /** Markdown. */
    body: text('body').notNull().default(''),
    coverId: text('cover_id'),
    videoUrl: text('video_url'),
    eventDate: timestamp('event_date', { withTimezone: true }),
    eventLocation: text('event_location'),
    authorName: text('author_name').notNull().default('Équipe AfriSime'),
    status: contentStatus('status').notNull().default('brouillon'),
    /** Date de publication : dans le futur, le contenu est programmé. */
    publishedAt: timestamp('published_at', { withTimezone: true }),
    reviewNote: text('review_note'),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('contents_type_slug_idx').on(t.type, t.slug), index('contents_status_idx').on(t.status, t.publishedAt)],
);

export const faqItems = pgTable('faq_items', {
  id: text('id').primaryKey(),
  group: text('group').notNull(), // general | commande | livraison | b2b
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  position: integer('position').notNull().default(0),
  published: boolean('published').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* ───────── Promotions ───────── */

export const promoCodes = pgTable('promo_codes', {
  code: text('code').primaryKey(),
  description: text('description').notNull().default(''),
  kind: text('kind').notNull(), // pourcentage | montant
  /** Pourcentage (5 = 5 %) ou montant en FCFA. */
  value: integer('value').notNull(),
  maxDiscount: integer('max_discount'),
  minSubtotal: integer('min_subtotal').notNull().default(0),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  usageLimit: integer('usage_limit'),
  usedCount: integer('used_count').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const campaigns = pgTable('campaigns', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  text: text('text').notNull().default(''),
  ctaLabel: text('cta_label'),
  ctaHref: text('cta_href'),
  imageId: text('image_id'),
  /** accueil-offres : bloc « Offres du moment » de l'accueil ; bandeau : bandeau haut de toutes les pages. */
  placement: text('placement').notNull().default('accueil-offres'),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  active: boolean('active').notNull().default(true),
  position: integer('position').notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* ───────── SEO et paramètres ───────── */

export const redirects = pgTable('redirects', {
  from: text('from').primaryKey(),
  to: text('to').notNull(),
  status: integer('status').notNull().default(301),
  hits: integer('hits').notNull().default(0),
  createdAt: createdAt(),
});

/** Paramètres du site modifiables dans le back-office (coordonnées, menus, livraison…). */
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
  updatedAt: updatedAt(),
});

/* ───────── Espace client ───────── */

export const addresses = pgTable(
  'addresses',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    city: text('city').notNull(),
    address: text('address').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('addresses_user_idx').on(t.userId)],
);

export const favorites = pgTable(
  'favorites',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.productId] })],
);

/* ───────── Paiements et notifications ───────── */

export const paymentStatus = pgEnum('payment_status', ['en-attente', 'reussi', 'echoue', 'annule']);

export const payments = pgTable(
  'payments',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    /** Référence de la transaction chez le prestataire. */
    providerRef: text('provider_ref'),
    amount: integer('amount').notNull(),
    status: paymentStatus('status').notNull().default('en-attente'),
    redirectUrl: text('redirect_url'),
    raw: jsonb('raw').$type<Record<string, unknown>>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('payments_order_idx').on(t.orderId), uniqueIndex('payments_provider_ref_idx').on(t.provider, t.providerRef)],
);

/** Journal des notifications envoyées (ou non) aux clients et à l'équipe. */
export const notifications = pgTable(
  'notifications',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    channel: text('channel').notNull(), // email | sms | whatsapp
    recipient: text('recipient').notNull(),
    template: text('template').notNull(),
    subject: text('subject'),
    status: text('status').notNull(), // envoye | non-configure | echec
    error: text('error'),
    /** Commande ou lead concerné. */
    target: text('target'),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_target_idx').on(t.target)],
);

/** Recherches de la boutique, pour repérer les recherches sans résultat (§16). */
export const searchLog = pgTable(
  'search_log',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    query: text('query').notNull(),
    results: integer('results').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('search_log_created_idx').on(t.createdAt)],
);
