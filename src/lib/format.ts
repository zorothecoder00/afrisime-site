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

export const ORDER_STATUS_LABELS = {
  'en-attente-paiement': 'En attente de paiement',
  confirmee: 'Confirmée',
  'en-preparation': 'En préparation',
  expediee: 'Expédiée',
  livree: 'Livrée',
  annulee: 'Annulée',
} as const;

export const LEAD_TYPE_LABELS = {
  b2b: 'Devis B2B',
  fournisseur: 'Fournisseur',
  partenaire: 'Partenaire',
  contact: 'Contact',
  newsletter: 'Newsletter',
  investisseur: 'Investisseur',
  candidature: 'Candidature',
} as const;

export const LEAD_STATUS_LABELS = {
  nouveau: 'Nouveau',
  qualifie: 'Qualifié',
  devis: 'Devis envoyé',
  negociation: 'Négociation',
  commande: 'Commande',
  cloture: 'Clôturé',
} as const;
