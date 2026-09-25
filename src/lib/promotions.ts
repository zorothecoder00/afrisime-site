// Codes promo et campagnes administrés dans le back-office (§10 Promotions).
import { and, asc, eq, gt, isNull, lte, or, sql } from 'drizzle-orm';
import { campaigns, promoCodes } from '../db/schema';
import { cached } from './cache';
import { db } from './db';
import type { PromoRule } from './pricing';

export type PromoCheck = { ok: true; rule: PromoRule; description: string } | { ok: false; message: string };

export function normalizeCode(code: unknown) {
  return typeof code === 'string' ? code.trim().toUpperCase().slice(0, 40) : '';
}

/** Vérifie un code : actif, dans ses dates, sous sa limite d'utilisation, montant minimum atteint. */
export async function checkPromo(rawCode: unknown, subtotal: number): Promise<PromoCheck | null> {
  const code = normalizeCode(rawCode);
  if (!code) return null;
  const [row] = await db.select().from(promoCodes).where(eq(promoCodes.code, code)).limit(1);
  const now = new Date();
  if (!row || !row.active || (row.startsAt && row.startsAt > now) || (row.endsAt && row.endsAt < now)) {
    return { ok: false, message: "Ce code promo n'est pas valide." };
  }
  if (row.usageLimit !== null && row.usedCount >= row.usageLimit) return { ok: false, message: 'Ce code promo a atteint sa limite d’utilisation.' };
  if (subtotal < row.minSubtotal) {
    return { ok: false, message: `Ce code s'applique dès ${row.minSubtotal.toLocaleString('fr-FR')} FCFA d'achats.` };
  }
  return {
    ok: true,
    description: row.description,
    rule: { code: row.code, kind: row.kind === 'montant' ? 'montant' : 'pourcentage', value: row.value, maxDiscount: row.maxDiscount, minSubtotal: row.minSubtotal },
  };
}

/**
 * Compte une utilisation. Renvoie false si la limite a été atteinte entre-temps
 * (deux commandes simultanées ne peuvent pas dépasser la limite).
 */
export async function consumePromo(tx: Pick<typeof db, 'update'>, code: string) {
  const updated = await tx
    .update(promoCodes)
    .set({ usedCount: sql`${promoCodes.usedCount} + 1` })
    .where(and(eq(promoCodes.code, code), or(isNull(promoCodes.usageLimit), gt(promoCodes.usageLimit, promoCodes.usedCount))))
    .returning({ code: promoCodes.code });
  return updated.length > 0;
}

export type Campaign = typeof campaigns.$inferSelect;

/** Campagnes actives aujourd'hui pour un emplacement. */
export function activeCampaigns(placement: string): Promise<Campaign[]> {
  return cached(`campaigns:${placement}`, 60_000, () => {
    const now = new Date();
    return db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.placement, placement),
          eq(campaigns.active, true),
          or(isNull(campaigns.startsAt), lte(campaigns.startsAt, now)),
          or(isNull(campaigns.endsAt), gt(campaigns.endsAt, now)),
        ),
      )
      .orderBy(asc(campaigns.position));
  });
}

export const PLACEMENTS = {
  'accueil-offres': 'Accueil : bloc « Offres du moment »',
  bandeau: 'Bandeau en haut de toutes les pages',
} as const;
