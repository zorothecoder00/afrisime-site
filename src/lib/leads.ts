// Suivi commercial des leads (cahier des charges §9) : liste, détail, statut, attribution, notes.
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { leadEvents, leads, user } from '../db/schema';
import { db } from './db';
import { can, roles } from './roles';

export type LeadStatus = (typeof leads.$inferSelect)['status'];

const assignee = alias(user, 'assignee');

export async function listLeads(filters: { status?: string; type?: string; q?: string; mine?: string; limit?: number; offset?: number }) {
  const where: SQL[] = [];
  if (filters.status) where.push(eq(leads.status, filters.status as LeadStatus));
  if (filters.type) where.push(eq(leads.type, filters.type));
  if (filters.mine) where.push(eq(leads.assignedTo, filters.mine));
  if (filters.q) {
    const term = `%${filters.q.replace(/[%_\\]/g, '\\$&')}%`;
    where.push(or(ilike(leads.name, term), ilike(leads.company, term), ilike(leads.phone, term), ilike(leads.email, term))!);
  }
  const condition = where.length ? and(...where) : undefined;
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ lead: leads, assigneeName: assignee.name })
      .from(leads)
      .leftJoin(assignee, eq(assignee.id, leads.assignedTo))
      .where(condition)
      .orderBy(desc(leads.createdAt))
      .limit(filters.limit ?? 25)
      .offset(filters.offset ?? 0),
    db.select({ total: count() }).from(leads).where(condition),
  ]);
  return { rows: rows.map((r) => ({ ...r.lead, assigneeName: r.assigneeName })), total };
}

export async function getLeadDetail(id: string) {
  const [row] = await db
    .select({ lead: leads, assigneeName: assignee.name })
    .from(leads)
    .leftJoin(assignee, eq(assignee.id, leads.assignedTo))
    .where(eq(leads.id, id))
    .limit(1);
  if (!row) return undefined;
  const actor = alias(user, 'actor');
  const events = await db
    .select({ event: leadEvents, actorName: actor.name, assigneeName: assignee.name })
    .from(leadEvents)
    .leftJoin(actor, eq(actor.id, leadEvents.actorId))
    .leftJoin(assignee, eq(assignee.id, leadEvents.assignedTo))
    .where(eq(leadEvents.leadId, id))
    .orderBy(desc(leadEvents.createdAt), desc(leadEvents.id));
  return { lead: { ...row.lead, assigneeName: row.assigneeName }, events };
}

/** Membres de l'équipe à qui un lead peut être attribué (rôles autorisés à traiter les leads). */
export async function assignableStaff() {
  const eligible = Object.keys(roles).filter((role) => role !== 'client' && can(role, { lead: ['update'] }));
  return db.select({ id: user.id, name: user.name, role: user.role }).from(user).where(inArray(user.role, eligible)).orderBy(user.name);
}

/** Rôle chargé de chaque type de demande pour l'attribution automatique. */
const OWNER_ROLE: Record<string, string> = {
  b2b: 'commercial',
  fournisseur: 'commercial',
  partenaire: 'commercial',
  investisseur: 'commercial',
  contact: 'service-client',
  reclamation: 'service-client',
};

/**
 * Attribution automatique (§9) : la demande va au membre du rôle concerné qui a le moins de
 * demandes en cours. Sans personne dans ce rôle, elle reste à attribuer.
 */
export async function autoAssign(leadId: string, type: string) {
  const role = OWNER_ROLE[type];
  if (!role) return null;
  const candidates = await db
    .select({ id: user.id, open: sql<number>`count(${leads.id}) filter (where ${leads.status} <> 'cloture')`.mapWith(Number) })
    .from(user)
    .leftJoin(leads, eq(leads.assignedTo, user.id))
    .where(and(eq(user.role, role), or(isNull(user.banned), eq(user.banned, false))))
    .groupBy(user.id)
    .orderBy(asc(sql`2`), asc(user.createdAt))
    .limit(1);
  const owner = candidates[0];
  if (!owner) return null;
  await db.transaction(async (tx) => {
    await tx.update(leads).set({ assignedTo: owner.id }).where(eq(leads.id, leadId));
    await tx.insert(leadEvents).values({ leadId, assignedTo: owner.id, note: 'Attribution automatique' });
  });
  return owner.id;
}

/** Enregistre les changements (statut, responsable) et une note dans l'historique. */
export async function updateLead(
  id: string,
  changes: { status?: LeadStatus; assignedTo?: string | null; note?: string },
  actorId: string,
) {
  const [current] = await db.select().from(leads).where(eq(leads.id, id));
  if (!current) return false;
  const statusChanged = changes.status && changes.status !== current.status;
  const assigneeChanged = changes.assignedTo !== undefined && changes.assignedTo !== current.assignedTo;
  if (!statusChanged && !assigneeChanged && !changes.note) return true;

  await db.transaction(async (tx) => {
    if (statusChanged || assigneeChanged) {
      await tx
        .update(leads)
        .set({
          ...(statusChanged ? { status: changes.status } : {}),
          ...(assigneeChanged ? { assignedTo: changes.assignedTo } : {}),
        })
        .where(eq(leads.id, id));
    }
    await tx.insert(leadEvents).values({
      leadId: id,
      status: statusChanged ? changes.status : null,
      assignedTo: assigneeChanged ? changes.assignedTo : null,
      note: changes.note || (assigneeChanged && !changes.assignedTo ? 'Attribution retirée' : null),
      actorId,
    });
  });
  return true;
}
