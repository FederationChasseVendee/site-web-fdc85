# Refonte FDC 85 — Personas et navigation

**Version 2 révisée · 1 novembre 2026 · Mes démarches regroupées · Proposition à valider avec la cliente**

Cette première étape décide de ce que les visiteurs doivent pouvoir trouver et de la façon de les y conduire. Elle ne décide pas encore du graphisme ni du framework de la copie propre.

**Recommandation : conserver les six entrées principales et regrouper toutes les actions dans « Mes démarches ».** Les autres rubriques servent à comprendre, découvrir et consulter ; elles renvoient aux démarches quand le visiteur est prêt à agir. L'accueil garde les accès rapides avant les actualités. Les personas servent à concevoir et tester les parcours ; le visiteur n'a pas à sélectionner un profil pour entrer.

Pour comparer les directions visuelles, un [atelier interactif](propositions-visuelles.html) accompagne ce cadrage. Il présente douze nouvelles compositions, dont deux bandeaux d'accès rapides en grands ronds, et conserve la première série de dix pistes avec ses éventuels avis. Les retours des deux séries sont enregistrés séparément dans le navigateur et réunis dans l'export Markdown ; ils ne sont pas envoyés à un serveur. Il s'agit de maquettes de discussion, pas d'une identité validée.

Ouvrir l'atelier depuis la copie complète du dépôt : il charge ses fichiers CSS et JavaScript voisins et, pour trois nouvelles pistes, des photographies locales déjà présentes dans `public/assets/`. Le choix des images et leurs droits restent à vérifier avant toute publication.

**Ce qui change depuis la version 1 :** Passer mon permis et Se former rejoignent Mes démarches comme entrées d'action. Les dégâts distinguent grand gibier et DECLADOM ; les pertes distinguent permis et arme. « Se connecter à mon espace » distingue l'espace adhérent de l'espace maître d'équipage. « Devenir chasseur » propose aussi des liens directs pour passer et valider le permis.

## 1. Ce qui est confirmé et ce qui reste proposé

| Statut | Point |
| --- | --- |
| Confirmé | Repartir d'un code propre, récupérer le contenu utile et retirer les fonctionnalités d'édition du site. |
| Confirmé | Conserver un site statique qui guide vers les services externes existants, notamment les inscriptions, validations et espaces adhérents. |
| Confirmé | Commencer par les personas et la navigation ; la moyenne d'âge du public est élevée. |
| Confirmé | La cliente apprécie les accès rapides suivis des actualités sur l'accueil FDC 41. |
| Confirmé pendant le cadrage | Garder le site actuel intact pendant cette étape. |
| Confirmé par la révision utilisateur | Regrouper toutes les démarches, y compris passer le permis et se former, et les séparer des rubriques de prise d'information. Conserver les huit entrées demandées, avec les sous-entrées dégâts et pertes. |
| Confirmé par l'utilisateur | Intituler l'entrée « Se connecter à mon espace » et distinguer « Espace adhérent » et « Espace maître d'équipage ». Proposer aussi « Passer mon permis » et « Valider mon permis en Vendée » dans Devenir chasseur ; les liens peuvent apparaître à plusieurs endroits. |
| Confirmé par l'utilisateur | Placer les coordonnées dans le pied de page et sur une page « Nous contacter », sans afficher le numéro de téléphone dans l'en-tête ou le contenu principal de l'accueil. |
| Accueil favorable de l'utilisateur | Les autres sections conviennent dans leur principe ; leurs frontières sont précisées dans cette version. |
| Proposé | Les autres ajustements de libellés, l'ordre des six rubriques, l'organisation interne des démarches et les raccourcis d'accueil présentés ci-dessous. |
| À préciser | Le personnel administratif visé est-il un agent de collectivité, un partenaire, un salarié de la Fédération ou plusieurs de ces publics ? |
| À vérifier | Catalogue actuel des formations, liens officiels, contacts, tarifs, dates, documents en vigueur et contenus cités seulement dans le PDF. |

Les personas ci-dessous sont des **hypothèses de conception**, pas les résultats d'entretiens. Les besoins sont tirés du brief et de l'inventaire du dépôt. Aucune statistique d'usage n'est disponible ici.

## 2. Trois personas prioritaires

### Le chasseur déjà titulaire — « Je viens pour quelque chose de précis »

**Situation.** Il revient au moment de valider son permis, de consulter les dates de chasse ou de s'inscrire à une formation. Il peut connaître la chasse sans connaître le nom du téléservice utilisé.

**Actions principales.** Valider son permis ; consulter les ouvertures et fermetures ; trouver une formation, notamment sécurité décennale ; accéder au bon espace adhérent ; retrouver un formulaire.

**Freins.** « Passer » et « valider » regroupés sous un même bouton ; un document caché dans une rubrique générique ; des noms comme RETRIEVER ou ChassAdapt sans explication ; des informations de saison ancienne qui ressemblent à celles en vigueur.

**Parcours attendu.** Accueil ou Mes démarches → « Valider mon permis » → explication et pièces utiles → service officiel externe. Pour une inscription connue : Mes démarches → « Se former » → formation concernée → inscription. Pour choisir : Formations → fiche explicative → accès à la même démarche d'inscription.

**Réussite.** Il identifie l'action correcte, comprend quand il quitte le site et trouve un contact s'il ne parvient pas à poursuivre.

### La personne qui veut devenir chasseur — « Je ne sais pas par où commencer »

