// Authentification des webhooks envoyés par l'ERP (Authorization: Bearer <ERP_WEBHOOK_SECRET>).
import { ERP_WEBHOOK_SECRET } from 'astro:env/server';
import { timingSafeEqual } from 'node:crypto';

export function erpWebhookConfigured() {
  return !!ERP_WEBHOOK_SECRET;
}

export function isErpAuthorized(request: Request) {
  if (!ERP_WEBHOOK_SECRET) return false;
  const given = Buffer.from(request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '');
  const expected = Buffer.from(ERP_WEBHOOK_SECRET);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
