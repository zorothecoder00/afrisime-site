// Valeurs de test pour « astro:env/server » (tests unitaires uniquement).
// La base n'est jamais contactée : postgres-js n'ouvre de connexion qu'à la première requête.
export const DATABASE_URL = 'postgres://test:test@127.0.0.1:1/unit-tests';
export const BETTER_AUTH_SECRET = 'x'.repeat(32);
export const BETTER_AUTH_URL = 'http://localhost:4321';
export const ERP_API_URL = undefined;
export const ERP_API_TOKEN = undefined;
export const CRM_API_URL = undefined;
export const CRM_API_TOKEN = undefined;
export const ERP_WEBHOOK_SECRET = undefined;
export const PAYMENT_PROVIDER = undefined;
export const FEDAPAY_SECRET_KEY = undefined;
export const FEDAPAY_ENV = 'sandbox';
export const EMAIL_PROVIDER = undefined;
export const EMAIL_API_KEY = undefined;
export const EMAIL_FROM = undefined;
export const STAFF_NOTIFY_EMAIL = undefined;
export const NOTIFY_WEBHOOK_URL = undefined;
export const NOTIFY_WEBHOOK_SECRET = undefined;
export const CRON_SECRET = undefined;
