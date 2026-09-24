// Informations générales du site. Les coordonnées ci-dessous sont des exemples
// à remplacer par les vraies données d'AfriSime avant la mise en ligne.

export const SITE = {
  name: 'AfriSime',
  tagline: 'La distribution alimentaire, autrement.',
  description:
    "AfriSime, distributeur alimentaire à Lomé : produits locaux et importés, vente en gros, demi-gros et détail, solutions B2B pour commerçants, restaurants et entreprises.",
  locale: 'fr_TG',
  currency: 'XOF',
  contact: {
    phone: '+228 90 00 00 00',
    phoneHref: 'tel:+22890000000',
    whatsapp: 'https://wa.me/22890000000',
    email: 'contact@afrisime.com',
    address: 'Boulevard du 13 Janvier, Lomé, Togo',
    hours: 'Lun – Sam : 7h30 – 19h00',
    mapQuery: 'Lomé, Togo',
  },
  social: [
    { label: 'Facebook', href: 'https://facebook.com/' },
    { label: 'Instagram', href: 'https://instagram.com/' },
    { label: 'LinkedIn', href: 'https://linkedin.com/' },
    { label: 'TikTok', href: 'https://tiktok.com/' },
  ],
};

export type NavItem = { label: string; href: string; children?: { label: string; href: string }[] };

export const NAV: NavItem[] = [
  { label: 'Accueil', href: '/' },
  {
    label: 'AfriSime',
    href: '/afrisime',
    children: [
      { label: 'Notre histoire', href: '/afrisime#histoire' },
      { label: 'Vision & mission', href: '/afrisime#vision' },
      { label: 'Valeurs', href: '/afrisime#valeurs' },
      { label: 'Engagements & RSE', href: '/afrisime#engagements' },
      { label: 'Investir', href: '/investir' },
      { label: 'Carrières', href: '/carrieres' },
    ],
  },
  {
    label: 'Activités',
    href: '/activites',
    children: [
      { label: 'Gros & demi-gros', href: '/activites#gros' },
      { label: 'Détail', href: '/activites#detail' },
      { label: 'Entreprises & institutions', href: '/activites#institutions' },
      { label: 'Logistique & distribution', href: '/activites#logistique' },
    ],
  },
  { label: 'Boutique', href: '/boutique' },
  { label: 'Solutions B2B', href: '/b2b' },
  { label: 'Partenaires', href: '/partenaires' },
  { label: 'Média', href: '/media' },
  { label: 'Contact', href: '/contact' },
];

// Zones de livraison et frais (FCFA). Le serveur recalcule toujours ces frais :
// voir src/lib/pricing.ts.
export const DELIVERY_ZONES = [
  { id: 'retrait', label: 'Retrait au dépôt AfriSime (gratuit)', fee: 0, delay: 'Dès 2 h après confirmation' },
  { id: 'lome-centre', label: 'Lomé centre', fee: 1000, delay: 'Sous 24 h' },
  { id: 'lome-peripherie', label: 'Lomé périphérie (Agoè, Baguida, Adidogomé…)', fee: 2000, delay: '24 à 48 h' },
  { id: 'grand-lome', label: 'Grand Lomé hors périphérie', fee: 3500, delay: '48 h' },
  { id: 'interieur', label: 'Intérieur du pays', fee: 7500, delay: '3 à 5 jours' },
] as const;

export const FREE_DELIVERY_THRESHOLD = 50000;

export const PAYMENT_METHODS = [
  { id: 'mobile-money', label: 'Mobile Money (T-Money, Flooz)', description: 'Paiement sécurisé via notre prestataire.' },
  { id: 'carte', label: 'Carte bancaire', description: 'Visa, Mastercard.' },
  { id: 'livraison', label: 'Paiement à la livraison', description: 'En espèces ou Mobile Money à la réception.' },
] as const;
