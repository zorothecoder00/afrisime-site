// Textes des pages modifiables depuis le back-office (Textes du site) : accueil, pied de page,
// Qui sommes-nous, contact, activités, B2B, carrières, investir, partenaires. Chaque page est une ligne `texts.<page>` de la table `settings`.
// Un champ laissé vide reprend le texte par défaut défini ici ; les listes à puces gardent
// leur nombre d'éléments (chacun a son icône), les listes « une ligne par élément » sont libres.
import { eq } from 'drizzle-orm';
import { settings } from '../db/schema';
import { cached, invalidate } from './cache';
import { db } from './db';

type Item = Record<string, string>;
type Value = string | string[] | Item[];

export const DEFAULT_TEXTS = {
  accueil: {
    heroEyebrow: 'Local · Importé · Gros · Demi-gros · Détail · B2B',
    heroTitle: 'La distribution alimentaire, autrement.',
    heroText: 'Les produits du quotidien au juste prix, livrés chez vous ou dans votre commerce. Pour les ménages comme pour les professionnels.',
    heroCtaShop: 'Découvrir la boutique',
    heroCtaPro: 'Je suis un professionnel',
    heroBadges: ['Paiement Mobile Money', 'Livraison sous 24 h à Lomé', 'Prix de gros pour les pros'],
    carouselTitle: 'Faites le tour de nos rayons',
    categoriesEyebrow: 'Nos rayons',
    categoriesTitle: 'Parcourir par catégorie',
    popularEyebrow: 'Les plus demandés',
    popularTitle: 'Produits populaires',
    promoEyebrow: 'Offres du moment',
    promoTitle: 'Nos promotions',
    promoText: 'Une sélection de produits à prix réduit, renouvelée chaque mois.',
    promoCta: 'Voir toutes les promotions',
    reasonsEyebrow: 'Pourquoi AfriSime',
    reasonsTitle: 'Un distributeur sur qui compter',
    reasons: [
      { title: 'Disponibilité', text: 'Un stock suivi en temps réel sur les produits essentiels.' },
      { title: 'Proximité', text: 'Un dépôt à Lomé et des points de retrait près de chez vous.' },
      { title: 'Livraison', text: 'Sous 24 h à Lomé, et partout au Togo.' },
      { title: 'Qualité', text: 'Produits sélectionnés, stockés dans de bonnes conditions.' },
      { title: 'Diversité', text: 'Produits locaux et importés, du sachet au sac de 100 kg.' },
      { title: 'Service', text: 'Un conseiller joignable par téléphone et WhatsApp.' },
    ],
    b2bEyebrow: 'Solutions B2B',
    b2bTitle: 'Professionnels, approvisionnez-vous en direct',
    b2bText: 'Prix volume, livraisons programmées et un commercial dédié pour votre activité.',
    b2bCta: 'Demander un devis',
    b2bSegments: [
      { title: 'Commerçants', text: 'Réassort rapide et prix demi-gros pour boutiques et superettes.' },
      { title: 'Revendeurs & grossistes', text: 'Volumes, prix dégressifs et livraison programmée.' },
      { title: 'Restaurants & hôtels', text: 'Approvisionnement régulier, facturation mensuelle.' },
      { title: 'Entreprises & institutions', text: "Cantines, ONG, écoles : appels d'offres et contrats cadres." },
    ],
    brandsEyebrow: 'Nos marques',
    brandsTitle: 'Des marques de confiance',
    mediaEyebrow: 'Média',
    mediaTitle: 'Actualités & conseils',
    helpTitle: 'Comment pouvons-nous vous aider ?',
    helpCards: [
      { title: 'Commander', text: 'Pour la maison' },
      { title: 'Demander un devis', text: 'Pour les professionnels' },
      { title: 'Devenir partenaire', text: 'Fournisseurs, dépôt-vente' },
    ],
  },
  pied: {
    about: 'Distribution alimentaire à Lomé : produits locaux et importés, en gros, demi-gros et détail.',
    newsletterTitle: 'Newsletter',
    newsletterText: 'Promotions, nouveautés et conseils, une fois par mois.',
    newsletterConsent: "J'accepte de recevoir les communications d'AfriSime.",
    newsletterSuccess: 'Merci, vous êtes inscrit à la newsletter.',
    copyright: 'Tous droits réservés.',
  },
  afrisime: {
    heroEyebrow: 'AfriSime',
    heroTitle: 'Rendre les bons produits accessibles à tous',
    heroText:
      'Distributeur alimentaire basé à Lomé, AfriSime relie producteurs, importateurs, commerçants et familles avec une promesse simple : disponibilité, qualité et juste prix.',
    figures: [
      { value: '2 000+', label: 'références produits' },
      { value: '1 500', label: 'clients professionnels' },
      { value: '24 h', label: 'délai de livraison à Lomé' },
      { value: '12', label: 'coopératives partenaires' },
    ],
    historyEyebrow: 'Notre histoire',
    historyTitle: "D'un dépôt de quartier à un réseau de distribution",
    historyText: [
      "AfriSime est née d'un constat : au Togo, trouver les produits du quotidien au bon prix, au bon moment et en bonne quantité reste un défi, pour les familles comme pour les commerçants.",
      "Parti d'un dépôt à Lomé, AfriSime s'est structuré autour de trois métiers : le gros et le demi-gros pour les revendeurs, le détail pour les ménages, et l'approvisionnement des entreprises et institutions.",
    ].join('\n\n'),
    welcomeEyebrow: 'Mot de bienvenue',
    vision: "Devenir la référence de la distribution alimentaire moderne en Afrique de l'Ouest.",
    mission: "Rendre les produits alimentaires de qualité disponibles, accessibles et abordables, du producteur jusqu'au consommateur.",
    valuesEyebrow: 'Nos valeurs',
    valuesTitle: 'Ce qui nous guide',
    values: [
      { title: 'Fiabilité', text: 'Tenir nos engagements de prix, de qualité et de délai.' },
      { title: 'Proximité', text: "Être accessibles, à l'écoute et présents près de nos clients." },
      { title: 'Ancrage local', text: 'Valoriser la production togolaise et les filières locales.' },
      { title: 'Exigence', text: 'Sélectionner, contrôler et conserver nos produits avec soin.' },
    ],
    governanceEyebrow: 'Gouvernance',
    governanceTitle: 'Une organisation structurée',
    governanceText:
      "AfriSime s'appuie sur une direction générale et des pôles dédiés : achats, logistique, ventes B2B, e-commerce, finance et contrôle. Nos processus sont outillés par un ERP interne pour garantir traçabilité et fiabilité.",
    governancePoles: ['Direction générale', 'Achats & fournisseurs', 'Logistique & entrepôts', 'Ventes B2B', 'E-commerce & marketing', 'Finance & contrôle'],
    commitmentsEyebrow: 'Engagements & RSE',
    commitmentsTitle: 'Une croissance responsable',
    commitments: [
      { title: 'Filières locales', text: 'Achats directs auprès de coopératives, prix connus avant récolte, paiement sous 7 jours.' },
      { title: 'Sécurité alimentaire', text: "Stockage ventilé, rotation des stocks, contrôle des dates et de l'état des produits." },
      { title: 'Emploi', text: 'Recrutement et formation de jeunes aux métiers de la logistique et de la vente.' },
      { title: 'Environnement', text: 'Optimisation des tournées de livraison et réduction des emballages plastiques.' },
    ],
    ctaInvest: 'Investir dans AfriSime',
    ctaJoin: 'Nous rejoindre',
  },
  contact: {
    heroEyebrow: 'Contact',
    heroTitle: 'Parlons-en',
    heroText: 'Une question, une commande, un projet ? Notre équipe vous répond du lundi au samedi.',
    phoneLabel: 'Téléphone',
    whatsappLabel: 'WhatsApp',
    whatsappText: 'Écrivez-nous',
    emailLabel: 'E-mail',
    addressLabel: 'Dépôt principal',
    formTitle: 'Écrivez-nous',
    subjects: ['Question sur une commande', "Recherche d'un produit", 'Demande professionnelle (B2B)', 'Partenariat / fournisseur', 'Réclamation', 'Presse / média', 'Autre'],
    consent: "J'accepte qu'AfriSime utilise ces informations pour répondre à ma demande.",
    submit: 'Envoyer le message',
    success: 'Merci ! Votre message est bien envoyé. Nous vous répondons sous 24 h ouvrées.',
    mapUrl: 'https://www.openstreetmap.org/export/embed.html?bbox=1.18%2C6.11%2C1.27%2C6.17&layer=mapnik',
  },
  activites: {
    heroEyebrow: 'Nos activités',
    heroTitle: 'Un distributeur, plusieurs métiers',
    heroText: 'Du sachet de sel au camion complet, AfriSime sert chaque client avec le format, le prix et le service qui lui conviennent.',
    activities: [
      {
        title: 'Gros & demi-gros',
        text: 'Pour les revendeurs, boutiques et grossistes : des volumes importants à prix dégressifs, du carton au camion complet.',
        points: 'Sacs, cartons, bidons, palettes\nPrix volume et remises de fidélité\nLivraison programmée',
        cta: 'Demander un prix de gros',
      },
      {
        title: 'Détail',
        text: 'Pour les ménages : les produits du quotidien en petits formats, en boutique, en ligne ou par WhatsApp.',
        points: 'Boutique en ligne\nRetrait gratuit au dépôt\nLivraison à domicile',
        cta: 'Faire mes courses',
      },
      {
        title: 'Restaurants & hôtellerie',
        text: 'Un approvisionnement régulier et fiable pour les cuisines professionnelles.',
        points: 'Formats professionnels\nLivraison hebdomadaire\nFacturation mensuelle',
        cta: 'Voir les solutions B2B',
      },
      {
        title: 'Entreprises & institutions',
        text: "Cantines, ONG, écoles, administrations : réponse aux appels d'offres et contrats cadres.",
        points: 'Dossiers administratifs complets\nContrats annuels\nInterlocuteur dédié',
        cta: 'Contacter un commercial',
      },
      {
        title: 'Logistique & distribution',
        text: "Entrepôts à Lomé et flotte de livraison pour servir le Grand Lomé et l'intérieur du pays.",
        points: 'Stockage ventilé et sécurisé\nTournées optimisées\nSuivi des livraisons',
        cta: 'Devenir partenaire logistique',
      },
    ],
  },
  b2b: {
    heroEyebrow: 'Solutions B2B',
    heroTitle: "L'approvisionnement des professionnels, simplifié",
    heroText: 'Commerçants, revendeurs, restaurants, entreprises : AfriSime vous livre en volume, au prix juste, avec un interlocuteur dédié.',
    ctaQuote: 'Demander un devis',
    ctaCall: 'Appeler un commercial',
    segments: [
      { title: 'Commerçants & boutiques', text: 'Réassort rapide pour boutiques de quartier, superettes et kiosques.', points: 'Prix demi-gros dès 5 cartons\nLivraison en 24 h\nCommande par WhatsApp' },
      { title: 'Revendeurs & grossistes', text: 'Volumes importants, prix dégressifs et livraison programmée.', points: 'Grille tarifaire volume\nCamion complet ou groupage\nCrédit fournisseur sur dossier' },
      { title: 'Restaurants, hôtels & traiteurs', text: 'Un approvisionnement régulier pour ne jamais manquer.', points: 'Livraison hebdomadaire\nFacturation mensuelle\nFormats professionnels' },
      { title: 'Entreprises & institutions', text: "Cantines, ONG, écoles, administrations : contrats cadres et appels d'offres.", points: 'Contrat cadre annuel\nDocuments administratifs\nInterlocuteur dédié' },
    ],
    stepsTitle: 'Comment ça marche',
    steps: [
      { title: 'Votre demande', text: 'Produits, volumes et fréquence souhaités.' },
      { title: 'Qualification', text: 'Un commercial vous rappelle sous 24 h ouvrées.' },
      { title: 'Devis', text: 'Une offre de prix adaptée à vos volumes.' },
      { title: 'Commande & livraison', text: 'Livraison programmée et suivi de vos commandes.' },
    ],
    formEyebrow: 'Demande de devis',
    formTitle: 'Parlez-nous de vos besoins',
    formText: 'Réponse sous 24 h ouvrées. Plus votre demande est précise, plus notre offre sera juste.',
    directTitle: 'Vous préférez échanger directement ?',
    whatsappLabel: 'WhatsApp commercial',
    sectors: ['Boutique / commerce', 'Revendeur / grossiste', 'Restaurant / hôtel / traiteur', 'Entreprise', 'Institution / ONG / école', 'Autre'],
    frequencies: ['Ponctuelle', 'Hebdomadaire', 'Bimensuelle', 'Mensuelle'],
    budgets: ['Moins de 500 000 FCFA', '500 000 – 2 000 000 FCFA', '2 – 10 millions FCFA', 'Plus de 10 millions FCFA'],
    consent: "J'accepte qu'AfriSime utilise ces informations pour me recontacter au sujet de ma demande.",
    submit: 'Envoyer ma demande de devis',
    success: 'Merci ! Votre demande de devis est enregistrée. Un commercial vous rappelle sous 24 h ouvrées.',
  },
  carrieres: {
    heroEyebrow: 'Carrières',
    heroTitle: "Rejoignez l'équipe AfriSime",
    heroText: 'Logistique, vente, e-commerce, finance : construisons ensemble la distribution alimentaire de demain.',
    jobsTitle: 'Offres ouvertes',
    noJobs: 'Aucune offre ouverte pour le moment. Vous pouvez nous adresser une candidature spontanée.',
    cultureTitle: 'Notre culture',
    culture: ["Formation à l'embauche et tout au long du parcours", 'Évolution interne privilégiée', "Esprit d'équipe et exigence du service client"],
    formTitle: 'Candidature',
    formText: 'Pour une offre ou en candidature spontanée. Nous vous demanderons votre CV si votre profil est retenu.',
    spontaneous: 'Candidature spontanée',
    consent: "J'accepte qu'AfriSime conserve ma candidature pendant 12 mois.",
    submit: 'Envoyer ma candidature',
    success: 'Merci pour votre candidature ! Nous revenons vers vous si votre profil correspond.',
  },
  investir: {
    heroEyebrow: 'Investisseurs & institutions',
    heroTitle: 'Investir dans la distribution de demain',
    heroText: 'AfriSime construit un réseau de distribution alimentaire moderne, connecté et à fort impact local.',
    pillars: [
      { title: 'Un marché essentiel', text: "L'alimentation représente la première dépense des ménages togolais, avec une demande stable et croissante." },
      { title: 'Un modèle multicanal', text: 'Gros, détail, B2B et e-commerce : des revenus diversifiés et une clientèle large.' },
      { title: 'Des outils modernes', text: 'ERP interne, plateforme e-commerce et données de vente pour piloter la croissance.' },
      { title: 'Un impact local', text: 'Des filières agricoles structurées et des emplois créés dans la logistique et la vente.' },
    ],
    formTitle: 'Relations investisseurs',
    formText: 'Pour recevoir notre présentation ou organiser un échange avec la direction, laissez-nous vos coordonnées.',
    consent: "J'accepte qu'AfriSime utilise ces informations pour me recontacter.",
    submit: 'Envoyer',
    success: 'Merci. La direction vous recontactera rapidement.',
  },
  partenaires: {
    heroEyebrow: 'Partenaires',
    heroTitle: 'Grandissons ensemble',
    heroText: 'AfriSime travaille avec des producteurs locaux, des importateurs et des partenaires commerciaux pour rendre les bons produits accessibles partout au Togo.',
    offers: [
      { title: 'Devenir fournisseur', text: 'Producteurs, transformateurs, importateurs : référencez vos produits dans notre réseau de distribution.' },
      { title: 'Dépôt-vente', text: 'Confiez-nous vos produits : nous les stockons, les vendons et vous reversons les ventes.' },
      { title: 'Partenaire commercial', text: 'Distributeurs, agents, points relais : développons ensemble de nouvelles zones.' },
      { title: 'Grossiste partenaire', text: 'Approvisionnez-vous en volume avec des conditions dédiées et une logistique partagée.' },
    ],
    formEyebrow: 'Formulaire de qualification',
    formTitle: 'Proposez votre partenariat',
    formText: 'Notre équipe achats étudie chaque proposition et vous répond sous 5 jours ouvrés.',
    criteriaTitle: 'Ce que nous regardons',
    criteria: [
      'Produits conformes aux normes sanitaires en vigueur',
      'Capacité de production régulière',
      'Traçabilité et étiquetage clairs',
      'Prix compétitifs et conditions de paiement transparentes',
    ],
    partnershipTypes: ['Fournisseur', 'Dépôt-vente', 'Partenaire commercial', 'Grossiste', 'Autre'],
    consent: "J'accepte qu'AfriSime utilise ces informations pour étudier ma proposition et me recontacter.",
    submit: 'Envoyer ma proposition',
    success: 'Merci ! Votre proposition est transmise à notre équipe achats. Réponse sous 5 jours ouvrés.',
  },
};

