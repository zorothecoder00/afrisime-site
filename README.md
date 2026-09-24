# AfriSime — site web officiel

Vitrine institutionnelle, boutique en ligne et espace B2B d'AfriSime (Astro 7 + Tailwind 4, déployé sur Vercel).

## Démarrer

```sh
npm install
cp .env.example .env         # puis renseigner DATABASE_URL et BETTER_AUTH_SECRET
npm run db:migrate           # crée les tables
npm run admin:create -- vous@afrisime.com "Votre Nom"   # premier super administrateur
npx astro dev --background   # http://localhost:4321
npm run build
```

## Organisation

| Dossier | Contenu |
| --- | --- |
| `src/data/` | Catalogue (produits, catégories, marques), FAQ, coordonnées, navigation, zones de livraison |
| `src/content/media/` | Articles de la section Média (Markdown) |
| `src/content.config.ts` | Schémas des collections. Pour brancher un CMS ou l'ERP, remplacer le loader d'une collection |
| `src/pages/` | Pages du site ; `boutique/[slug]` génère une page par produit |
| `src/pages/api/` | `orders` (commandes), `leads` (B2B, fournisseurs, contact, newsletter), `cart` (panier sauvegardé), `auth/*` (authentification) et `erp/order-status` (webhook ERP), exécutés côté serveur |
| `src/pages/compte/` | Espace client : connexion, inscription, mot de passe, double authentification, commandes |
| `src/pages/suivi.astro` | Suivi de commande sans compte (numéro + téléphone) |
| `src/pages/admin/` | Back-office (équipe AfriSime, double authentification obligatoire) : tableau de bord, commandes, leads |
| `src/db/` | Schéma PostgreSQL (Drizzle) ; migrations SQL dans `drizzle/` |
| `src/lib/` | Logique partagée : authentification et rôles, prix et totaux, recherche, validation, intégrations ERP/CRM |
| `src/middleware.ts` | Lecture de la session et protection de `/compte` et `/admin` |
| `scripts/` | `create-admin.ts` : création d'un compte de l'équipe |
| `src/scripts/` | Scripts navigateur : panier, formulaires, analytics |
| `src/styles/global.css` | Design system (couleurs, boutons, cartes, formulaires, badges) |

## Règles importantes

- **Les prix sont toujours recalculés côté serveur** (`src/pages/api/orders.ts`) : ceux envoyés par le navigateur sont ignorés.
- **Double commande impossible** : chaque tentative porte une clé d'idempotence, unique en base.
- **Commandes et leads sont enregistrés en base avant l'envoi à l'ERP/CRM** : une panne de l'ERP/CRM ne perd rien. Les enregistrements non transmis ont `erp_synced_at` / `crm_synced_at` vide.
- **Rôles de l'équipe** (`src/lib/roles.ts`) : impossibles à obtenir depuis le site ; seul `npm run admin:create` (ou un super administrateur) les attribue. Double authentification obligatoire pour accéder à `/admin`.
- **Aucun secret dans le front-end** : les jetons ERP/CRM sont lus depuis les variables d'environnement serveur.

## Base de données

PostgreSQL : local en développement, [Neon](https://neon.tech) en production. Seule `DATABASE_URL` change.

| Commande | Rôle |
| --- | --- |
| `npm run db:generate` | Crée une migration SQL après modification de `src/db/schema.ts` |
| `npm run db:migrate` | Applique les migrations sur la base de `DATABASE_URL` |
| `npm run db:studio` | Explore les données dans le navigateur |

Production (Neon) : les valeurs sont dans `.env.production.bak` (local, jamais commité) et dans les variables d'environnement Vercel.
- `DATABASE_URL` : URL **pooled** (`…-pooler…`), utilisée par le site.
- `DATABASE_URL_UNPOOLED` : URL directe, utilisée seulement pour les migrations.
- `npm run db:migrate:prod` applique les migrations en production (avant chaque déploiement qui modifie le schéma).
- `npm run admin:create:prod -- <email> "<Nom>"` crée un compte de l'équipe en production.
- Une branche Neon séparée sert de base de staging.

## Variables d'environnement

Voir `.env.example`. À définir aussi dans Vercel (Production et Preview) :

```
DATABASE_URL=         BETTER_AUTH_SECRET=     BETTER_AUTH_URL=
CRM_API_URL=          CRM_API_TOKEN=          (facultatif)
ERP_API_URL=          ERP_API_TOKEN=          (facultatif)
```

Sans les variables CRM/ERP, commandes et leads sont enregistrés en base et l'envoi est seulement journalisé (`src/lib/integrations.ts`).

### Webhook ERP → site (statuts de commande)

L'ERP met à jour le statut d'une commande avec le secret `ERP_WEBHOOK_SECRET` (32 caractères minimum) :

```http
POST /api/erp/order-status
Authorization: Bearer <ERP_WEBHOOK_SECRET>
Content-Type: application/json

{ "number": "AFS-20260924-ABC123", "status": "expediee", "note": "facultatif" }
```

Statuts : `en-attente-paiement`, `confirmee`, `en-preparation`, `expediee`, `livree`, `annulee`. Sans secret configuré, le webhook répond 503.

## Avant la mise en ligne

- Remplacer `site` dans `astro.config.mjs` par le domaine définitif.
- Remplacer les contenus d'exemple : coordonnées (`src/data/site.ts`), produits, logo (`src/components/ui/Logo.astro`), textes légaux (`src/pages/legal/`).
- Brancher le prestataire de paiement (Mobile Money / carte) dans `src/pages/api/orders.ts`.
- Brancher un prestataire d'e-mails pour les liens de réinitialisation de mot de passe (`sendPasswordResetLink` dans `src/lib/integrations.ts`) : en production, aucun lien n'est envoyé tant que ce n'est pas fait.
