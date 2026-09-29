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
| Administrateur web | Contenus (publication), Textes du site, FAQ, Programmes & projets, Catalogue (catégories et marques), Médias, SEO & menus, Rapports |
| E-commerce manager | Commandes, Catalogue (dont types de prix), Promotions, Médias, Paramètres (livraison, paiement), Rapports |
| Commercial B2B | Leads, validation des comptes pro, Rapports |
| Service client | Commandes, Leads (contact, réclamations), FAQ |
| Éditeur | Contenus (brouillons à faire valider) |
| Analyste | Lecture seule, Rapports |

Toutes les actions sensibles (connexion, changement de statut, publication, suppression, export…) sont enregistrées dans le **Journal**.

## 2. Traiter les commandes

**Commandes** liste toutes les commandes ; filtrez par statut, cherchez par numéro, nom ou téléphone.

- **En attente de paiement** : le client a choisi Mobile Money ou carte et n'a pas encore payé. Dès que le prestataire confirme le paiement, la commande passe seule à **Confirmée**. Sans paiement sous 72 h, elle est annulée automatiquement.
- **À valider** : le client a choisi un type de prix « à valider » (ex. prix à crédit, voir 5). Il n'a rien payé. Appelez-le pour convenir des conditions (dossier, échéancier…), puis passez la commande en **Confirmée** (ou **Annulée**). Elle n'est ni transmise à l'ERP ni annulée automatiquement tant qu'elle est à valider.
- **Confirmée** : payée en ligne, payable à la livraison ou validée par l'équipe. Elle est transmise à l'ERP.
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
2. **Formats et prix** : une ligne par format (Sac 5 kg, Carton de 12…) avec son prix. *Prix barré* = ancien prix affiché barré (promotion). *Prix pro* = prix réservé aux comptes pro validés. Une colonne supplémentaire par **type de prix** (ex. *Prix à crédit*) : laissez-la vide si le format n'est pas proposé à ce prix. L'identifiant du format sert à l'ERP (SKU du format = SKU produit + « - » + identifiant).
3. **Photos** : JPG/PNG/WebP jusqu'à 8 Mo ; elles sont automatiquement redimensionnées et converties en WebP. La première est la photo principale. Renseignez le texte alternatif (accessibilité et référencement).
4. **Publication** : « Visible sur le site », statut (Disponible, Sur commande, Temporairement indisponible, Sur devis), stock, badges.
5. **SEO** : titre et description pour Google (facultatif).

Les modifications sont visibles sur le site **en moins d'une minute**. Changer l'adresse d'un produit crée automatiquement une redirection depuis l'ancienne. Pour retirer un produit temporairement, décochez « Visible sur le site » plutôt que de le supprimer.

**Catégories** et **Marques** (super administrateur, e-commerce manager, administrateur web) : ajout, modification, suppression ; nom, ordre d'affichage, couleur, icône et image (catégories), logo (marques). L'image ou le logo peut être remplacé ou retiré (« Retirer »). Une catégorie peut être rangée dans un **rayon principal** (catégorie parente) : c'est une **sous-catégorie** (ex. Épicerie › Riz), sur un seul niveau. Dans la boutique, les pastilles de rayon montrent les rayons principaux, chaque rayon affiche aussi les produits de ses sous-catégories, et le filtre Catégories les présente en arborescence. Une catégorie ou une marque utilisée par des produits ne peut pas être supprimée, ni un rayon qui a des sous-catégories.

**Types de prix** (super administrateur, e-commerce manager) : prix proposés en plus du prix normal, par exemple **Prix à crédit** ou **Prix de gros**. Pour chaque type :

- **Visible par** : tout le monde, les clients connectés ou les comptes pro validés ;
- **Conditions affichées au client** : texte court sur la fiche produit et à la commande (ex. « 3 mensualités après étude du dossier ») ;
- **Commande à valider par l'équipe** : le client ne paie pas en ligne ; la commande arrive **À valider** (voir 2). À cocher pour le crédit ;
- **Actif**, **ordre**.