/** Liste à puces saisie « un élément par ligne » dans un champ d'une carte. */
export const splitLines = (value: string) =>
  value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

export type TextPage = keyof typeof DEFAULT_TEXTS;
export type PageTexts<P extends TextPage> = (typeof DEFAULT_TEXTS)[P];

/* ───────── Formulaire du back-office ───────── */

export type TextField =
  | { key: string; label: string; kind: 'text' | 'textarea'; max: number; hint?: string }
  /** Liste libre : une ligne par élément. */
  | { key: string; label: string; kind: 'lines'; max: number; hint?: string }
  /** Liste à nombre fixe d'éléments (chacun a son icône ou sa place dans la mise en page). */
  | { key: string; label: string; kind: 'items'; fields: { key: string; label: string; max: number }[] };

const text = (key: string, label: string, max = 160, hint?: string): TextField => ({ key, label, kind: 'text', max, hint });
const area = (key: string, label: string, max = 600, hint?: string): TextField => ({ key, label, kind: 'textarea', max, hint });
const titled = (key: string, label: string): TextField => ({
  key,
  label,
  kind: 'items',
  fields: [
    { key: 'title', label: 'Titre', max: 80 },
    { key: 'text', label: 'Texte', max: 200 },
  ],
});
/** Cartes avec titre, texte et puces (une par ligne), et éventuellement un bouton. */
const cards = (key: string, label: string, withCta = false): TextField => ({
  key,
  label,
  kind: 'items',
  fields: [
    { key: 'title', label: 'Titre', max: 80 },
    { key: 'text', label: 'Texte', max: 300 },
    { key: 'points', label: 'Points (un par ligne)', max: 400 },
    ...(withCta ? [{ key: 'cta', label: 'Bouton', max: 50 }] : []),
  ],
});
const PARAGRAPHS = 'Laissez une ligne vide entre deux paragraphes.';
const ONE_PER_LINE = 'Un élément par ligne.';
const hero = { title: 'En-tête', fields: [text('heroEyebrow', 'Surtitre'), text('heroTitle', 'Titre', 120), area('heroText', 'Texte', 400)] };
const leadForm = (fields: TextField[] = []) => ({
  title: 'Formulaire',
  fields: [...fields, area('consent', 'Case de consentement', 300), text('submit', 'Bouton', 60), area('success', 'Message après envoi', 300)],
});

