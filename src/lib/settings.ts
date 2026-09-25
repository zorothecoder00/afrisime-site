// Paramètres du site administrables (coordonnées, réseaux, menus, livraison, paiement, SEO).
// Chaque groupe est une ligne de la table `settings` ; en son absence, les valeurs par défaut
// de src/data/site.ts s'appliquent.
import { settings } from '../db/schema';
import { DELIVERY_ZONES, FREE_DELIVERY_THRESHOLD, NAV, PAYMENT_METHODS, SITE, type DeliveryZone, type NavItem, type PaymentMethod } from '../data/site';
import { cached, invalidate } from './cache';
import { db } from './db';

export type Settings = {
  identity: {
    name: string;
    tagline: string;
    description: string;
    topBar: string;
  };
  contact: {
    phone: string;
    /** Numéro WhatsApp au format international sans « + » (ex. 22890000000). */
    whatsapp: string;
    email: string;
    address: string;
    hours: string;
  };
  social: { label: string; href: string }[];
  navigation: NavItem[];
  delivery: { zones: DeliveryZone[]; freeThreshold: number };
  payments: { methods: PaymentMethod[] };
  seo: {
    /** Identifiant Google Tag Manager (GTM-XXXX), chargé uniquement après consentement. */
    gtmId: string;
    /** Code de vérification Google Search Console (balise meta). */
    googleVerification: string;
  };
};

export type SettingsKey = keyof Settings;

export const DEFAULT_SETTINGS: Settings = {
  identity: { name: SITE.name, tagline: SITE.tagline, description: SITE.description, topBar: SITE.topBar },
  contact: { ...SITE.contact },
  social: SITE.social,
  navigation: NAV,
  delivery: { zones: DELIVERY_ZONES, freeThreshold: FREE_DELIVERY_THRESHOLD },
  payments: { methods: PAYMENT_METHODS },
  seo: { gtmId: '', googleVerification: '' },
};

export function getSettings(): Promise<Settings> {
  return cached('settings', 60_000, async () => {
    const rows = await db.select().from(settings);
    const merged = structuredClone(DEFAULT_SETTINGS) as Record<string, unknown>;
    for (const row of rows) {
      if (!(row.key in merged)) continue;
      const base = merged[row.key];
      merged[row.key] = Array.isArray(base) ? row.value : { ...(base as object), ...(row.value as object) };
    }
    return merged as Settings;
  });
}

export async function saveSettings<K extends SettingsKey>(key: K, value: Settings[K], actorId: string) {
  await db
    .insert(settings)
    .values({ key, value, updatedBy: actorId })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedBy: actorId, updatedAt: new Date() } });
  invalidate('settings');
}

/** Liens dérivés des coordonnées. */
export function contactLinks(contact: Settings['contact']) {
  return {
    phoneHref: `tel:${contact.phone.replace(/[^\d+]/g, '')}`,
    whatsappHref: `https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`,
  };
}

export function activeZones(s: Settings) {
  return s.delivery.zones.filter((z) => z.active);
}

export function enabledPaymentMethods(s: Settings) {
  return s.payments.methods.filter((m) => m.enabled);
}