Les montants se saisissent ensuite dans chaque produit (colonne du type dans *Formats et prix*). Sur la fiche produit, le client voit les prix des types qui lui sont ouverts. À la commande, il choisit le type de prix si **tous** les articles de son panier ont ce prix ; le total est recalculé par le serveur. Le type choisi figure sur la commande, dans les e-mails et dans l'export CSV. Supprimer un type retire ses prix du site (les commandes passées gardent son nom).

Si l'ERP est branché, il met à jour prix, statuts et stocks tout seul (webhook catalogue).

## 6. Promotions

- **Codes promo** : pourcentage ou montant, remise maximum, achat minimum, dates, nombre d'utilisations. Le code est vérifié par le serveur au panier et à la commande.
- **Campagnes** : bloc « Offres du moment » de l'accueil, ou bandeau en haut de toutes les pages, avec dates de début et de fin.
- **Prix barrés** : sur chaque produit (voir 5). Ajoutez le badge « Promotion » pour qu'il apparaisse dans le filtre « En promotion ».

## 7. Publier des contenus

**Contenus** gère les articles de la section Média (actualités, conseils, vidéos, événements, communiqués) (onglet **Articles & médias**) et les **pages légales** (onglet **Pages légales** : CGV, mentions légales, confidentialité, livraison & retours, cookies). Les textes des pages principales (accueil, Qui sommes-nous, B2B…) se modifient dans **Textes du site**, pas ici.

1. **Nouveau contenu** : type, titre, chapeau, texte. Le texte utilise une mise en forme simple (Markdown) : `## Intertitre`, `**gras**`, `- liste`, `[lien](https://…)`. Pour une image, copiez son « Code Markdown » depuis Médias.
2. **Vidéo** : collez le lien YouTube ou Vimeo. **Événement** : date et lieu.
3. **Prévisualiser** montre la page telle qu'elle sera publiée.
4. **Éditeur** : « Soumettre à validation ». **Administrateur web** : « Publier » ; avec une date future, la publication est **programmée**. « Retirer du site » repasse en brouillon.

## 8. Médias, FAQ, menus et SEO