export const TEXT_PAGES: Record<TextPage, { label: string; path: string; sections: { title: string; fields: TextField[] }[] }> = {
  accueil: {
    label: 'Accueil',
    path: '/',
    sections: [
      {
        title: 'Bandeau principal',
        fields: [
          text('heroEyebrow', 'Surtitre'),
          text('heroTitle', 'Titre', 120),
          area('heroText', 'Texte', 400),
          text('heroCtaShop', 'Bouton boutique', 40),
          text('heroCtaPro', 'Bouton professionnels', 40),
          { key: 'heroBadges', label: 'Arguments sous les boutons', kind: 'lines', max: 60, hint: `${ONE_PER_LINE} 3 à 4 conseillés.` },
        ],
      },
      { title: 'Rayons', fields: [text('carouselTitle', 'Titre du carrousel'), text('categoriesEyebrow', 'Surtitre des catégories'), text('categoriesTitle', 'Titre des catégories')] },
      {
        title: 'Produits et promotions',
        fields: [
          text('popularEyebrow', 'Surtitre des produits populaires'),
          text('popularTitle', 'Titre des produits populaires'),
          text('promoEyebrow', 'Surtitre des promotions'),
          text('promoTitle', 'Titre des promotions', 120, 'Remplacé par la campagne « accueil-offres » quand une campagne est active.'),
          area('promoText', 'Texte des promotions', 300),
          text('promoCta', 'Bouton des promotions', 40),
        ],
      },
      { title: 'Pourquoi AfriSime', fields: [text('reasonsEyebrow', 'Surtitre'), text('reasonsTitle', 'Titre'), titled('reasons', 'Arguments')] },
      {
        title: 'Solutions B2B',
        fields: [text('b2bEyebrow', 'Surtitre'), text('b2bTitle', 'Titre'), area('b2bText', 'Texte', 300), text('b2bCta', 'Bouton', 40), titled('b2bSegments', 'Publics')],
      },
      { title: 'Marques et média', fields: [text('brandsEyebrow', 'Surtitre des marques'), text('brandsTitle', 'Titre des marques'), text('mediaEyebrow', 'Surtitre média'), text('mediaTitle', 'Titre média')] },
      { title: 'Appel à l’action final', fields: [text('helpTitle', 'Titre'), titled('helpCards', 'Cartes')] },
    ],
  },
  pied: {
    label: 'Pied de page',
    path: '/',
    sections: [
      {
        title: 'Sous le logo',
        fields: [area('about', 'Présentation', 300, 'Adresse, téléphone, e-mail et horaires : Paramètres › Identité et coordonnées.')],
      },
      {
        title: 'Newsletter',
        fields: [text('newsletterTitle', 'Titre', 40), area('newsletterText', 'Texte', 200), area('newsletterConsent', 'Case de consentement', 200), text('newsletterSuccess', 'Message après inscription', 160)],
      },
      { title: 'Bas de page', fields: [text('copyright', 'Mention après « © année Nom »', 120)] },
    ],
  },
  afrisime: {
    label: 'Qui sommes-nous',
    path: '/afrisime',
    sections: [
      { title: 'En-tête', fields: [text('heroEyebrow', 'Surtitre'), text('heroTitle', 'Titre', 120), area('heroText', 'Texte', 400)] },
      {
        title: 'Chiffres clés',
        fields: [
          {
            key: 'figures',
            label: 'Chiffres',
            kind: 'items',
            fields: [
              { key: 'value', label: 'Valeur', max: 20 },
              { key: 'label', label: 'Libellé', max: 60 },
            ],
          },
        ],
      },
      {
        title: 'Notre histoire',
        fields: [
          text('historyEyebrow', 'Surtitre'),
          text('historyTitle', 'Titre', 120),
          area('historyText', 'Texte', 3000, PARAGRAPHS),
          text('welcomeEyebrow', 'Surtitre du mot du dirigeant', 60, 'Titre, nom, photo et message : Paramètres › Mot du dirigeant.'),
        ],
      },
      { title: 'Vision et mission', fields: [area('vision', 'Vision', 300), area('mission', 'Mission', 300)] },
      { title: 'Valeurs', fields: [text('valuesEyebrow', 'Surtitre'), text('valuesTitle', 'Titre'), titled('values', 'Valeurs')] },
      {
        title: 'Gouvernance',
        fields: [
          text('governanceEyebrow', 'Surtitre'),
          text('governanceTitle', 'Titre'),
          area('governanceText', 'Texte', 800),
          { key: 'governancePoles', label: 'Pôles', kind: 'lines', max: 60, hint: ONE_PER_LINE },
        ],
      },
      {
        title: 'Engagements & RSE',
        fields: [text('commitmentsEyebrow', 'Surtitre'), text('commitmentsTitle', 'Titre'), titled('commitments', 'Engagements'), text('ctaInvest', 'Bouton investir', 40), text('ctaJoin', 'Bouton carrières', 40)],
      },
    ],
  },
  contact: {
    label: 'Contact',
    path: '/contact',
    sections: [
      { title: 'En-tête', fields: [text('heroEyebrow', 'Surtitre'), text('heroTitle', 'Titre', 120), area('heroText', 'Texte', 400)] },
      {
        title: 'Coordonnées',
        fields: [
          text('phoneLabel', 'Libellé téléphone', 40, 'Numéros, e-mail, adresse et horaires : Paramètres › Identité et coordonnées.'),
          text('whatsappLabel', 'Libellé WhatsApp', 40),
          text('whatsappText', 'Texte WhatsApp', 60),
          text('emailLabel', 'Libellé e-mail', 40),
          text('addressLabel', 'Libellé adresse', 40),
          text('mapUrl', 'Lien de la carte', 500, 'Lien « intégrer » d’OpenStreetMap (openstreetmap.org/export/embed.html…) ou de Google Maps (google.com/maps/embed…).'),
        ],
      },
      {
        title: 'Formulaire',
        fields: [
          text('formTitle', 'Titre', 60),
          { key: 'subjects', label: 'Sujets proposés', kind: 'lines', max: 80, hint: `${ONE_PER_LINE} Un sujet contenant « réclamation » crée une réclamation suivie par le service client.` },
          area('consent', 'Case de consentement', 300),
          text('submit', 'Bouton', 40),
          area('success', 'Message après envoi', 300),
        ],
      },
    ],
  },
  activites: {
    label: 'Activités',
    path: '/activites',
    sections: [hero, { title: 'Métiers', fields: [cards('activities', 'Activités', true)] }],
  },
  b2b: {
    label: 'Solutions B2B',
    path: '/b2b',
    sections: [
      { ...hero, fields: [...hero.fields, text('ctaQuote', 'Bouton devis', 40), text('ctaCall', 'Bouton appel', 40)] },
      { title: 'Publics', fields: [cards('segments', 'Publics')] },
      { title: 'Comment ça marche', fields: [text('stepsTitle', 'Titre'), titled('steps', 'Étapes')] },
      leadForm([
        text('formEyebrow', 'Surtitre'),
        text('formTitle', 'Titre', 120),
        area('formText', 'Texte', 300),
        text('directTitle', 'Titre de l’encadré contact', 120, 'Numéro de téléphone et WhatsApp : Paramètres › Identité et coordonnées.'),
        text('whatsappLabel', 'Libellé WhatsApp', 60),
        { key: 'sectors', label: 'Choix « Secteur »', kind: 'lines', max: 80, hint: ONE_PER_LINE },
        { key: 'frequencies', label: 'Choix « Fréquence »', kind: 'lines', max: 80, hint: ONE_PER_LINE },
        { key: 'budgets', label: 'Choix « Volume mensuel estimé »', kind: 'lines', max: 80, hint: ONE_PER_LINE },
      ]),
    ],
  },
  carrieres: {
    label: 'Carrières',
    path: '/carrieres',
    sections: [
      hero,
      {
        title: 'Offres et culture',
        fields: [
          text('jobsTitle', 'Titre des offres', 80, 'Les offres elles-mêmes se gèrent dans la rubrique Offres d’emploi.'),
          area('noJobs', 'Message quand aucune offre n’est ouverte', 300),
          text('cultureTitle', 'Titre de l’encadré culture', 80),
          { key: 'culture', label: 'Culture', kind: 'lines', max: 120, hint: ONE_PER_LINE },
        ],
      },
      leadForm([text('formTitle', 'Titre', 80), area('formText', 'Texte', 300), text('spontaneous', 'Choix « candidature spontanée »', 60)]),
    ],
  },
  investir: {
    label: 'Investir',
    path: '/investir',
    sections: [hero, { title: 'Arguments', fields: [titled('pillars', 'Arguments')] }, leadForm([text('formTitle', 'Titre', 80), area('formText', 'Texte', 300)])],
  },
  partenaires: {
    label: 'Partenaires',
    path: '/partenaires',
    sections: [
      hero,
      { title: 'Types de partenariat', fields: [titled('offers', 'Partenariats')] },
      leadForm([
        text('formEyebrow', 'Surtitre'),
        text('formTitle', 'Titre', 120),
        area('formText', 'Texte', 300),
        text('criteriaTitle', 'Titre des critères', 80),
        { key: 'criteria', label: 'Critères', kind: 'lines', max: 160, hint: ONE_PER_LINE },
        { key: 'partnershipTypes', label: 'Choix « Type de partenariat »', kind: 'lines', max: 60, hint: ONE_PER_LINE },
      ]),
    ],
  },
};

