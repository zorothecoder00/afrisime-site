// Notifications clients et équipe (§8) : e-mail, SMS / WhatsApp.
//
// E-mail : EMAIL_PROVIDER = resend | brevo, avec EMAIL_API_KEY et EMAIL_FROM.
// SMS / WhatsApp : NOTIFY_WEBHOOK_URL reçoit { channel, to, message } (signé avec
// NOTIFY_WEBHOOK_SECRET) et le transmet à la passerelle retenue.
// Sans configuration, rien n'est envoyé : la tentative est seulement journalisée
// (table notifications, visible sur la fiche commande du back-office).
import {
  BETTER_AUTH_URL,
  EMAIL_API_KEY,
  EMAIL_FROM,
  EMAIL_PROVIDER,
  NOTIFY_WEBHOOK_SECRET,
  NOTIFY_WEBHOOK_URL,
  STAFF_NOTIFY_EMAIL,
} from 'astro:env/server';
import { createHmac } from 'node:crypto';
import { notifications } from '../db/schema';
import { db } from './db';
import { formatPrice, ORDER_STATUS_LABELS } from './format';
import type { Lead, Order } from './integrations';

type Channel = 'email' | 'sms' | 'whatsapp';

async function log(entry: { channel: Channel; recipient: string; template: string; subject?: string; status: string; error?: string; target?: string }) {
  try {
    await db.insert(notifications).values(entry);
  } catch (err) {
    console.error('[notifications]', err);
  }
}

export function emailConfigured() {
  return !!(EMAIL_PROVIDER && EMAIL_API_KEY && EMAIL_FROM);
}

function parseFrom(from: string) {
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { name: m[1].replace(/^"|"$/g, ''), email: m[2] } : { name: 'AfriSime', email: from.trim() };
}

async function deliverEmail(to: string, subject: string, html: string, text: string) {
  if (EMAIL_PROVIDER === 'resend') {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${EMAIL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html, text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Resend HTTP ${res.status} ${await res.text().catch(() => '')}`.slice(0, 300));
    return;
  }
  if (EMAIL_PROVIDER === 'brevo') {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': EMAIL_API_KEY!, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ sender: parseFrom(EMAIL_FROM!), to: [{ email: to }], subject, htmlContent: html, textContent: text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Brevo HTTP ${res.status} ${await res.text().catch(() => '')}`.slice(0, 300));
    return;
  }
  throw new Error(`Prestataire d'e-mails inconnu : ${EMAIL_PROVIDER}`);
}

/** Envoie un e-mail ; ne lève jamais d'erreur (une notification ne doit pas bloquer une commande). */
export async function sendEmail(message: { to: string; subject: string; html: string; text: string; template: string; target?: string }) {
  const base = { channel: 'email' as const, recipient: message.to, template: message.template, subject: message.subject, target: message.target };
  if (!emailConfigured()) {
    await log({ ...base, status: 'non-configure' });
    return false;
  }
  try {
    await deliverEmail(message.to, message.subject, message.html, message.text);
    await log({ ...base, status: 'envoye' });
    return true;
  } catch (err) {
    console.error('[notifications:email]', err);
    await log({ ...base, status: 'echec', error: String((err as Error).message).slice(0, 500) });
    return false;
  }
}

