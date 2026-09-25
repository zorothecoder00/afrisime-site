# Guide de l'administrateur AfriSime

Ce guide sert de support de formation pour l'équipe qui gère le site. Il est aussi consultable dans le back-office (lien « Aide » en haut de chaque page).

## 1. Se connecter au back-office

1. Ouvrez `/compte/connexion` et connectez-vous avec votre e-mail et votre mot de passe.
2. **Première connexion :** la double authentification est obligatoire pour l'équipe. Installez une application d'authentification (Google Authenticator, Microsoft Authenticator, 2FAS…), scannez le QR code affiché, saisissez le code à 6 chiffres. **Conservez les codes de secours** dans un endroit sûr.
3. Si un super administrateur vous a créé un compte avec un mot de passe provisoire, changez-le dans « Mon compte › Sécurité ».
4. Le back-office est à l'adresse `/admin`. Chaque rôle ne voit que les rubriques qui le concernent.

| Rôle | Rubriques |
| --- | --- |
| Super administrateur | Tout, dont Clients & équipe (rôles, blocages), Paramètres (identité, coordonnées), Journal |
| Administrateur web | Contenus (publication), FAQ, Médias, SEO & menus, Rapports |
| E-commerce manager | Commandes, Catalogue, Promotions, Médias, Paramètres (livraison, paiement), Rapports |
| Commercial B2B | Leads, validation des comptes pro, Rapports |
| Service client | Commandes, Leads (contact, réclamations), FAQ |
| Éditeur | Contenus (brouillons à faire valider) |
| Analyste | Lecture seule, Rapports |

Toutes les actions sensibles (connexion, changement de statut, publication, suppression, export…) sont enregistrées dans le **Journal**.

## 2. Traiter les commandes

**Commandes** liste toutes les commandes ; filtrez par statut, cherchez par numéro, nom ou téléphone.

- **En attente de paiement** : le client a choisi Mobile Money ou carte et n'a pas encore payé. Dès que le prestataire confirme le paiement, la commande passe seule à **Confirmée**. Sans paiement sous 72 h, elle est annulée automatiquement.
- **Confirmée** : payée en ligne ou payable à la livraison. Elle est transmise à l'ERP.
- Faites avancer la commande : **En préparation › Expédiée › Livrée**. À chaque étape, le client est prévenu (e-mail, SMS/WhatsApp selon les prestataires configurés).
- Une commande peut être **annulée** tant qu'elle n'est pas expédiée. Le client peut lui-même annuler tant que la préparation n'a pas commencé et qu'il n'a pas payé ; une commande déjà payée et annulée doit être remboursée (le journal le signale).
- La fiche commande montre l'historique, les paiements et les notifications envoyées. « Vérifier auprès du prestataire » relit l'état d'un paiement resté en attente.
- « Renvoyer à l'ERP » : si l'ERP était indisponible (badge « ERP en attente »). La tâche planifiée de la nuit le fait aussi automatiquement.
- **Exporter** : Rapports › « Exporter les commandes (CSV) » (ouvrable dans Excel).

## 3. Suivre les demandes (leads)

Les formulaires du site (devis B2B, fournisseurs, partenaires, contact, réclamations, investisseurs, candidatures, newsletter) créent des **leads**.

