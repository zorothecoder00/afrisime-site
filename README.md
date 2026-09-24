# AfriSime — site web officiel

Vitrine institutionnelle, boutique en ligne et espace B2B d'AfriSime (Astro 7 + Tailwind 4, déployé sur Vercel).

## Démarrer

```sh
npm install
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
| `src/pages/api/` | `orders` (commandes) et `leads` (B2B, fournisseurs, contact, newsletter), exécutés côté serveur |
| `src/lib/` | Logique partagée : prix et totaux, recherche, validation, intégrations ERP/CRM |
| `src/scripts/` | Scripts navigateur : panier, formulaires, analytics |
| `src/styles/global.css` | Design system (couleurs, boutons, cartes, formulaires, badges) |

## Règles importantes

- **Les prix sont toujours recalculés côté serveur** (`src/pages/api/orders.ts`) : ceux envoyés par le navigateur sont ignorés.
- **Double commande impossible** : chaque tentative porte une clé d'idempotence.
- **Aucun secret dans le front-end** : les jetons ERP/CRM sont lus depuis les variables d'environnement serveur.

## Intégrations (variables d'environnement)

```
CRM_API_URL=     CRM_API_TOKEN=
ERP_API_URL=     ERP_API_TOKEN=
```

Sans ces variables, commandes et leads sont seulement journalisés dans les logs serveur (`src/lib/integrations.ts`).

## Avant la mise en ligne

- Remplacer `site` dans `astro.config.mjs` par le domaine définitif.
- Remplacer les contenus d'exemple : coordonnées (`src/data/site.ts`), produits, logo (`src/components/ui/Logo.astro`), textes légaux (`src/pages/legal/`).
- Brancher le prestataire de paiement (Mobile Money / carte) dans `src/pages/api/orders.ts`.
- Remplacer le stockage en mémoire de `src/lib/server.ts` (limitation de débit, idempotence) par Redis / Vercel KV.
