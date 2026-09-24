// Rôles et permissions (cahier des charges §11).
// Source unique : utilisée par Better Auth (plugin admin) et par les pages du back-office.
import { createAccessControl } from 'better-auth/plugins/access';
import { adminAc, defaultStatements, userAc } from 'better-auth/plugins/admin/access';

const statements = {
  ...defaultStatements, // user, session : gestion des comptes
  order: ['read', 'update'],
  lead: ['read', 'update'],
  catalog: ['read', 'update'],
  content: ['read', 'update', 'publish'],
  report: ['read'],
  settings: ['update'],
} as const;

export const ac = createAccessControl(statements);

const readAll = { order: ['read'], lead: ['read'], catalog: ['read'], content: ['read'], report: ['read'] } as const;

export const roles = {
  /** Clients (particuliers et professionnels) : aucun accès au back-office. */
  client: ac.newRole({ ...userAc.statements }),
  'super-admin': ac.newRole({
    ...adminAc.statements,
    order: ['read', 'update'],
    lead: ['read', 'update'],
    catalog: ['read', 'update'],
    content: ['read', 'update', 'publish'],
    report: ['read'],
    settings: ['update'],
  }),
  'admin-web': ac.newRole({ content: ['read', 'update', 'publish'], catalog: ['read'], report: ['read'] }),
  ecommerce: ac.newRole({ order: ['read', 'update'], catalog: ['read', 'update'], lead: ['read'], report: ['read'] }),
  commercial: ac.newRole({ lead: ['read', 'update'], order: ['read'], catalog: ['read'], report: ['read'] }),
  'service-client': ac.newRole({ order: ['read', 'update'], lead: ['read', 'update'], content: ['read'] }),
  editeur: ac.newRole({ content: ['read', 'update'], catalog: ['read'] }),
  analyste: ac.newRole({ ...readAll }),
};

export type RoleName = keyof typeof roles;

export const ROLE_LABELS: Record<RoleName, string> = {
  client: 'Client',
  'super-admin': 'Super administrateur',
  'admin-web': 'Administrateur web',
  ecommerce: 'E-commerce manager',
  commercial: 'Commercial B2B',
  'service-client': 'Service client',
  editeur: 'Éditeur',
  analyste: 'Analyste',
};

/** Tous les rôles sauf « client » donnent accès au back-office (avec double authentification obligatoire). */
export function isStaff(role: string | null | undefined): boolean {
  return !!role && role !== 'client' && role in roles;
}

type Permissions = { [K in keyof typeof statements]?: (typeof statements)[K][number][] };

export function can(role: string | null | undefined, permissions: Permissions): boolean {
  if (!role || !(role in roles)) return false;
  return roles[role as RoleName].authorize(permissions).success;
}
