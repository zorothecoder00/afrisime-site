// Demandes envoyées depuis les formulaires du site (B2B, fournisseurs, contact, réclamations…).
// Accepte du JSON, ou du multipart/form-data quand des documents sont joints (champ « documents »).
import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { leads } from '../../db/schema';
import { db } from '../../lib/db';
import { sendLeadToCrm, type Lead, type LeadType } from '../../lib/integrations';
import { storeUpload, UploadError } from '../../lib/media';
import { autoAssign } from '../../lib/leads';
import { notifyLeadReceived } from '../../lib/notifications';
import { isSameOrigin, json, newId, rateLimit } from '../../lib/server';
import { clean, isValidEmail, isValidPhone } from '../../lib/validation';

const TYPES: LeadType[] = ['b2b', 'fournisseur', 'partenaire', 'contact', 'newsletter', 'investisseur', 'candidature', 'reclamation'];
const KNOWN_FIELDS = new Set(['type', 'source', 'name', 'phone', 'email', 'company', 'need', 'consent', 'website', 'documents']);
const MAX_FILES = 3;

async function readBody(request: Request): Promise<{ fields: Record<string, unknown>; files: File[] } | null> {
  const type = request.headers.get('content-type') ?? '';
  try {
    if (type.includes('multipart/form-data')) {
      const form = await request.formData();
      const fields: Record<string, unknown> = {};
      const files: File[] = [];
      form.forEach((value, key) => {
        if (typeof value !== 'string') {
          if (key === 'documents' && value.size > 0) files.push(value);
          return;
        }
        fields[key] = fields[key] ? `${fields[key]}, ${value}` : value;
      });
      return { fields, files };
    }
    return { fields: await request.json(), files: [] };
  } catch {
    return null;
  }
}

export const POST: APIRoute = async ({ request, clientAddress, locals }) => {
  if (!isSameOrigin(request)) return json({ error: 'Origine non autorisée.' }, 403);
  if (!(await rateLimit(`leads:${clientAddress}`, 8))) {
    return json({ error: 'Trop de demandes. Réessayez dans une minute.' }, 429);
  }

  const parsed = await readBody(request);
  if (!parsed) return json({ error: 'Requête invalide.' }, 400);
  const { fields: body, files } = parsed;

  // Champ piège invisible : un humain le laisse vide, un robot le remplit.
  if (clean(body.website)) return json({ ok: true, id: 'ignored' });

  const type = clean(body.type) as LeadType;
  const name = clean(body.name, 120);
  const phone = clean(body.phone, 30);
  const email = clean(body.email, 160);
  const need = clean(body.need, 3000);
  const consent = body.consent === true || body.consent === 'on' || body.consent === 'true';

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
  if (files.length > MAX_FILES) errors.documents = `${MAX_FILES} documents au maximum.`;
  if (Object.keys(errors).length) return json({ error: 'Certains champs sont à corriger.', errors }, 422);

  // Documents joints : privés, visibles uniquement par l'équipe dans le back-office.
  const attachments: string[] = [];
  for (const file of files) {
    try {
      const stored = await storeUpload(file, { private: true, allowDocuments: true });
      attachments.push(stored.id);
    } catch (err) {
      if (err instanceof UploadError) return json({ error: err.message, errors: { documents: err.message } }, 422);
      console.error(err);
      return json({ error: "Le document n'a pas pu être enregistré." }, 500);
    }
  }

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
    await db.insert(leads).values({ ...lead, attachments, createdAt: new Date(lead.createdAt), userId: locals.user?.id ?? null });
  } catch (err) {
    console.error(err);
    return json({ error: "Votre demande n'a pas pu être transmise. Réessayez ou appelez-nous." }, 500);
  }

  // Le lead est enregistré : un échec du CRM ne fait pas échouer la demande (crm_synced_at reste vide).
  try {
    if (await sendLeadToCrm(lead)) await db.update(leads).set({ crmSyncedAt: new Date() }).where(eq(leads.id, lead.id));
  } catch (err) {
    console.error(err);
  }
  await autoAssign(lead.id, lead.type).catch(console.error);
  await notifyLeadReceived(lead).catch(console.error);

  return json({ ok: true, id: lead.id }, 201);
};