**Situation.** Elle découvre le parcours, avec ou sans entourage chasseur. Elle veut comprendre les conditions, le déroulement de l'examen et la réalité de la chasse en Vendée avant de s'engager.

**Actions principales.** Comprendre les étapes ; se renseigner sur la chasse accompagnée ; s'inscrire au permis ; préparer la formation et l'examen ; après réussite, comprendre la validation et trouver où pratiquer.

**Freins.** Une liste de formations techniques sans point de départ ; des sigles ; une inscription proposée avant les conditions et le déroulement ; la confusion entre obtenir un permis et le valider.

**Parcours attendu.** « Devenir chasseur » → comprendre le parcours → lien direct « Passer mon permis » → préparer l'examen → après réussite, lien direct « Valider mon permis en Vendée », puis « Où chasser ? ». Les deux liens sont aussi disponibles dans Mes démarches et mènent aux mêmes pages. Une personne déjà décidée accède directement à Passer mon permis sans lire tout le parcours de découverte.

**Réussite.** Elle peut expliquer sa prochaine étape, les documents à préparer et l'interlocuteur à contacter. La chasse accompagnée est présentée comme un parcours distinct, pas comme une étape obligatoire pour tous.

### L'agent administratif ou le partenaire institutionnel — « Je cherche une information fiable sur la Fédération »

**Situation proposée.** Une personne d'une mairie, d'une collectivité ou d'un organisme partenaire prépare un dossier, cherche un interlocuteur ou veut comprendre les missions de la FDC 85. Ce n'est pas un persona d'éditeur du site.

**Actions principales.** Comprendre les rôles de la Fédération ; identifier l'équipe ou les élus ; retrouver les statuts, rapports et publications ; consulter les projets et partenariats ; contacter le bon service.

**Freins.** Informations institutionnelles mélangées aux démarches des chasseurs ; documents éparpillés ; sigles sans contexte ; un annuaire de personnes sans indication de rôle ou de service.

**Parcours attendu.** « La Fédération » → missions / équipe et services / publications officielles → document daté ou contact. Pour un projet de haies : « Nature et biodiversité » → plantations → interlocuteur.

**Réussite.** La personne trouve une source identifiable, un document daté et un service compétent sans parcourir les actualités.

## 3. Publics complémentaires proposés

| Persona | Besoin et actions | Entrée naturelle | Priorité proposée |
| --- | --- | --- | --- |
| Responsable d'association ou de territoire de chasse | Accéder à son espace, demander un plan de chasse, déclarer des prélèvements, préparer les documents de gestion et trouver les formations adaptées. | Mes démarches → « Se connecter à mon espace » → « Espace adhérent » ; ou Déclarer mes prélèvements. | Élevée : ses tâches diffèrent de celles du chasseur individuel, même si les deux utilisent le même accès adhérent. |
| Agriculteur ou propriétaire | Comprendre la procédure relative aux dégâts, distinguer les dispositifs, trouver le bon contact ; se renseigner sur une plantation de haies. | Mes démarches → « Déclarer un dégât » → grand gibier ou DECLADOM ; Nature et biodiversité → plantations. | Élevée pour la lisibilité : ne pas supposer qu'il est chasseur. |
| Enseignant, famille ou visiteur nature | Trouver une animation, découvrir un espace naturel et comprendre les actions de la Fédération. | Nature et biodiversité → animations ou espaces naturels. | Secondaire sur l'accueil, mais parcours complet. |

Le promeneur peut trouver les informations de cohabitation et les dates depuis « Chasser en Vendée ». Il n'est pas nécessaire d'ajouter un quatrième grand parcours à l'accueil pour chaque public.

## 4. Ce que le PDF apporte — et ce qu'on simplifie

Le PDF est une image d'arborescence à huit entrées : **La Fédération**, **Toutes nos formations**, **Vos démarches**, **Toute la documentation**, **La chasse en Vendée**, **Communication & actualités**, **Vos territoires et leur gestion**, **Biodiversité et environnement**. Il prévoit un menu burger comme entrée générale.

**À garder :** les démarches formulées comme des actions, la visibilité des formations, les pages sur les missions et les espaces naturels, la distinction entre les usages pratiques et les sujets de découverte.

| Difficulté de repérage | Arbitrage proposé |
| --- | --- |
| « Passer son permis » se trouve dans les démarches, mais les débutants doivent aussi comprendre un parcours. | Conserver l'action dans Mes démarches et afficher le même lien dans Devenir chasseur, avec celui de validation. La séparation porte sur l'intention, pas sur le profil du visiteur. |
| Formulaires, arrêtés et guides vivent dans « Toute la documentation », séparés de l'action concernée. | Les présenter sur la page de démarche ou de réglementation correspondante ; conserver un index documentaire secondaire. |
| « Vos territoires et leur gestion » mêle gestion de chasse, aménagement et sanitaire. | Les opérations de gestion vont dans Mes démarches ; les règles et conseils dans Chasser en Vendée ; les projets écologiques dans Nature et biodiversité. |
| « Nos sites » sous La Fédération et « Nos espaces naturels » peuvent désigner deux choses proches. | Les lieux administratifs et de formation restent dans La Fédération ; les espaces naturels ont leur destination dans Nature et biodiversité. |
| Les partenariats apparaissent dans plusieurs rubriques. | Un annuaire principal dans La Fédération ; les projets nature y renvoient avec leur contexte. |
| « Communication & actualités » rassemble articles, presse, revue, vidéos et newsletter par support. | Les actualités ont leur index ; la revue et les communiqués relèvent de La Fédération ; une vidéo est placée d'abord sur le sujet qu'elle explique. |
| Huit entrées cachées derrière un burger imposent d'explorer avant de reconnaître une destination. | Six entrées visibles sur grand écran ; sur mobile, bouton « Menu » explicite, avec les mêmes libellés et le même ordre. |

