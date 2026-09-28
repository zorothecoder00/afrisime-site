// Alertes de sécurité (cahier des charges §15) : en plus de leur trace dans le journal d'activité,
// les événements sensibles sont signalés par e-mail à l'équipe (STAFF_NOTIFY_EMAIL, à défaut les
// super administrateurs) et dans les logs du serveur.
import { STAFF_NOTIFY_EMAIL } from 'astro:env/server';
import { and, count, eq, gte, inArray } from 'drizzle-orm';
import { auditLog, user } from '../db/schema';
import { db } from './db';
import { notifySecurityAlert } from './notifications';
import { isStaff, ROLE_LABELS, type RoleName } from './roles';

/** Actions du journal signalées dès qu'elles se produisent. */
const IMMEDIATE_ALERTS: Record<string, string> = {
  'role-modifie': 'Rôle d’un compte modifié',
  'compte-equipe-cree': 'Nouveau compte de l’équipe',
  'compte-bloque': 'Compte bloqué',
};

/** Échecs en série sur un compte de l'équipe : alerte quand le seuil est atteint dans la fenêtre. */
const FAILURE_WINDOW_MS = 15 * 60_000;
const FAILURE_ALERTS = {
  'connexion-echouee': { threshold: 5, title: 'Échecs de connexion répétés sur un compte de l’équipe' },
  // Le mot de passe a été accepté : seul le code manque. Seuil plus bas.
  'double-auth-echouee': { threshold: 3, title: 'Codes de double authentification refusés sur un compte de l’équipe' },
} as const;

export type AuthFailure = keyof typeof FAILURE_ALERTS;

const roleLabel = (role: string | null | undefined) => ROLE_LABELS[role as RoleName] ?? role ?? '—';
const now = () => new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Lome' });

async function recipients() {
  if (STAFF_NOTIFY_EMAIL) return [STAFF_NOTIFY_EMAIL];
  const admins = await db.select({ email: user.email, banned: user.banned }).from(user).where(eq(user.role, 'super-admin'));
  return admins.filter((a) => !a.banned).map((a) => a.email);
}

async function alert(title: string, lines: string[], target?: string) {
  console.warn(`[sécurité] ${title} · ${lines.join(' · ')}`);
  try {
    const to = await recipients();
    if (to.length) await notifySecurityAlert(to, { title, lines: [...lines, `Date : ${now()}`], target });
  } catch (err) {
    // Une alerte ne doit jamais bloquer l'action elle-même.
    console.error('[sécurité]', err);
  }
}

/** Appelé par audit() après chaque écriture dans le journal. */
export async function alertOnAudit(entry: { actorId?: string | null; action: string; target?: string; details?: Record<string, unknown>; ipAddress?: string | null }) {
  const title = IMMEDIATE_ALERTS[entry.action];
  if (!title) return;
  const ids = [entry.actorId, entry.target].filter((id): id is string => !!id);
  const people = ids.length ? await db.select({ id: user.id, name: user.name, email: user.email }).from(user).where(inArray(user.id, ids)) : [];
  const who = (id?: string | null) => {
    const p = people.find((u) => u.id === id);
    return p ? `${p.name} (${p.email})` : (id ?? '—');
  };
  const lines = [`Compte concerné : ${who(entry.target)}`, `Par : ${who(entry.actorId)}`];
  if (entry.action === 'role-modifie') lines.push(`Rôle : ${roleLabel(entry.details?.de as string)} → ${roleLabel(entry.details?.vers as string)}`);
  if (entry.action === 'compte-equipe-cree') lines.push(`Rôle : ${roleLabel(entry.details?.role as string)}`);
  if (entry.ipAddress) lines.push(`Adresse IP : ${entry.ipAddress}`);
  await alert(title, lines, entry.target);
}

/**
 * Échec de connexion ou de double authentification sur un compte existant : journalisé, puis
 * signalé une fois quand le seuil est atteint (comptes de l'équipe uniquement).
 */
export async function recordAuthFailure(action: AuthFailure, account: { id: string; email: string; role?: string | null }, ipAddress: string | null) {
  try {
    await db.insert(auditLog).values({ action, target: account.id, details: { email: account.email }, ipAddress });
    if (!isStaff(account.role)) return;
    const { threshold, title } = FAILURE_ALERTS[action];
    const [{ n }] = await db
      .select({ n: count() })
      .from(auditLog)
      .where(and(eq(auditLog.action, action), eq(auditLog.target, account.id), gte(auditLog.createdAt, new Date(Date.now() - FAILURE_WINDOW_MS))));
    if (n !== threshold) return;
    await alert(title, [`Compte : ${account.email} (${roleLabel(account.role)})`, `${n} échecs en ${FAILURE_WINDOW_MS / 60_000} minutes`, `Dernière adresse IP : ${ipAddress ?? 'inconnue'}`], account.id);
  } catch (err) {
    console.error('[sécurité]', err);
  }
}
