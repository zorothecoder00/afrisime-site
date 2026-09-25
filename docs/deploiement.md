# Déploiement et environnements

## Environnements

| Environnement | Hébergement | Base de données | Déclenchement |
| --- | --- | --- | --- |
| Développement | poste local (`npx astro dev --background`) | PostgreSQL local | — |
| Staging (préproduction) | Vercel « Preview » | branche Neon `staging` | chaque push sur une branche autre que `main` / chaque pull request |
| Production | Vercel « Production » | branche Neon principale | merge sur `main` |

Chaque environnement a **ses propres variables** (Vercel › Settings › Environment Variables, en choisissant Preview ou Production) et **son propre `BETTER_AUTH_SECRET`**. Le staging utilise les clés *sandbox* du prestataire de paiement.

Créer la branche Neon de staging : Neon › Branches › New branch (depuis `main`), puis copier son URL « pooled » dans la variable `DATABASE_URL` de l'environnement Preview de Vercel.

## Variables d'environnement

| Variable | Obligatoire | Rôle |
| --- | --- | --- |
| `DATABASE_URL` | oui | PostgreSQL (Neon : URL *pooled*) |
| `DATABASE_URL_UNPOOLED` | pour les migrations Neon | URL directe, utilisée par drizzle-kit |
| `BETTER_AUTH_SECRET` | oui | 32 caractères aléatoires minimum, différent par environnement |
| `BETTER_AUTH_URL` | oui | URL publique du site (liens des e-mails, retour de paiement) |
| `SITE_URL` | recommandé | domaine public, utilisé au build (canonical, sitemap) |
| `PAYMENT_PROVIDER` | pour le paiement en ligne | `fedapay` (ou `simulation` en développement uniquement) |
| `FEDAPAY_SECRET_KEY`, `FEDAPAY_ENV` | avec FedaPay | clé secrète ; `sandbox` ou `live` |
| `EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_FROM` | pour les e-mails | `resend` ou `brevo` ; `EMAIL_FROM` = `AfriSime <commandes@votre-domaine>` (domaine vérifié chez le prestataire) |
| `STAFF_NOTIFY_EMAIL` | non | reçoit une alerte à chaque commande et demande |
| `NOTIFY_WEBHOOK_URL`, `NOTIFY_WEBHOOK_SECRET` | pour SMS / WhatsApp | passerelle qui reçoit `{ channel, to, message }` (signature HMAC-SHA256 dans `X-AfriSime-Signature`) |
| `ERP_API_URL`, `ERP_API_TOKEN` | si ERP | envoi des commandes confirmées (`POST /orders`) |
| `CRM_API_URL`, `CRM_API_TOKEN` | si CRM | envoi des leads (`POST /leads`) |
| `ERP_WEBHOOK_SECRET` | si ERP | secret des webhooks entrants `/api/erp/*` (32 caractères min.) |
| `CRON_SECRET` | oui en production | protège `/api/cron/sync` (Vercel l'envoie automatiquement) |

Générer un secret : `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

Tant qu'une intégration n'est pas configurée, le site fonctionne : les données restent en base et l'état est visible dans le back-office (Paramètres › Intégrations).

## Brancher le paiement FedaPay

1. Créer le compte marchand FedaPay, récupérer la clé secrète *sandbox*.
2. Variables : `PAYMENT_PROVIDER=fedapay`, `FEDAPAY_SECRET_KEY=sk_sandbox_…`, `FEDAPAY_ENV=sandbox`.
3. Dans le tableau de bord FedaPay, déclarer le webhook : `https://<domaine>/api/payments/webhook/fedapay` (événements transaction).
4. Tester une commande en staging, puis passer aux clés `live` en production.

L'état d'un paiement est toujours relu chez FedaPay (retour du client, webhook, tâche planifiée) : un appel forgé ne peut pas confirmer une commande. Un autre prestataire (CinetPay, PayDunya…) s'ajoute dans `src/lib/payments/providers.ts` sans toucher au reste.

## Premier déploiement

```sh
npm ci
npm run db:migrate                      # avec DATABASE_URL de l'environnement visé
npm run content:import                  # contenu de départ (base locale ; --distant pour une autre base, en connaissance de cause)
npm run admin:create -- vous@afrisime.com "Votre Nom"
```

Puis connecter le dépôt GitHub à Vercel (framework Astro détecté automatiquement, région `fra1` réglée dans `vercel.json`).

## Mises à jour

1. Développer sur une branche ; la CI (`.github/workflows/ci.yml`) vérifie les types, les tests unitaires, le build et les parcours E2E.
2. Pull request → déploiement Preview (staging) à vérifier.
3. **Migrations** : si `src/db/schema.ts` a changé, `npm run db:generate` crée le fichier SQL dans `drizzle/` (à committer). Appliquer sur staging, vérifier, puis sur production **avant** le merge : `npm run db:migrate` avec l'URL de l'environnement.
4. Merge sur `main` → déploiement en production.

Revenir en arrière : Vercel › Deployments › « Promote to Production » sur le déploiement précédent (les migrations étant additives, l'ancien code reste compatible).

## Tâche planifiée

`vercel.json` déclare un cron quotidien (3 h UTC) sur `/api/cron/sync` : revérification des paiements en attente, renvoi à l'ERP/CRM, annulation des commandes impayées depuis 72 h, purge des compteurs. Sur l'offre Vercel Pro, la fréquence peut être augmentée (ex. `*/15 * * * *`).

## Cache

Les pages publiques sont mises en cache 60 s par le CDN (`src/middleware.ts`) : une modification du back-office est visible en moins d'une minute. Les images (`/img/…`) sont en cache long (leur contenu ne change jamais). Panier, commande, compte et back-office ne sont jamais mis en cache.