/* ───────── Lecture et enregistrement ───────── */

const settingsKey = (page: TextPage) => `texts.${page}`;

/** Texte par défaut pour tout champ vide ; listes fixes : même nombre d'éléments que par défaut. */
function merge(defaults: Record<string, Value>, stored: Record<string, unknown>): Record<string, Value> {
  const out: Record<string, Value> = {};
  for (const [key, def] of Object.entries(defaults)) {
    const value = stored[key];
    if (typeof def === 'string') {
      out[key] = typeof value === 'string' && value.trim() ? value.trim() : def;
    } else if (def.every((d) => typeof d === 'string')) {
      const lines = Array.isArray(value) ? value.filter((l): l is string => typeof l === 'string' && !!l.trim()) : [];
      out[key] = lines.length ? lines : def;
    } else {
      out[key] = (def as Item[]).map((d, i) => {
        const item = Array.isArray(value) && value[i] && typeof value[i] === 'object' ? (value[i] as Record<string, unknown>) : {};
        return Object.fromEntries(Object.entries(d).map(([k, v]) => [k, typeof item[k] === 'string' && (item[k] as string).trim() ? (item[k] as string).trim() : v]));
      });
    }
  }
  return out;
}

export function getPageTexts<P extends TextPage>(page: P): Promise<PageTexts<P>> {
  return cached(`texts:${page}`, 60_000, async () => {
    const [row] = await db.select().from(settings).where(eq(settings.key, settingsKey(page)));
    return merge(DEFAULT_TEXTS[page] as Record<string, Value>, (row?.value ?? {}) as Record<string, unknown>) as PageTexts<P>;
  });
}

