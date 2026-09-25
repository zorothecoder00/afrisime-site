# Plan de sauvegarde et de restauration

Toutes les données du site sont dans PostgreSQL (Neon) : comptes, commandes, leads, catalogue, contenus, médias (images et documents), paramètres. Le code est dans Git. Il n'y a rien d'autre à sauvegarder.

## 1. Sauvegardes automatiques (Neon)

- Neon conserve un **historique continu** (point-in-time restore) : 1 jour sur l'offre gratuite, jusqu'à 7 ou 30 jours sur les offres payantes. **Recommandé : offre Launch ou supérieure, historique de 7 jours minimum.**
- Aucune action n'est nécessaire : chaque écriture est journalisée.

## 2. Sauvegarde logique hebdomadaire (hors Neon)

Pour ne pas dépendre d'un seul fournisseur, exporter la base chaque semaine avec `pg_dump` (PostgreSQL 16 ou plus récent) et stocker le fichier chiffré hors de Neon (drive de l'entreprise, stockage objet).

```sh
# URL directe (non « pooled ») de la base de production
pg_dump "$DATABASE_URL_UNPOOLED" --format=custom --no-owner --file="afrisime-$(date +%Y%m%d).dump"
```

Conserver : 4 sauvegardes hebdomadaires + 12 mensuelles. Responsable : équipe technique ; vérification mensuelle par le super administrateur (date du dernier fichier).

## 3. Restauration

### Erreur récente (suppression, mauvaise manipulation)

1. Neon › Branches › **Restore** (ou « Create branch from a point in time ») à l'instant précédant l'erreur, **sur une nouvelle branche**.
2. Vérifier les données sur cette branche (connexion en lecture, ou déploiement Preview pointant dessus).
3. Récupérer uniquement les lignes perdues (export/import de la table concernée), ou, en cas de dégât global, faire de cette branche la branche principale (Neon › Set as primary) puis mettre à jour `DATABASE_URL` si l'hôte change.

### Perte totale ou changement d'hébergeur

```sh
createdb afrisime                     # ou nouvelle base Neon vide
pg_restore --no-owner --dbname="$NOUVELLE_URL" afrisime-AAAAMMJJ.dump
```

Puis mettre à jour `DATABASE_URL` sur Vercel et redéployer. Les migrations déjà appliquées sont incluses dans la sauvegarde (table `drizzle.__drizzle_migrations`).

## 4. Test de restauration (obligatoire)

**Chaque trimestre**, restaurer la dernière sauvegarde `pg_dump` dans une base de test (PostgreSQL local ou branche Neon temporaire), démarrer le site en local dessus et vérifier :

- connexion au back-office ;
- une commande récente et son historique ;
- une fiche produit avec ses photos ;
- un article publié.

Noter la date et le résultat du test dans le registre d'exploitation. Supprimer ensuite la base de test (elle contient des données personnelles).

## 5. Données personnelles

Les sauvegardes contiennent des données clients : les chiffrer, en limiter l'accès, et les supprimer au-delà des durées de conservation annoncées dans la politique de confidentialité.