- Les devis B2B et propositions fournisseurs sont **attribués automatiquement** au commercial le moins chargé ; contacts et réclamations au service client.
- Faites avancer chaque demande : **Nouveau › Qualifié › Devis envoyé › Négociation › Commande › Clôturé**, avec une note à chaque étape. Le délai de première réponse est mesuré dans Rapports.
- Les **documents joints** (liste de produits, RCCM, photos d'une réclamation) sont téléchargeables depuis la fiche ; ils ne sont jamais publics.

## 4. Valider un compte professionnel

Un client qui s'inscrit comme « professionnel » est **à valider**. Dans **Clients & équipe › Pros à valider**, vérifiez l'entreprise (appel, RCCM) puis cliquez **Valider le compte pro**. Le client voit alors les **prix pro** définis sur les produits, dans la boutique et au panier.

## 5. Gérer le catalogue

**Catalogue › Produits › Nouveau produit** (ou cliquez un produit) :

1. **Identité** : nom, référence (SKU unique), catégorie, marque, résumé, description.
2. **Formats et prix** : une ligne par format (Sac 5 kg, Carton de 12…) avec son prix. *Prix barré* = ancien prix affiché barré (promotion). *Prix pro* = prix réservé aux comptes pro validés. L'identifiant du format sert à l'ERP (SKU du format = SKU produit + « - » + identifiant).
3. **Photos** : JPG/PNG/WebP jusqu'à 8 Mo ; elles sont automatiquement redimensionnées et converties en WebP. La première est la photo principale. Renseignez le texte alternatif (accessibilité et référencement).
4. **Publication** : « Visible sur le site », statut (Disponible, Sur commande, Temporairement indisponible, Sur devis), stock, badges.
5. **SEO** : titre et description pour Google (facultatif).

Les modifications sont visibles sur le site **en moins d'une minute**. Changer l'adresse d'un produit crée automatiquement une redirection depuis l'ancienne. Pour retirer un produit temporairement, décochez « Visible sur le site » plutôt que de le supprimer.

**Catégories** et **Marques** : nom, ordre d'affichage, couleur et icône (catégories), logo (marques). Une catégorie ou une marque utilisée par des produits ne peut pas être supprimée.

Si l'ERP est branché, il met à jour prix, statuts et stocks tout seul (webhook catalogue).

## 6. Promotions

- **Codes promo** : pourcentage ou montant, remise maximum, achat minimum, dates, nombre d'utilisations. Le code est vérifié par le serveur au panier et à la commande.
- **Campagnes** : bloc « Offres du moment » de l'accueil, ou bandeau en haut de toutes les pages, avec dates de début et de fin.
- **Prix barrés** : sur chaque produit (voir 5). Ajoutez le badge « Promotion » pour qu'il apparaisse dans le filtre « En promotion ».

## 7. Publier des contenus

**Contenus** gère les articles de la section Média (actualités, conseils, vidéos, événements, communiqués) et les **pages** (CGV, mentions légales, confidentialité, livraison & retours, cookies).

1. **Nouveau contenu** : type, titre, chapeau, texte. Le texte utilise une mise en forme simple (Markdown) : `## Intertitre`, `**gras**`, `- liste`, `[lien](https://…)`. Pour une image, copiez son « Code Markdown » depuis Médias.
2. **Vidéo** : collez le lien YouTube ou Vimeo. **Événement** : date et lieu.
3. **Prévisualiser** montre la page telle qu'elle sera publiée.
4. **Éditeur** : « Soumettre à validation ». **Administrateur web** : « Publier » ; avec une date future, la publication est **programmée**. « Retirer du site » repasse en brouillon.

## 8. Médias, FAQ, menus et SEO

- **Médias** : bibliothèque d'images, texte alternatif, code à copier. Une image utilisée ne peut pas être supprimée.
- **FAQ** : questions par rubrique, ordre, publication.
- **SEO & menus** : menu principal (liens et sous-menus), **redirections 301** (ancienne adresse › nouvelle), identifiant **Google Tag Manager** (mesure d'audience, chargée seulement après accord du visiteur) et code de vérification **Search Console**. Déclarez `/sitemap.xml` dans Search Console.

## 9. Paramètres

- **Identité et coordonnées** (super administrateur) : téléphone, WhatsApp, e-mail, adresse, horaires, réseaux sociaux, message du bandeau.
- **Livraison** : zones, frais, délais, seuil de livraison offerte.
- **Moyens de paiement** : activer ou désactiver le paiement à la livraison, Mobile Money, carte.
- **Intégrations** : état des branchements (paiement, e-mails, SMS, ERP, CRM). Ils se règlent sur l'hébergeur par l'équipe technique (docs/deploiement.md).

## 10. Rapports

Ventes, panier moyen, meilleures ventes, **paniers abandonnés** (clients à relancer), leads par type et par étape, **temps de première réponse**, recherches les plus fréquentes et **recherches sans résultat** (produits demandés absents du catalogue). Trafic et sources : dans l'outil d'analytics (Google Analytics via Tag Manager).

## 11. Bonnes pratiques de sécurité

- Ne partagez jamais votre mot de passe ni vos codes de secours ; un compte par personne.
- Déconnectez-vous sur un ordinateur partagé.
- Un départ dans l'équipe : le super administrateur **bloque** le compte ou lui retire son rôle (Clients & équipe), ce qui ferme ses sessions.
- Consultez le Journal en cas de doute sur une modification.