/** SMS ou WhatsApp via la passerelle configurée (NOTIFY_WEBHOOK_URL). */
export async function sendMessage(message: { channel: 'sms' | 'whatsapp'; to: string; text: string; template: string; target?: string }) {
  const base = { channel: message.channel, recipient: message.to, template: message.template, target: message.target };
  if (!NOTIFY_WEBHOOK_URL) {
    await log({ ...base, status: 'non-configure' });
    return false;
  }
  try {
    const body = JSON.stringify({ channel: message.channel, to: message.to, message: message.text, template: message.template });
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (NOTIFY_WEBHOOK_SECRET) headers['X-AfriSime-Signature'] = createHmac('sha256', NOTIFY_WEBHOOK_SECRET).update(body).digest('hex');
    const res = await fetch(NOTIFY_WEBHOOK_URL, { method: 'POST', headers, body, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await log({ ...base, status: 'envoye' });
    return true;
  } catch (err) {
    console.error('[notifications:message]', err);
    await log({ ...base, status: 'echec', error: String((err as Error).message).slice(0, 500) });
    return false;
  }
}

/* ───────── Gabarits ───────── */

const siteUrl = () => BETTER_AUTH_URL.replace(/\/$/, '');

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function layout(title: string, bodyHtml: string) {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f7f9f8;font-family:Arial,Helvetica,sans-serif;color:#17221d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #dbe4df;border-radius:16px" cellpadding="0" cellspacing="0">
<tr><td style="background:#0f3d2e;color:#ffffff;padding:18px 24px;border-radius:16px 16px 0 0;font-size:20px;font-weight:bold">AfriSime</td></tr>
<tr><td style="padding:24px"><h1 style="margin:0 0 16px;font-size:20px;color:#0f3d2e">${escape(title)}</h1>${bodyHtml}</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #dbe4df;font-size:12px;color:#56665f">AfriSime · Lomé, Togo · ${escape(siteUrl())}</td></tr>
</table></td></tr></table></body></html>`;
}

function button(href: string, label: string) {
  return `<p style="margin:24px 0"><a href="${escape(href)}" style="background:#0f3d2e;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold;display:inline-block">${escape(label)}</a></p>`;
}

function orderLinesHtml(order: Order) {
  const rows = order.lines
    .map((l) => `<tr><td style="padding:6px 0">${l.quantity} × ${escape(l.name)}</td><td align="right">${formatPrice(l.unitPrice * l.quantity)}</td></tr>`)
    .join('');
  return `<table role="presentation" width="100%" style="font-size:14px;border-collapse:collapse">${rows}
<tr><td style="padding-top:10px;border-top:1px solid #dbe4df">Livraison</td><td align="right" style="padding-top:10px;border-top:1px solid #dbe4df">${order.totals.delivery ? formatPrice(order.totals.delivery) : 'Gratuite'}</td></tr>
${order.totals.discount ? `<tr><td>Remise</td><td align="right">− ${formatPrice(order.totals.discount)}</td></tr>` : ''}
<tr><td style="font-weight:bold;padding-top:6px">Total</td><td align="right" style="font-weight:bold;padding-top:6px">${formatPrice(order.totals.total)}</td></tr></table>`;
}

export async function notifyOrderPlaced(order: Order, accessToken: string) {
  const link = `${siteUrl()}/commande/confirmation?n=${encodeURIComponent(order.number)}&t=${accessToken}`;
  const awaitingPayment = order.status === 'en-attente-paiement';
  await Promise.all([
    sendEmail({
      to: order.customer.email,
      template: 'commande-enregistree',
      target: order.number,
      subject: `Votre commande ${order.number}`,
      html: layout(
        `Merci ${order.customer.name.split(' ')[0]}, votre commande est enregistrée`,
        `<p>Numéro de commande : <strong>${escape(order.number)}</strong></p>
${awaitingPayment ? '<p>Votre paiement n’est pas encore confirmé. Vous pouvez le finaliser depuis le lien ci-dessous.</p>' : '<p>Un conseiller vous appelle pour confirmer la livraison.</p>'}
${orderLinesHtml(order)}${button(link, awaitingPayment ? 'Finaliser le paiement' : 'Suivre ma commande')}`,
      ),
      text: `Commande ${order.number} enregistrée. Total : ${formatPrice(order.totals.total)}. Suivi : ${link}`,
    }),
    sendMessage({
      channel: 'sms',
      to: order.customer.phone,
      template: 'commande-enregistree',
      target: order.number,
      text: `AfriSime : commande ${order.number} enregistrée (${formatPrice(order.totals.total)}). Suivi : ${siteUrl()}/suivi`,
    }),
    STAFF_NOTIFY_EMAIL
      ? sendEmail({
          to: STAFF_NOTIFY_EMAIL,
          template: 'equipe-nouvelle-commande',
          target: order.number,
          subject: `Nouvelle commande ${order.number} – ${formatPrice(order.totals.total)}`,
          html: layout(`Nouvelle commande ${order.number}`, `<p>${escape(order.customer.name)} · ${escape(order.customer.phone)}</p>${orderLinesHtml(order)}${button(`${siteUrl()}/admin/commandes/${order.number}`, 'Ouvrir dans le back-office')}`),
          text: `Nouvelle commande ${order.number} de ${order.customer.name} (${order.customer.phone}) : ${formatPrice(order.totals.total)}.`,
        })
      : null,
  ]);
}

export async function notifyOrderStatus(order: { number: string; phone: string; email?: string; status: string; accessToken?: string }) {
  const label = ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS] ?? order.status;
  const link = order.accessToken
    ? `${siteUrl()}/commande/confirmation?n=${encodeURIComponent(order.number)}&t=${order.accessToken}`
    : `${siteUrl()}/suivi`;
  await Promise.all([
    order.email
      ? sendEmail({
          to: order.email,
          template: `commande-${order.status}`,
          target: order.number,
          subject: `Commande ${order.number} : ${label}`,
          html: layout(`Votre commande est « ${label} »`, `<p>Commande <strong>${escape(order.number)}</strong>.</p>${button(link, 'Voir ma commande')}`),
          text: `Votre commande ${order.number} est maintenant : ${label}. ${link}`,
        })
      : null,
    sendMessage({
      channel: 'whatsapp',
      to: order.phone,
      template: `commande-${order.status}`,
      target: order.number,
      text: `AfriSime : votre commande ${order.number} est maintenant « ${label} ».`,
    }),
  ]);
}

export async function notifyPasswordReset(email: string, url: string) {
  const sent = await sendEmail({
    to: email,
    template: 'mot-de-passe',
    subject: 'Choisir un nouveau mot de passe',
    html: layout('Réinitialisation du mot de passe', `<p>Vous avez demandé à changer votre mot de passe. Le lien est valable une heure.</p>${button(url, 'Choisir un nouveau mot de passe')}<p style="font-size:13px;color:#56665f">Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.</p>`),
    text: `Pour choisir un nouveau mot de passe : ${url} (valable une heure).`,
  });
  // Sans prestataire, le lien n'apparaît dans les logs qu'en développement : en production il donnerait accès au compte.
  if (!sent && import.meta.env.DEV) console.info(`[notification] réinitialisation du mot de passe pour ${email} : ${url}`);
}

export async function notifyLeadReceived(lead: Lead) {
  const tasks: Promise<unknown>[] = [];
  if (lead.email && lead.type !== 'newsletter') {
    tasks.push(
      sendEmail({
        to: lead.email,
        template: `lead-${lead.type}`,
        target: lead.id,
        subject: 'Nous avons bien reçu votre demande',
        html: layout('Merci, votre demande est bien arrivée', `<p>Référence : <strong>${escape(lead.id)}</strong>.</p><p>Un membre de l’équipe AfriSime vous recontacte rapidement.</p>`),
        text: `Votre demande ${lead.id} a bien été reçue. Nous vous recontactons rapidement.`,
      }),
    );
  }
  if (STAFF_NOTIFY_EMAIL && lead.type !== 'newsletter') {
    tasks.push(
      sendEmail({
        to: STAFF_NOTIFY_EMAIL,
        template: 'equipe-nouveau-lead',
        target: lead.id,
        subject: `Nouvelle demande (${lead.type}) : ${lead.company ?? lead.name}`,
        html: layout('Nouvelle demande', `<p>${escape(lead.name)} · ${escape(lead.phone ?? '')}</p><p>${escape(lead.need)}</p>${button(`${siteUrl()}/admin/leads/${lead.id}`, 'Ouvrir dans le back-office')}`),
        text: `Nouvelle demande ${lead.type} de ${lead.name} : ${lead.need}`,
      }),
    );
  }
  await Promise.all(tasks);
}