Les détails du PDF ne prouvent pas qu'une prestation ou une formation est actuellement disponible. Les éléments absents du dépôt doivent être confirmés avant intégration.

## 5. Navigation recommandée

### Menu principal

| Ordre | Rubrique | La question à laquelle elle répond | Ne doit pas devenir… |
| --- | --- | --- | --- |
| 1 | **Mes démarches** | « Je veux passer ou valider mon permis, m'inscrire, déclarer ou me connecter. » | Un dossier général sur la chasse qui cache les actions. |
| 2 | **Devenir chasseur** | « Comment se passe le parcours, l'examen et le début de la pratique ? » | Un second dossier d'inscription : ses liens mènent aux mêmes démarches que Mes démarches. |
| 3 | **Formations** | « Quelles formations existent, pour qui et avec quel programme ? » | Un second espace de démarches ou un catalogue sans explications. |
| 4 | **Chasser en Vendée** | « Quand, où et selon quelles règles puis-je pratiquer ? » | Une seconde rubrique Mes démarches. |
| 5 | **Nature et biodiversité** | « Que fait la Fédération pour les milieux, la faune et la découverte de la nature ? » | Une seconde rubrique de gestion administrative des territoires. |
| 6 | **La Fédération** | « Qui fait quoi, quelles missions, quels documents et quels contacts ? » | La porte d'entrée obligatoire de tout le site. |

**Navigation utilitaire, accessible depuis toutes les pages :** Actualités et lien « Nous contacter », sans numéro de téléphone dans l'en-tête. Les actualités restent visibles sans devenir une septième grande rubrique. Le logo est un lien nommé vers l'accueil ; « Accueil » figure aussi dans le menu mobile et le fil d'Ariane.

**Pied de page commun :** coordonnées vérifiées de la Fédération, lien « Nous contacter », plan du site, tous les documents, questions fréquentes, glossaire et pages légales. Il est présent sur toutes les pages, accueil compris. Les liens les plus utiles restent également présents dans leur rubrique : le pied de page n'est pas leur seul accès.

Ne pas ajouter de champ de recherche décoratif ou sans moteur fonctionnel. Une recherche statique pourra être étudiée après classement du contenu ; elle ne doit pas compenser une arborescence ambiguë.

### Mes démarches : le bloc complet

Les huit entrées demandées restent visibles sur la page carrefour, dans l'ordre proposé par l'utilisateur. Les sous-choix dégâts, pertes et espaces sont nommés dès cette page pour éviter un clic exploratoire. Sur mobile, ils restent des liens textuels lisibles, pas des informations réservées au survol.

| Entrée | Sous-choix ou précision | Rôle de la page |
| --- | --- | --- |
| **Passer mon permis** | Inscription au permis. | Rappeler les conditions et les pièces utiles, puis donner l'accès à l'inscription. Les explications détaillées sur l'examen restent dans Devenir chasseur. |
| **Valider mon permis** | Première validation ou renouvellement, selon les modalités officielles. | Expliquer quoi préparer puis ouvrir le service de validation. Ne pas confondre permis obtenu et validation. |
| **Se former** | Choisir une formation pour s'inscrire. | Donner accès aux inscriptions et documents utiles ; renvoyer aux fiches de Formations pour comparer objectifs, publics et programmes. |
| **Déclarer mes prélèvements** | Outil adapté au type de prélèvement. | Expliquer quel service utiliser, dont ChassAdapt lorsque pertinent, sans prétendre qu'il couvre tous les cas. |
| **Déclarer une arme** | Système d'information sur les armes (SIA). | Guider vers les démarches officielles correspondantes ; ne pas assimiler toute démarche sur une arme à la seule création d'un compte. |
| **Déclarer un dégât** | **Dégâts de grand gibier** ; **Autres dégâts — DECLADOM (non indemnisables)**. | Orienter vers la bonne procédure. Le volet grand gibier vérifie les conditions applicables et ne promet pas une indemnisation automatique. |
| **Déclarer une perte** | **Perte de mon permis** ; **Perte d'une arme**. | Deux démarches distinctes. Le permis peut nécessiter une demande de duplicata ; pour une arme, modalités et interlocuteurs officiels à vérifier, sans extrapoler la procédure du permis. |
| **Se connecter à mon espace** | **Espace adhérent** ; **Espace maître d'équipage**. | Deux accès externes distincts : l'espace adhérent concerne les chasseurs et responsables de territoire ; l'autre concerne les maîtres d'équipage. Indiquer à qui s'adresse chaque accès. |

**Ajustements de libellés proposés, sans changer les actions :** garder « Mes démarches » et « Se former » ; développer « Grand Gibier » en « Dégâts de grand gibier » ; accompagner DECLADOM de « Autres dégâts » pour ne pas exiger de connaître l'outil ; nommer directement les deux types de pertes. L'orthographe et les accents sont harmonisés.

**Important :** « non indemnisables » reprend le classement demandé par l'utilisateur, pas une vérification juridique nouvelle. Le périmètre exact de DECLADOM et les conditions du grand gibier sont à faire confirmer par la Fédération avant publication. Ne pas orienter uniquement sur l'espèce responsable sans vérifier le type de dommage et la procédure applicable.