- **Médias** : bibliothèque d'images, texte alternatif, code à copier. Une image utilisée ne peut pas être supprimée.
- **FAQ** : questions par rubrique (générales, commande & paiement, livraison, professionnels, programmes & projets), ordre, publication. Une rubrique sans question publiée n'apparaît pas sur le site.
- **SEO & menus** : menu principal (liens et sous-menus), **redirections 301** (ancienne adresse › nouvelle), identifiant **Google Tag Manager** (mesure d'audience, chargée seulement après accord du visiteur) et code de vérification **Search Console**. Déclarez `/sitemap.xml` dans Search Console.

- **Médias** : réserve d'images. Une image n'apparaît sur le site qu'une fois utilisée (diaporama, produit, article, marque, catégorie, campagne) ; une image utilisée ne peut pas être supprimée.
- **Diaporamas** : plusieurs images affichées sur une page au choix (accueil, Qui sommes-nous, Activités, B2B, Programmes & Projets, Partenaires, Carrières, Investir), en **carrousel** (images côte à côte avec flèches) ou en **défilement automatique** (une grande image remplacée par la suivante). Réglez le délai entre deux images (2 à 20 s), l'ordre, une légende et un lien par image. Images prises dans la médiathèque ou envoyées directement (4 Mo par envoi, 20 images par diaporama). Le défilement se met en pause au survol.

- **Offres d'emploi** : postes affichés sur la page Carrières (intitulé, lieu, contrat, description, ordre, publication). Chaque offre publiée est proposée dans le formulaire de candidature ; sans offre, la page propose la candidature spontanée.

- **Programmes & projets** (super administrateur, administrateur web, éditeur, service client) : fiches affichées sur la page publique **Programmes & Projets** (`/programmes`, onglet du menu entre Solutions B2B et Partenaires). Pour chaque fiche : **type** (programme ou projet, qui détermine la section où elle apparaît), titre, **statut** (à venir, en cours, terminé), lieu ou zone, période (texte libre, ex. « 2025 – 2027 »), résumé, description (une ligne vide entre deux paragraphes), image, ordre d'affichage et publication. Une fiche décochée « Publié » reste dans le back-office mais disparaît du site. Les textes de la page (en-tête, titres des sections, libellés des statuts) se modifient dans **Textes du site › Programmes & Projets**, et deux diaporamas peuvent y être placés (**Diaporamas** : en-tête, et sous les programmes et projets). Les développeurs disposent des mêmes opérations en JSON sur `/api/admin/programmes` (liste, création) et `/api/admin/programmes/:id` (détail, modification, suppression), avec les mêmes droits que le back-office.

- **Textes du site** (super administrateur, administrateur web) : titres et textes de l'**accueil** (bandeau principal, arguments, rubriques, appel final), du **pied de page** (présentation sous le logo, newsletter), de **Qui sommes-nous** (chiffres clés, histoire, vision, mission, valeurs, gouvernance, engagements), de **Contact** (en-tête, libellés, sujets du formulaire, carte), des **Activités**, des **Solutions B2B** (publics, étapes, choix du formulaire de devis), de **Programmes & Projets** (en-tête, titres des sections, libellés des statuts, message sans publication), de **Carrières**, d'**Investir** et de **Partenaires** (types de partenariat, critères, choix du formulaire), de la **FAQ** et de **Média** (titres, encadrés), de la **page introuvable** (404), ainsi que l'**en-tête et le pied de page** (bouton Espace pro, colonnes de liens au format « Libellé | /adresse », liens légaux). Chaque page publique a aussi sa **description pour Google** (onglet de la page, section Référencement). Un champ vide reprend le texte d'origine ; « Rétablir les textes d'origine » annule toutes les modifications d'une page. Visible sur le site d'ici une minute.

## 9. Paramètres

- **Identité et coordonnées** (super administrateur) : téléphone, WhatsApp, e-mail, adresse, horaires, réseaux sociaux, message du bandeau.
- **Livraison** : zones, frais, délais, seuil de livraison offerte.
- **Moyens de paiement** : activer ou désactiver le paiement à la livraison, Mobile Money, carte. Tant que la clé FedaPay n'est pas configurée, Mobile Money et carte sont masqués à la commande même s'ils sont actifs : seul le paiement à la livraison est proposé.
- **Intégrations** : état des branchements (paiement, e-mails, SMS, ERP, CRM). Ils se règlent sur l'hébergeur par l'équipe technique (docs/deploiement.md).

## 10. Rapports

Ventes, panier moyen, meilleures ventes, **paniers abandonnés** (clients à relancer), leads par type et par étape, **temps de première réponse**, recherches les plus fréquentes et **recherches sans résultat** (produits demandés absents du catalogue). Trafic et sources : dans l'outil d'analytics (Google Analytics via Tag Manager).

## 11. Bonnes pratiques de sécurité

- Ne partagez jamais votre mot de passe ni vos codes de secours ; un compte par personne.
- Déconnectez-vous sur un ordinateur partagé.
- Un départ dans l'équipe : le super administrateur **bloque** le compte ou lui retire son rôle (Clients & équipe), ce qui ferme ses sessions.
- Consultez le Journal en cas de doute sur une modification.

### Alertes de sécurité

L'équipe reçoit un e-mail « [Sécurité] … » (adresse `STAFF_NOTIFY_EMAIL`, à défaut tous les super administrateurs) quand :

- un rôle est modifié, un compte de l'équipe est créé ou un compte est bloqué ;
- 5 mots de passe erronés sont saisis en 15 minutes sur un compte de l'équipe ;
- 3 codes de double authentification sont refusés en 15 minutes sur un compte de l'équipe (le mot de passe a donc été trouvé : changez-le).

Si l'action n'est pas attendue : bloquez le compte dans Clients & équipe, puis vérifiez le Journal (actions `connexion-echouee`, `double-auth-echouee`).

### Téléphone perdu et codes de secours perdus

Aucun écran du site ne permet de retirer la double authentification. Une personne ayant accès à la base lance :

```
npm run admin:reset-2fa -- email@exemple.com
```

(`admin:reset-2fa:prod` pour la production.) La commande demande confirmation, supprime la clé, oublie les appareils de confiance, ferme les sessions et inscrit l'action au Journal. À la connexion suivante, la personne réactive la double authentification avec une nouvelle clé. Vérifiez son identité avant de lancer la commande.
