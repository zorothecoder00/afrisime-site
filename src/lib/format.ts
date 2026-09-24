const fcfa = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/** 12500 → « 12 500 FCFA » */
export function formatPrice(value: number): string {
  // Intl utilise une espace fine insécable : on la remplace pour un rendu homogène.
  return `${fcfa.format(value).replace(/ /g, ' ')} FCFA`;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export const STATUS_LABELS = {
  disponible: 'Disponible',
  'sur-commande': 'Sur commande',
  indisponible: 'Temporairement indisponible',
  devis: 'Sur devis',
} as const;

export const BADGE_LABELS = {
  nouveau: 'Nouveau',
  promotion: 'Promotion',
  populaire: 'Populaire',
  rupture: 'Rupture',
  b2b: 'B2B',
  'sur-commande': 'Sur commande',
} as const;

export const ARTICLE_TYPE_LABELS = {
  actualite: 'Actualité',
  conseil: 'Conseil',
  video: 'Vidéo',
  evenement: 'Événement',
  communique: 'Communiqué',
} as const;