Pour faciliter le balayage, les huit liens peuvent être présentés sous des repères non cliquables (« Permis et formation », « Déclarations », « Pertes », « Connexion »). Ce sont des titres visuels facultatifs, pas quatre nouvelles pages ni des sous-menus qui cachent les actions.

### Séparer l'action de l'information, sans couper les parcours

| Je veux comprendre… | Je veux agir… |
| --- | --- |
| Devenir chasseur → parcours, conditions, déroulement de l'examen, préparation. | Liens directs « Passer mon permis » et « Valider mon permis en Vendée », également accessibles depuis Mes démarches. |
| Formations → catalogue, publics, objectifs, programmes et prérequis. | Mes démarches → Se former → inscription à la formation choisie. |
| Chasser en Vendée → règles, sécurité, dates, armes, gestion et dégâts. | Mes démarches → déclaration ou service correspondant. |
| Nature et biodiversité → projets, sites, faune et animations. | Liens contextualisés vers une démarche existante ou le contact compétent, sans inventer un téléservice. |
| La Fédération → missions, organisation et publications. | Contact utilitaire ou démarche correspondante, sans ajouter une seconde administration du site. |

Les pages de démarche gardent les explications indispensables pour agir : public, prérequis, pièces, étapes, service externe et aide. « Séparer » ne veut pas dire proposer une page vide avec un bouton. Les rubriques d'information peuvent reprendre directement les liens utiles vers la démarche unique ; elles ne réimplémentent pas l'inscription.

Dans **Devenir chasseur**, les liens « Passer mon permis » et « Valider mon permis en Vendée » figurent explicitement dans la navigation de la rubrique. Ils pointent respectivement vers les mêmes destinations que « Passer mon permis » et « Valider mon permis » dans Mes démarches : aucun passage intermédiaire obligatoire par le carrefour Mes démarches.

La sélection d'une formation doit être conservée lorsqu'on suit son lien d'inscription, sans obliger à la choisir à nouveau dans un catalogue général. Le moyen technique reste à décider lors de l'implémentation.

### Arborescence de travail

Les titres ci-dessous sont des destinations éditoriales proposées, pas encore des URL publiées. Un groupe n'impose pas une page intermédiaire : les pages les plus utiles peuvent être liées directement depuis la page carrefour.

```text
Accueil
├── Mes démarches
│   ├── Passer mon permis
│   ├── Valider mon permis
│   ├── Se former
│   ├── Déclarer mes prélèvements (dont ChassAdapt)
│   ├── Déclarer une arme (SIA)
│   ├── Déclarer un dégât
│   │   ├── Dégâts de grand gibier
│   │   └── Autres dégâts — DECLADOM (non indemnisables)
│   ├── Déclarer une perte
│   │   ├── Perte de mon permis
│   │   └── Perte d'une arme
│   └── Se connecter à mon espace
│       ├── Espace adhérent (chasseurs et responsables de territoire)
│       └── Espace maître d'équipage
├── Devenir chasseur
│   ├── Comprendre le parcours
│   ├── Conditions et déroulement du permis
│   ├── Passer mon permis → même démarche que dans Mes démarches
│   ├── Préparer l'examen
│   ├── Valider mon permis en Vendée → même démarche que dans Mes démarches
│   ├── Découvrir la chasse accompagnée
│   └── Mes premiers pas après le permis
├── Formations
│   ├── Catalogue : choisir et comprendre une formation
│   ├── Sécurité décennale
│   ├── Responsabilité de battue [offre à confirmer]
│   └── Fiches des formations proposées par la Fédération
├── Chasser en Vendée
│   ├── Dates d'ouverture et de fermeture
│   ├── Réglementation, arrêtés et SDGC
│   ├── Sécurité et partage de la nature
│   ├── Où chasser ? Associations et territoires
│   ├── Modes de chasse et espèces chassables
│   ├── Gestion du gibier et surveillance sanitaire
│   └── Situations particulières : collision, animal blessé
├── Nature et biodiversité
│   ├── Actions et programmes
│   ├── Bocage et plantations
│   ├── Espaces naturels
│   ├── Découvrir la faune et les milieux
│   └── Animations et éducation à la nature
└── La Fédération
    ├── Missions et chiffres clés
    ├── Équipe et services
    ├── Élus et gouvernance
    ├── Lieux et accueil
    ├── Publications officielles
    ├── Partenaires
    ├── Revue et presse
    └── Recrutement [contenu actuel à vérifier]

Accès transversaux : Actualités · Nous contacter · Tous les documents
                    Questions fréquentes · Glossaire · Plan du site
```

**Frontière importante :** Mes démarches rassemble les opérations ; les cinq autres rubriques expliquent les sujets et peuvent reprendre des liens d'action. Une même démarche peut être atteinte directement depuis plusieurs rubriques, mais elle conserve une seule adresse et son emplacement principal dans Mes démarches. Les fiches d'information restent dans leur rubrique thématique.

## 6. Accueil : accès rapides, puis actualités

La séquence reprend la préférence exprimée pour FDC 41, sans reproduire son graphisme. L'extraction textuelle consultée de cette référence montre surtout un flux social ; elle ne permet pas d'en tirer une analyse graphique complète.

