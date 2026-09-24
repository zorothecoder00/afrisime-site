import type { APIRoute } from 'astro';
import { sendLeadToCrm, type Lead } from '../../lib/integrations';
import { isSameOrigin, json, newId, rateLimit } from '../../lib/server';
import { clean, isValidEmail, isValidPhone } from '../../lib/validation';

export const prerender = false;

const TYPES: Lead['type'][] = ['b2b', 'fournisseur', 'partenaire', 'contact', 'newsletter', 'investisseur', 'candidature'];
const KNOWN_FIELDS = new Set(['type', 'source', 'name', 'phone', 'email', 'company', 'need', 'consent', 'website']);

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!isSameOrigin(request)) return json({ error: 'Origine non autorisée.' }, 403);
  if (!rateLimit(`leads:${clientAddress}`, 8)) {
    return json({ error: 'Trop de demandes. Réessayez dans une minute.' }, 429);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Requête invalide.' }, 400);
  }

  // Champ piège invisible : un humain le laisse vide, un robot le remplit.
  if (clean(body.website)) return json({ ok: true, id: 'ignored' });

  const type = clean(body.type) as Lead['type'];
  const name = clean(body.name, 120);
  const phone = clean(body.phone, 30);
  const email = clean(body.email, 160);
  const need = clean(body.need, 3000);
  const consent = body.consent === true || body.consent === 'on';

  const errors: Record<string, string> = {};
  if (!TYPES.includes(type)) errors.type = 'Type de demande inconnu.';
  if (type === 'newsletter') {
    if (!isValidEmail(email)) errors.email = 'Adresse e-mail invalide.';
  } else {
    if (name.length < 2) errors.name = 'Indiquez votre nom.';
    if (!isValidPhone(phone)) errors.phone = 'Numéro de téléphone invalide.';
    if (email && !isValidEmail(email)) errors.email = 'Adresse e-mail invalide.';
    if (need.length < 5) errors.need = 'Décrivez brièvement votre besoin.';
  }
  if (!consent) errors.consent = 'Votre accord est nécessaire pour être recontacté.';
  if (Object.keys(errors).length) return json({ error: 'Certains champs sont à corriger.', errors }, 422);

  const details: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (!KNOWN_FIELDS.has(key) && typeof value === 'string') details[key.slice(0, 40)] = clean(value);
  }

  const lead: Lead = {
    id: newId('LEAD'),
    type,
    source: clean(body.source, 120) || 'site-web',
    name: name || email,
    phone: phone || undefined,
    email: email || undefined,
    company: clean(body.company, 160) || undefined,
    need: need || 'Inscription newsletter',
    details,
    consent,
    createdAt: new Date().toISOString(),
  };

  try {
    await sendLeadToCrm(lead);
  } catch (err) {
    console.error(err);
    return json({ error: "Votre demande n'a pas pu être transmise. Réessayez ou appelez-nous." }, 502);
  }

  return json({ ok: true, id: lead.id }, 201);
};
