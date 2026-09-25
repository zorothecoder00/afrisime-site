# AfriSime — site web officiel

Vitrine institutionnelle, boutique en ligne, espace B2B et back-office (CMS) d'AfriSime (Astro 7 + Tailwind 4 + PostgreSQL, déployé sur Vercel).

## Démarrer

```sh
npm install
cp .env.example .env         # puis renseigner DATABASE_URL et BETTER_AUTH_SECRET
npm run db:migrate           # crée les tables
npm run content:import       # catalogue, articles, pages légales, FAQ de départ (base locale)
npm run admin:create -- vous@afrisime.com "Votre Nom"   # premier super administrateur
npx astro dev --background   # http://localhost:4321 — back-office : /admin
```

Avec `PAYMENT_PROVIDER=simulation` (développement), le paiement en ligne passe par une page de simulation (succès / échec).

## Documentation

| Document | Contenu |
| --- | --- |
| [docs/guide-administrateur.md](docs/guide-administrateur.md) | Guide et support de formation de l'équipe (aussi dans le back-office : « Aide ») |
| [docs/deploiement.md](docs/deploiement.md) | Environnements dev / staging / production, variables, paiement FedaPay, cron, mises à jour |
| [docs/sauvegarde-restauration.md](docs/sauvegarde-restauration.md) | Plan de sauvegarde, restauration et test trimestriel |
| [docs/openapi.yaml](docs/openapi.yaml) | API du site, webhooks ERP/paiement, contrats sortants ERP/CRM (OpenAPI 3.1) |
| `/design-system` | UI kit : couleurs, typographies, composants, états (page non indexée) |

## Organisation

| Dossier | Contenu |
| --- | --- |
| `src/pages/` | Pages publiques (rendues par le serveur, mises en cache 60 s par le CDN) |
| `src/pages/admin/` | Back-office : tableau de bord, commandes, leads, clients & équipe, catalogue, promotions, contenus, FAQ, médias, SEO & menus, paramètres, rapports, journal |
| `src/pages/compte/` | Espace client : connexion, inscription, double authentification, commandes (recommander), favoris, adresses, profil |
| `src/pages/commande/` | Commande, paiement (prestataire ou simulation), page de confirmation / suivi par lien secret |
| `src/pages/api/` | `orders`, `checkout/quote`, `leads` (avec documents), `cart`, `favorites`, `pro-prices`, `erp/*` (webhooks ERP), `payments/webhook/*`, `cron/sync` |
| `src/db/` | Schéma PostgreSQL (Drizzle) ; migrations SQL dans `drizzle/` |
| `src/lib/` | Logique serveur : catalogue, devis et prix, promotions, contenus, médias, paiements, notifications, intégrations, rôles, rapports |
| `src/data/site.ts` | Valeurs par défaut des paramètres (modifiables dans le back-office) |
| `scripts/` | `create-admin.ts`, `import-content.ts` ; contenu de départ dans `scripts/seed/` |
| `tests/` | Tests unitaires (Vitest) et de bout en bout (Playwright) |

## Règles importantes

- **Les prix sont toujours recalculés côté serveur** (`src/lib/checkout.ts`) : prix du catalogue (ou prix pro d'un compte validé), code promo, frais de livraison. Ceux du navigateur sont ignorés.
- **Double commande impossible** : clé d'idempotence unique par tentative ; un paiement réussi ne confirme la commande qu'une fois ; l'état d'un paiement est toujours relu chez le prestataire.
- **Commandes et leads sont enregistrés en base avant l'envoi à l'ERP/CRM** : une panne ne perd rien, la tâche planifiée renvoie ce qui n'est pas parti.
- **Rôles de l'équipe** (`src/lib/roles.ts`) : attribués seulement par `npm run admin:create` ou un super administrateur. Double authentification obligatoire pour `/admin`. Actions sensibles tracées dans le journal.
- **Contenus sûrs** : le Markdown du CMS n'accepte pas de HTML ; les images envoyées sont réencodées en WebP.
- **Aucun secret dans le front-end** : toutes les clés sont des variables d'environnement serveur (`astro.config.mjs` › `env.schema`).

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm run check` | Vérification des types (Astro + TypeScript) |
| `npm test` | Tests unitaires |
| `npm run test:e2e` | Parcours critiques dans un navigateur (serveur **local** uniquement ; `npx playwright install chromium` la première fois) |
| `npm run db:generate` | Crée une migration SQL après modification de `src/db/schema.ts` |
| `npm run db:migrate` | Applique les migrations sur la base de `DATABASE_URL` |
| `npm run db:studio` | Explore les données dans le navigateur |
| `npm run content:import` | Contenu de départ (refuse une base distante sans `--distant`) |

Production (Neon) : les valeurs sont dans `.env.production.bak` (local, jamais commité) et dans les variables d'environnement Vercel. `npm run db:migrate:prod` applique les migrations en production, `npm run admin:create:prod -- <email> "<Nom>"` crée un compte d'équipe en production.

## Avant la mise en ligne

- Définir `SITE_URL` (domaine définitif) et toutes les variables de `docs/deploiement.md` dans Vercel.
- Remplacer les contenus d'exemple depuis le back-office : coordonnées (Paramètres), produits et photos (Catalogue), textes légaux (Contenus › Pages, à faire valider par un juriste).
- Brancher le paiement (FedaPay) et un prestataire d'e-mails (Resend ou Brevo) : sans e-mails, les liens de réinitialisation de mot de passe et les confirmations ne partent pas (état visible dans Paramètres › Intégrations).