```text
IDENTITÉ FDC 85                      Actualités · Nous contacter
MENU PRINCIPAL : les six rubriques

TITRE COURT : identification de la Fédération et du territoire
ACCÈS RAPIDES : « Que souhaitez-vous faire ? »
  Valider mon permis                Voir les dates de chasse
  Se former                         Passer mon permis
  Se connecter à mon espace         Déclarer un dégât
LIEN COMPLÉMENTAIRE : « Toutes mes démarches »

ALERTE PRATIQUE, seulement si une information active le justifie
ACTUALITÉS : trois sujets datés + « Toutes les actualités »

DÉCOUVRIR LA FÉDÉRATION ET SES ACTIONS
PIED DE PAGE : coordonnées · Nous contacter · repères et informations légales
```

Le numéro de téléphone et les autres coordonnées ne sont pas affichés dans l'en-tête ni dans le contenu principal de l'accueil. Ils figurent dans le pied de page commun, y compris sur l'accueil, et sur la page « Nous contacter ».

Ces six raccourcis sont un **point de départ**, pas une affirmation de fréquentation. Les cinq actions renvoient à Mes démarches ; « Voir les dates de chasse » reste un raccourci d'information dans Chasser en Vendée. « Toutes mes démarches » expose les huit entrées complètes sans surcharger l'accueil de tous les sous-choix.

La page Mes démarches n'est donc pas la copie de l'accueil : elle constitue l'index exhaustif des actions, tandis que l'accueil sélectionne quelques accès fréquents et conserve la place des actualités.

Les actualités ne portent pas seules une information durable. Un article annonçant une ouverture renvoie à la page Dates de chasse ; un article sur les validations renvoie à Valider mon permis. Pas de carrousel automatique ni d'actualités nécessaires cachées dans un flux social.

Une alerte est explicite, datée et retirée quand elle n'est plus applicable. Son placement avant les raccourcis n'est envisagé que pour une urgence réelle ; autrement, les tâches restent prioritaires.

## 7. Regroupement du contenu existant

Cette table couvre les pages standard, index et formations repérées dans le dépôt par familles. Les collections de documents, espèces, annuaires, FAQ et glossaire se rattachent aux destinations ci-dessous ; elles n'ajoutent pas chacune une rubrique au menu.

