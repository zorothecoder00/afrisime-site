// Utilitaires des pages du back-office : contrôle des permissions, lecture des formulaires.
// Les formulaires sont envoyés en POST sur la page elle-même ; Astro vérifie leur origine
// (protection CSRF, security.checkOrigin).
import { can, isStaff, type Permissions } from './roles';
import { isSameOrigin, json } from './server';

type Me = { role?: string | null } | null | undefined;

/** Réponse 403 si l'utilisateur n'a pas la permission, sinon null. */
export function deny(me: Me, permissions: Permissions): Response | null {
  return can(me?.role, permissions) ? null : new Response('Accès refusé : votre rôle ne permet pas cette action.', { status: 403 });
}

/**
 * Garde des API du back-office (/api/admin/…) : mêmes règles que les pages /admin
 * (équipe, double authentification, permission du rôle), réponses JSON.
 */
export function denyApi(request: Request, me: (Me & { twoFactorEnabled?: boolean | null }) | null, permissions: Permissions): Response | null {
  if (!isSameOrigin(request)) return json({ error: 'Origine non autorisée.' }, 403);
  if (!me) return json({ error: 'Non connecté.' }, 401);
  if (!isStaff(me.role) || !me.twoFactorEnabled) return json({ error: 'Accès réservé à l’équipe AfriSime (double authentification requise).' }, 403);
  if (!can(me.role, permissions)) return json({ error: 'Votre rôle ne permet pas cette action.' }, 403);
  return null;
}

export function str(form: FormData, name: string, max = 500): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function optionalStr(form: FormData, name: string, max = 500): string | null {
  return str(form, name, max) || null;
}

/** Entier positif ou nul ; null si le champ est vide ou invalide. */
export function int(form: FormData, name: string): number | null {
  const raw = str(form, name, 20).replace(/[\s  ]/g, '');
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

export function bool(form: FormData, name: string): boolean {
  const value = form.get(name);
  return value === 'on' || value === 'true' || value === '1';
}

/** Date et heure saisies (heure de Lomé = UTC). */
export function dateTime(form: FormData, name: string): Date | null {
  const raw = str(form, name, 30);
  if (!raw) return null;
  const d = new Date(raw.length === 10 ? `${raw}T00:00:00Z` : `${raw}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Valeur pour <input type="datetime-local"> (heure de Lomé = UTC). */
export function toInputDateTime(date: Date | null | undefined) {
  return date ? date.toISOString().slice(0, 16) : '';
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function isSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

/** Lignes répétées d'un formulaire : champs nommés `prefix[index][champ]`. */
export function rows(form: FormData, prefix: string): Record<string, string>[] {
  const byIndex = new Map<number, Record<string, string>>();
  const pattern = new RegExp(`^${prefix}\\[(\\d+)\\]\\[(\\w+)\\]$`);
  form.forEach((value, key) => {
    const m = key.match(pattern);
    if (!m || typeof value !== 'string') return;
    const index = Number(m[1]);
    if (!byIndex.has(index)) byIndex.set(index, {});
    byIndex.get(index)![m[2]] = value.trim();
  });
  return [...byIndex.entries()].sort((a, b) => a[0] - b[0]).map(([, row]) => row);
}

/** Lien interne ou externe http(s) : refuse javascript:, data:… */
export function safeHref(value: string): string | null {
  if (!value) return null;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}