/** Lit le formulaire du back-office selon la description de la page. */
export function textsFromForm(page: TextPage, form: FormData): Record<string, Value> {
  const get = (name: string, max: number) => String(form.get(name) ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);
  const out: Record<string, Value> = {};
  for (const field of TEXT_PAGES[page].sections.flatMap((s) => s.fields)) {
    if (field.kind === 'lines') {
      out[field.key] = get(field.key, 4000)
        .split('\n')
        .map((l) => l.trim().slice(0, field.max))
        .filter(Boolean)
        .slice(0, 30);
    } else if (field.kind === 'items') {
      const count = (DEFAULT_TEXTS[page] as Record<string, Value>)[field.key].length;
      out[field.key] = Array.from({ length: count }, (_, i) => Object.fromEntries(field.fields.map((f) => [f.key, get(`${field.key}.${i}.${f.key}`, f.max)])));
    } else {
      out[field.key] = get(field.key, field.max);
    }
  }
  return out;
}

export async function savePageTexts(page: TextPage, value: Record<string, Value> | null, actorId: string) {
  if (value) {
    await db
      .insert(settings)
      .values({ key: settingsKey(page), value, updatedBy: actorId })
      .onConflictDoUpdate({ target: settings.key, set: { value, updatedBy: actorId, updatedAt: new Date() } });
  } else {
    await db.delete(settings).where(eq(settings.key, settingsKey(page)));
  }
  invalidate(`texts:${page}`);
}

/** Carte intégrée : uniquement OpenStreetMap ou Google Maps, en https. */
export function safeMapUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return null;
    if (u.hostname === 'www.openstreetmap.org' && u.pathname.startsWith('/export/embed.html')) return u.href;
    if (/^(www\.)?google\.[a-z.]+$/.test(u.hostname) && u.pathname.startsWith('/maps/embed')) return u.href;
    return null;
  } catch {
    return null;
  }
}