| Destination principale proposée | Contenus du dépôt à récupérer ou à réunir | Décision de classement |
| --- | --- | --- |
| Mes démarches → Valider mon permis | `chasser-en-vendee/validation-du-permis` ; guide et lien de validation dans les documents. | Explication puis service externe. Lien « Valider mon permis en Vendée » également visible dans Devenir chasseur. |
| Mes démarches → Se connecter à mon espace | `chasser-en-vendee/espace-adherent`. | Deux liens distincts : « Espace adhérent » pour chasseurs et responsables de territoire, et « Espace maître d'équipage ». Les deux plateformes sont externes ; destinations à revérifier. |
| Mes démarches → Espace adhérent / Déclarer mes prélèvements | Formulaires de plans de chasse, bilans, prélèvements, mutualisation, battue et documents de gestion. | Rattacher chaque opération au service réellement utilisé, sans ajouter automatiquement une neuvième entrée « Gérer mon territoire ». Les documents publics restent accessibles sans connexion ; les explications de gestion restent dans Chasser en Vendée. |
| Mes démarches → Déclarer mes prélèvements | `nature-et-territoires/chassadapt` et documents associés. | Le carnet numérique sert une action ; il ne relève pas d'abord de la découverte de la nature. |
| Mes démarches → Déclarer un dégât | `chasser-en-vendee/degats-causes-par-la-faune`, `decladom`, formulaires associés. | Séparer grand gibier et DECLADOM (non indemnisables, selon le classement demandé). La présentation générale des dégâts reste dans Chasser en Vendée ; les conditions d'indemnisation doivent être vérifiées. |
| Mes démarches → Déclarer une perte → permis | Documents de duplicata et attestation. | Préparer une page de démarche de perte et remplacement du permis après vérification officielle. |
| Mes démarches → Déclarer une perte → arme | Pas de page permanente dédiée repérée dans le cadrage initial. | Contenu à obtenir et vérifier : interlocuteur, déclaration et suites. Ne pas copier la procédure du permis ni assimiler perte et déclaration initiale d'une arme. |
| Mes démarches → Déclarer une arme | Articles et tutoriels SIA. | Préparer une page de démarche officielle après vérification ; conserver les articles dans les archives et les explications réglementaires dans Chasser en Vendée. |
| Mes démarches → Passer mon permis / Devenir chasseur → comprendre le permis | `permis-et-formations/passer-son-permis` et `devenir-chasseur`. | Répartir le contenu entre démarche d'inscription et explications de parcours ; afficher le lien direct vers la même démarche dans les deux rubriques, sans dupliquer le dossier. |
| Devenir chasseur → préparation et découverte | `entrainement-examen`, `chasse-accompagnee`. | Pages d'information ; accès à la démarche correspondante lorsqu'une inscription est nécessaire. « Premiers pas » à rédiger avec des faits validés et des liens vers validation, sécurité et lieux de pratique. |
| Formations / Mes démarches → Se former | Index `permis-et-formations/formations` ; fiches piégeage, corvidés, arc, vol, hygiène de la venaison, garde-chasse particulier. | Un catalogue et une fiche d'information par formation dans Formations ; accès aux inscriptions regroupé dans Se former, avec liens directs conservant le choix. Aucun second catalogue complet. |
| Formations → Sécurité décennale | Article `formation-securite-decennale` et document d'inscription délocalisée. | Une destination permanente à préparer après vérification des modalités ; ne pas faire d'un article ancien la fiche de référence. |
| Chasser en Vendée → Dates | `chasser-en-vendee/dates-de-chasse` et document des dates. | Une page de référence avec saison et source officielle. |
| Chasser en Vendée → Réglementation | Page et index de réglementation ; `ressources/sdgc` ; arrêtés et mémentos. | Réunir les deux portes d'entrée actuellement séparées. SDGC : nom développé, explication et document. |
| Chasser en Vendée → Sécurité et cohabitation | `prevention-et-securite`, `police-de-la-chasse`, `nature-et-territoires/vivre-la-nature-ensemble`. | Expliquer les règles et rôles ; orienter vers les formations correspondantes. |
| Chasser en Vendée → Où chasser | `ou-chasser`, annuaire `associations-de-chasse`. | Trouver un interlocuteur ou une association ; ne pas promettre de places ni d'accès à un territoire. |
| Chasser en Vendée → Pratiques | `types-et-modes-de-chasse` ; renvois vers les fiches espèces. | Distinguer présentation des pratiques et statut réglementaire des espèces ; ne pas présenter toute la faune comme chassable. |
| Chasser en Vendée → Gestion et sanitaire | `gestion-cynegetique`, `nature-et-territoires/veille-sanitaire-et-maladies`, guides sanitaires. | Conseils et cadre ; liens vers les démarches de gestion et alertes en vigueur. |
| Chasser en Vendée → Situations particulières | `collision-avec-la-faune`, `recherche-animaux-blesses`. | Deux pages distinctes, avec public et contacts appropriés ; ne pas confondre collision et animal blessé après un tir. |
| Nature et biodiversité → Actions | `agir-pour-environnement`, `eco-contribution`, `territoires-de-faune-sauvage`. | Présenter les actions et leur financement sans recréer un silo « documentation ». |
| Nature et biodiversité → Bocage | `plantations-bocageres`, `restauration-bocagere`, `bocage-vendeen`. | Une entrée lisible vers les projets et dispositifs ; liens depuis le parcours propriétaire. |
| Nature et biodiversité → Espaces naturels | `territoires`, `lagune-de-bouin`, `borderie-du-marais`, `marais-de-lieu-dieu`. | Un index et des fiches de sites ; accès/visites à confirmer, sans présumer d'une ouverture au public. |
| Nature et biodiversité → Faune et milieux | Index faune, 16 fiches espèces, `milieux-naturels`. | Connaissance de la nature ; statut de chaque espèce vérifié et contextualisé. |
| Nature et biodiversité → Animations | `animations`, `ekolien`. | Informations pédagogiques puis accès aux modalités disponibles. |
| La Fédération → Missions et chiffres | `qui-sommes-nous`, `chiffres-cles`, `nature-et-territoires/chasseurs-aujourdhui`. | Réunir les présentations qui se recoupent ; dater et sourcer les chiffres. |
| La Fédération → Organisation | Index équipe, conseil d'administration et leurs entrées d'annuaire. | Organisation par rôles et services ; coordonnées à revérifier. |
| La Fédération → Partenaires | Index partenaires et `nature-et-territoires/partenariats`. | Annuaire unique ; les projets expliquent la coopération et y renvoient. |
| La Fédération → Publications / revue | `documents-statutaires`, statuts, comptes, rapports ; `revue`. | Publication avec date et intitulé explicite ; distinguer dernier document et archives. |
| Actualités | Articles et index des actualités / archives. | Articles datés ; les informations périmées restent identifiées comme telles. |
| Nous contacter | `contact` ; renvoi depuis lieux, équipe et pages d'action. | Page utilitaire avec les coordonnées vérifiées, non enfermée dans La Fédération ; les coordonnées figurent aussi dans le pied de page commun. |
| Tous les documents | `ressources`, `formulaires-et-imprimes`, `tutoriels`, `reglementation`, `sdgc`, `recettes`. | Index secondaire par sujets : démarches, pratique, formations, Fédération. Les recettes peuvent être liées depuis la découverte de la venaison ; elles ne justifient pas une entrée principale. |
| Aides transversales | FAQ, glossaire, annuaire général. | Réponses et explications contextualisées ; l'annuaire renvoie aux répertoires de référence sans dupliquer leurs données. |
| Pied de page légal | Mentions légales, RGPD, politique cookies. | Adapter à la future architecture et aux traitements réels ; ne pas recopier des affirmations devenues inexactes. |
| Redirections | Collection `redirects` et matrices de migration. | Préparer une correspondance anciennes/nouvelles URL lors de la refonte ; aucune suppression automatique. |

Les quatre carrefours actuels seront remplacés ou répartis selon les six nouvelles rubriques **après validation**. Les index sont des moyens de présentation, pas une obligation de conserver des pages doublons.

### Éléments du PDF à confirmer séparément

Le PDF cite notamment responsabilité de battue, presse, newsletter, recrutement, certains espaces naturels et programmes. Leur présence dans le schéma ne suffit pas à les publier.

Pour chaque élément non couvert par une page permanente actuelle : vérifier l'existence, le responsable du contenu, la pertinence et la destination. N'ajouter une inscription newsletter que si un service réel existe et si ses modalités sont établies.

## 8. Règles de navigation et de rédaction

**Une destination principale, plusieurs chemins d'accès.** Formations → Sécurité décennale est la fiche d'information ; Mes démarches → Se former donne accès à sa démarche d'inscription. Devenir chasseur affiche directement « Passer mon permis » et « Valider mon permis en Vendée », qui mènent aux mêmes destinations que les liens de Mes démarches. Répéter un lien est souhaitable quand il aide le visiteur ; ne pas créer deux dossiers d'inscription ni deux pages de démarche équivalentes.

**La page parle avant le PDF.** Résumer à qui s'adresse une démarche, ce qu'il faut préparer, comment continuer et qui contacter. Le document complète l'explication. Afficher format, taille disponible, date et portée des documents ; ne pas inventer une taille inconnue.

**Le lien annonce sa destination.** Préférer « Déclarer mes prélèvements avec ChassAdapt » à « ChassAdapt », « Accéder à mon espace de responsable de territoire » à « RETRIEVER ». Le service externe et un éventuel nouvel onglet sont annoncés ; l'ouverture dans un nouvel onglet n'est pas systématique.

**Le visiteur sait où il est.** Titre explicite, fil d'Ariane, rubrique active, liens vers la prochaine étape et retour vers la rubrique. Viser les tâches prioritaires à un clic depuis l'accueil et les autres à deux choix de navigation ; ce sont des objectifs à tester, pas une garantie pour toutes les archives.

**Une moyenne d'âge élevée n'est pas un niveau numérique.** Ne pas infantiliser, ne pas multiplier les sous-menus, ne pas réserver une action au survol. Prévoir clavier, focus visible, libellés textuels, lecture confortable, zoom à 200 % et cibles d'au moins 44 pixels comme objectif de conception.

**Même logique sur mobile.** Menu nommé, état ouvert/fermé explicite, rubriques dans le même ordre, listes de liens lisibles ; les accès rapides précèdent toujours les actualités. Le contenu essentiel n'est pas caché par une animation ou un accordéon imposé.

## 9. Situations à prévoir avant implémentation

| Situation | Réponse attendue |
| --- | --- |
| Pas de prochaine date confirmée | Expliquer que les dates ne sont pas encore publiées et donner le contact ; ne pas afficher une ancienne session comme disponible. |
| Service externe indisponible | Garder les explications et l'aide consultables ; ne pas promettre de détecter automatiquement la panne sans dispositif réel. |
| Dégât : doute sur l'indemnisation | Expliquer les deux voies, leurs conditions vérifiées et le contact utile ; ne pas promettre une indemnisation ni envoyer automatiquement tout dégât dans DECLADOM. |
| Perte d'une arme | Présenter la procédure officielle vérifiée et les interlocuteurs adaptés ; ne pas la confondre avec perte de permis, vol ou déclaration initiale. |
| Inscription depuis une fiche formation | Conserver la formation sélectionnée et donner un retour vers sa fiche ; ne pas recommencer le choix sur une page générique. |
| Document remplacé ou saison terminée | Présenter le document actuel et identifier les archives ; vérifier les liens et les mentions de saison. |
| Aucune actualité récente ou aucune alerte | Ne pas inventer de nouvelles ; conserver l'accès aux articles datés et omettre le bloc d'alerte. |
| Long titre ou nom de service | Retour à la ligne sans troncature des libellés importants. |
| Beaucoup de documents ou de formations | Regroupement par sujet/public ; listes lisibles et pagination si nécessaire, sans immense menu déroulant. |
| Lien reçu directement ou résultat de moteur de recherche | Page compréhensible hors parcours, avec contexte, source et accès à la rubrique. |

## 10. Vérifier la proposition avec les vrais visiteurs

Avant de figer le menu, mener un petit test d'arborescence avec des représentants des trois publics prioritaires, dont des visiteurs plus âgés et des niveaux numériques variés. Ajouter des responsables de territoire et personnes concernées par les dégâts si ces publics sont validés.

Présenter uniquement les libellés et l'arborescence, sans expliquer où cliquer. Noter premier choix, hésitations, destination finale et différence entre réponse attendue et réponse trouvée.

| Consigne de test | Destination attendue |
| --- | --- |
| « Je veux renouveler ma validation pour la prochaine saison. » | Mes démarches → Valider mon permis ; Devenir chasseur → Valider mon permis en Vendée mène à la même page. |
| « Je n'ai jamais chassé et je veux comprendre comment se passe le permis. » | Devenir chasseur → Conditions et déroulement du permis. |
| « J'ai décidé de passer le permis et je veux m'inscrire. » | Mes démarches → Passer mon permis ou Devenir chasseur → Passer mon permis : même page. |
| « Je veux connaître le programme de la formation sécurité décennale. » | Formations → Sécurité décennale. |
| « Je veux m'inscrire à la formation sécurité décennale. » | Mes démarches → Se former → inscription concernée ; lien depuis la fiche également accepté. |
| « Je veux connaître les dates d'ouverture et de fermeture. » | Chasser en Vendée → Dates. |
| « Je gère une association et je cherche mon espace pour les plans de chasse. » | Mes démarches → Se connecter à mon espace → Espace adhérent (chasseurs et responsables de territoire). |
| « Je suis maître d'équipage et cherche mon espace. » | Mes démarches → Se connecter à mon espace → Espace maître d'équipage. |
| « Je dois déclarer des prélèvements. » | Mes démarches → Déclarer mes prélèvements → service adapté. |
| « Je cherche la démarche de déclaration d'une arme. » | Mes démarches → Déclarer une arme. |
| « Une parcelle a subi des dégâts et je cherche quoi faire. » | Mes démarches → Déclarer un dégât → orientation selon les conditions vérifiées. |
| « Je veux déclarer des dégâts non indemnisables dans DECLADOM. » | Mes démarches → Déclarer un dégât → Autres dégâts — DECLADOM. |
| « J'ai perdu mon permis. » | Mes démarches → Déclarer une perte → Perte de mon permis. |
| « J'ai perdu une arme et je cherche la procédure. » | Mes démarches → Déclarer une perte → Perte d'une arme, pas Déclarer une arme. |
| « Je prépare un dossier pour une mairie et je cherche les missions et le rapport de la Fédération. » | La Fédération → Missions / Publications officielles. |
| « Je souhaite organiser une animation nature avec ma classe. » | Nature et biodiversité → Animations. |
| « Je cherche le numéro de la Fédération. » | « Nous contacter » ou coordonnées dans le pied de page. |

Critère de décision : les tâches prioritaires ne doivent pas nécessiter une explication de notre classement. En cas de confusion récurrente, modifier les libellés ou les regroupements avant de dessiner le menu. Ne pas afficher un taux de réussite tant que les tests n'ont pas eu lieu.

## 11. Brief pour la prochaine étape

- **Travail du visiteur :** accéder aux démarches, comprendre un parcours d'entrée ou consulter une information de référence. Accueil orienté action ; pages d'explication orientées lecture.
- **Structure proposée :** accès rapides → actualités → découverte ; coordonnées dans le pied de page commun et sur « Nous contacter ». Six rubriques dont Mes démarches avec les huit actions demandées. Devenir chasseur comporte des liens directs pour passer et valider le permis vers les mêmes démarches.
- **Périmètre futur :** site public statique et code propre ; aucune édition sur le site, aucun compte local, aucun téléservice recréé. Contenus et URL historiques à auditer et migrer.
- **Direction visuelle :** non choisie. Ne pas confondre cette proposition de navigation avec une maquette validée, ni imposer les tokens du site actuel.
- **À faire valider :** libellés et ordre du menu, raccourcis de l'accueil, publics complémentaires et périmètre du persona administratif. Ensuite seulement : direction visuelle, maquette et implémentation de la copie propre.

## Sources

### Mise en œuvre provisoire — 1 novembre 2026

**Décision utilisateur confirmée :** implémenter le site public statique avec le visuel 8 « dossiers ouverts », sans attendre la validation graphique de la cliente. Cette demande dépasse la limite antérieure au seul cadrage ; elle ne vaut ni validation de l’identité par la cliente ni autorisation de fusionner ou de publier.

**Réalisé sur la branche de refonte :** six rubriques, huit démarches visibles, sous-choix dégâts/pertes/espaces distincts ; liens identiques vers passer et valider le permis depuis Devenir chasseur ; accès rapides avant actualités ; suppression de Pages CMS et des accès `/admin`, conservation des services externes. Les contenus gardent une destination principale par le routage `src/lib/routes.mjs` ; les anciennes adresses produisent une redirection statique. L’atelier reste indépendant et ses nouvelles variantes circulaires sont conservées sans être utilisées sur le site.

**Points à vérifier avant publication :** adresse directe actuelle de DECLADOM et canal de déclaration du grand gibier ; modalités des pertes ; tarifs et sessions de formation ; coordonnées et horaires. Les deux accès RETRIEVER répondent, mais l’adresse adhérent redirige actuellement vers le domaine maître d’équipage : faire confirmer les rôles sans supprimer un des accès. Les dates générales 2026-2027 ont été recoupées le 1 novembre 2026 avec la page de la Fédération ; revérifier les arrêtés avant publication. Les pages concernées signalent les limites au lieu d’inventer une procédure.

La piste 8 reste une **direction de travail provisoire** : prune `#39365e`, lilas par dossier et fond ivoire `#f5f2f8`, caractères système lisibles, liens exposés, dossiers empilés sur mobile. La validation cliente demeure ouverte ; aucun `DESIGN.md` n’est créé.

**Compacité équilibrée approuvée par l’utilisateur :** raccourcir les bandeaux et l’en-tête, resserrer les dossiers, rapprocher les sous-choix de leur action et conserver les textes d’action à 18 px ainsi que les cibles d’au moins 44 px. Les six rubriques, huit actions et distinctions restent visibles ; ce réglage ne valide pas l’identité graphique auprès de la cliente.

Mesures de la version compacte : en-tête 81 px, bandeau environ 175 px sur les viewports de contrôle 1280 et 1440 px ; tous les choix des dossiers se terminent vers 683 px et le bloc suivant commence vers 715 px. Le contrôle de reflow couvre 320, 390, 768, 1280 et 1440 px sans débordement horizontal.

- Brief, confirmation initiale et révisions utilisateur du bloc Mes démarches et des liens dans Devenir chasseur, le 1 novembre 2026.
- PDF joint « Mon premier tableau » : image d'arborescence sur une page, consultée après extraction de son image intégrée. Le fichier source n'est pas copié dans le dépôt.
- `src/content/site.json`, `src/pages/index.astro`, `src/content/standard-pages/`, `src/content/indexes/`, `src/content/trainings/` et inventaire des collections ; l’ancien `home.json` est conservé dans l’historique Git.
- `docs/migration-wordpress.md` et `README.md` pour le périmètre historique.
- <https://fdc41.com/> : référence cliente pour la séquence de l'accueil ; aucun actif graphique repris.
