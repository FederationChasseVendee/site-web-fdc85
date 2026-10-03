# Site web — Fédération des Chasseurs de la Vendée

Site statique [Astro](https://astro.build/) administrable dans [Pages CMS](https://pagescms.org/). Il fonctionne sans serveur ni base de données. La mesure d’audience Umami Cloud est prête mais désactivée par défaut : sans configuration, aucun script de suivi ni aucune requête vers Umami n’est généré.

## Développement et validation

Prérequis : Node.js 22 et npm.

```bash
npm ci
npm run dev
```

Le build de production exécute le contrôle TypeScript, génère le site puis vérifie les routes, les liens internes, les médias et plusieurs repères d’accessibilité :

```bash
npm run build
npm run preview
```

Cloudflare utilise `https://fdc85.maury.app/` avec `ASTRO_BASE_PATH=/`.
Sans variables d’environnement, le développement conserve la base historique `/site-web/`.
L’espace de prévisualisation suit lui aussi cette base : `/admin/` sur Cloudflare,
`/site-web/admin/` avec les valeurs par défaut.
Quand `CF_PAGES=1`, les valeurs par défaut sont le domaine de production et la base `/`,
y compris pour les prévisualisations qui n’héritent pas des variables de production
du tableau de bord. Les variables `ASTRO_SITE` et `ASTRO_BASE_PATH` explicites restent prioritaires.
La construction réinitialise le cache de contenu pour refléter un changement de base ;
les liens Markdown et les trois redirections HTML historiques sous `/site-web/` sont
adaptés à la base configurée, sans modifier les contenus enregistrés.

## Migration WordPress

Les couches 2 et 3 reprennent les contenus publiés inventoriés dans les sitemaps publics WordPress :

- **89 pages permanentes**, chacune migrée, fusionnée, remplacée ou redirigée ;
- **86 URL dans `post-sitemap.xml`** : la vraie archive `/actualites/` et **85 articles importés** ;
- les contenus de démonstration des types `dt_portfolio`, `dt_gallery`, `dt_testimonials` et `dt_slideshow` restent exclus.

Contenus structurés importés :

- 16 fiches espèces et 16 images optimisées ;
- 6 formations internes, sans date périmée ;
- 47 ressources documentaires, dont le SDGC 2024-2030 et 2 guides sanitaires IAHP ;
- 15 questions fréquentes et 116 termes de glossaire ;
- 92 entrées d’annuaire : équipe, conseil d’administration, associations et partenaires ;
- 42 pages éditoriales, 4 carrefours et 17 index automatiques ;
- 90 redirections HTML statiques pour les anciennes adresses modifiées, dont trois slugs d’article avec emoji.

La [matrice des pages permanentes](docs/migration-wordpress.md), la
[matrice des 85 articles](docs/migration-actualites.md) et son
[rapport machine](docs/migration-actualites.json) documentent chaque décision, média, catégorie et destination.

## Les 7 templates

L’architecture reste volontairement limitée. Il n’y a pas de constructeur de page universel.

| Template | Collection | Usage |
| --- | --- | --- |
| Accueil | `src/content/home.json` | Démarches prioritaires, informations importantes, présentation et contact |
| Page carrefour | `src/content/crossroads/` | Entrée de rubrique avec cartes ordonnées ou contenus enfants générés |
| Page standard | `src/content/standard-pages/` | Contenu courant, contact et pages légales, avec documents, liens et appel à l’action facultatifs |
| Article | `src/content/articles/` | Actualité datée, catégorisée et éventuellement archivée |
| Fiche espèce | `src/content/species/` | Identification, habitat, alimentation, reproduction, répartition, statut et galerie |
| Formation | `src/content/trainings/` | Objectifs, public, prérequis, programme, informations pratiques, dates et inscription |
| Index générique | `src/content/indexes/` | Liste ou cartes provenant d’une collection choisie explicitement |

L’Index générique affiche les actualités, espèces, formations, documents, questions fréquentes, termes du glossaire ou entrées d’annuaire. Ces quatre dernières sources sont de simples collections de données dans `src/content/documents/`, `faqs/`, `glossary/` et `directories/` : elles ne créent pas de nouveaux templates.

Les schémas typés et leurs valeurs par défaut sont définis dans `src/content.config.ts`. La route statique `src/pages/[...slug].astro` associe chaque collection à son template. Deux contenus ne peuvent pas produire la même URL.

## Modifier le site avec Pages CMS

1. Ouvrir [Pages CMS](https://app.pagescms.org/) et choisir le dépôt `FederationChasseVendee/site-web-fdc85`.
2. Choisir la branche de travail appropriée.
3. Ouvrir la collection correspondant au besoin : **Pages standard**, **Pages carrefour**, **Articles**, **Fiches espèces**, **Formations**, **Index et listes**, ou une collection de ressources.
4. Modifier les champs en français puis enregistrer. Sur une branche de travail, cela ne publie pas sur le site public ; sur `main`, cela déclenche sa mise à jour après construction.

Les collections autorisent explicitement création, renommage et suppression. **Accueil** et **Paramètres du site** sont protégés contre ces trois opérations. Les images et documents chargés dans la médiathèque sont enregistrés dans `public/assets/`.

Les redirections d’anciennes adresses sont visibles mais protégées contre la création, le renommage et la suppression : elles font partie de la structure SEO du site.

Pour une image informative, renseigner une description utile. Pour une image purement décorative, activer **Image uniquement décorative** et laisser sa description vide. Le build refuse une image qui n’est ni décrite ni déclarée décorative.

### Créer une page

Le nom de fichier devient l’URL. Par exemple :

- `src/content/standard-pages/contact.md` → `/contact/` ;
- `src/content/articles/mon-article.md` → `/mon-article/`.

Les sous-dossiers servent à créer le fil d’Ariane. La page parente doit exister avant d’exposer un lien vers une page profonde.

Pour une page carrefour, saisir des cartes dans l’ordre souhaité. Lorsque la rubrique doit simplement reprendre tous les articles, espèces, formations ou index enfants, choisir **Ajouter automatiquement les contenus** plutôt que dupliquer les liens.

Pour un index, choisir clairement sa **Collection à afficher**, sa présentation en liste ou en cartes et, si nécessaire, une catégorie. FAQ, glossaire et annuaire sont toujours affichés directement : aucun accordéon ou contenu indispensable masqué.

## Navigation et accessibilité

Le menu principal est limité aux six rubriques conservées dans `src/content/site.json`. Le logo fournit le retour à l’accueil. **Valider mon permis** et **Contact** restent séparés comme actions prioritaires.

La météo de l’accueil affiche les conditions et les températures du jour à La Roche-sur-Yon,
comme indication locale pour la Vendée. Le navigateur interroge l’API publique Open-Meteo à
l’ouverture de la page ; si elle est inaccessible, le widget affiche une erreur et permet de
réessayer. Aucune clé API n’est nécessaire.

Le socle vise WCAG 2.2 AA : landmarks, titre unique, lien d’évitement, fils d’Ariane, focus visible, navigation clavier, cibles d’au moins 44 px, menu mobile à état explicite, alternatives d’images, annonce des nouveaux onglets, mise en page responsive et respect de `prefers-reduced-motion`. Les tests statiques ne remplacent pas un audit manuel avec clavier, lecteur d’écran et zoom à 200 %.

## Actualités, archives et référencement

Les actualités en cours sont triées par date décroissante et paginées par 12. Les alertes actives disposent
d’un bloc distinct sur l’accueil ; les actions prioritaires restent affichées avant toute actualité. Les
contenus anciens ou temporaires expirés sont conservés dans les
[archives](/site-web/actualites/archives/) avec un avertissement explicite.

Le build génère `sitemap.xml`, `robots.txt` et un flux Atom `feed.xml` sous `/site-web/`. Chaque article
possède une URL canonique, des métadonnées OpenGraph et `NewsArticle`. Les pages de redirection utilisent
une canonique vers leur destination et `noindex, follow`.

## Mesure d’audience Umami Cloud

L’intégration utilise exclusivement le script officiel `https://cloud.umami.is/script.js`, chargé avec `defer`,
le `data-website-id` public fourni par Umami et `data-do-not-track="true"` pour respecter la préférence
Do Not Track du navigateur. Le chargeur du layout global injecte le script une seule fois pour une page
ouverte directement, jamais à l’intérieur d’un cadre de comparaison. Il couvre les pages publiques Astro,
dont les pages indexables, les redirections gérées par Astro et la page 404. L’espace `/admin/` ne contient
aucun chargeur, et les builds de prévisualisation Cloudflare désactivent le suivi sur toutes les pages.
Trois
redirections historiques à slug emoji sont des fichiers HTML statiques `noindex` à rafraîchissement
immédiat ; elles sont volontairement exclues du suivi.

Pour l’activer :

1. Créer un compte ou se connecter à [Umami Cloud](https://cloud.umami.is/), puis ajouter un site pour le domaine publié.
2. Dans les réglages de ce site Umami, copier son **Website ID**. Cet identifiant est public : ne jamais saisir ici de clé API, jeton ou secret.
3. Ouvrir Pages CMS, puis **Paramètres du site > Analytics — Umami Cloud**.
4. Coller le Website ID, puis activer **Activer la mesure d’audience Umami**.
5. Enregistrer la modification et faire valider sa publication. Pages CMS crée un enregistrement ; attendre la fin de la construction et du déploiement Cloudflare Pages de `main`.
6. Ouvrir le site publié, vérifier dans l’onglet Réseau du navigateur une requête vers `cloud.umami.is`, puis confirmer la visite dans le tableau de bord Umami.

L’activation sans Website ID valide fait échouer le build avec un message actionnable, afin d’éviter une
fausse impression de collecte. Umami est généralement utilisé ici dans sa configuration standard sans
cookies ; aucune bannière n’est ajoutée sur cette hypothèse. Cela ne constitue pas un avis juridique :
vérifier les réglages réellement activés dans Umami et faire confirmer les obligations applicables au site.

## Publication

Le projet Cloudflare Pages `fdc85` doit être connecté directement au dépôt GitHub
`FederationChasseVendee/site-web-fdc85` avec `main` comme branche de production.
Cette intégration Cloudflare évite de stocker un jeton de déploiement dans GitHub.

Paramètres Pages : **Framework preset** `Astro`, commande de build `npm run build`,
répertoire de sortie `dist`, version Node.js `22`, et variables de build
`ASTRO_SITE=https://fdc85.maury.app` et `ASTRO_BASE_PATH=/`. Le domaine personnalisé
`fdc85.maury.app` doit être ajouté au projet Pages et pointer par CNAME vers
`fdc85.pages.dev` dans la zone DNS `maury.app`.

### Espace de prévisualisation autonome (variante A)

Ouvrir `/admin/` sur le déploiement voulu. Cet espace ne remplace pas Pages CMS et ne
l’intègre pas dans un cadre : **Modifier dans Pages CMS** ouvre l’éditeur hébergé dans
un nouvel onglet, sur la même branche et le fichier exact. Les cadres contiennent les
vraies pages compilées par Astro. Les champs non enregistrés dans Pages CMS ne sont
pas visibles. Après enregistrement, utiliser **Vérifier les enregistrements** puis
**Ouvrir la version récente** lorsque sa construction est terminée.
Les anciennes redirections Cloudflare de `/admin` vers Pages CMS ont été retirées ;
le préfixe de migration `/site-web/*` reste redirigé vers la racine. Le nouvel espace
et son manifeste reçoivent aussi un en-tête Cloudflare `X-Robots-Tag`.

L’espace propose recherche par titre/type, aperçu ordinateur ou téléphone, comparaison
avec le site public actuel et liens en pleine page. Les collections, libellés et chemins
source proviennent de `.pages.yml` et des collections Astro ; les ressources partagées
renvoient aux index qui les affichent, avec leurs règles de catégorie. Les articles
proposent aussi l’accueil et les listes d’actualités. Les réglages du site sont communs
à toutes les pages ; les documents peuvent être liés dans d’autres pages que les index
proposés. Aucune route individuelle de ressource ni maquette approximative n’est inventée.

Les liens suivent les routes de l’application hébergée Pages CMS :
`/{owner}/{repo}/{branch}/file/{name}` ou
`/{owner}/{repo}/{branch}/collection/{name}/edit/{path}`. Chaque paramètre est encodé
séparément, notamment **le chemin complet du fichier en un seul segment**, sous-dossiers
compris. Contrat vérifié dans les sources amont
[éditeur de collection](https://github.com/pages-cms/pages-cms/blob/main/app/%28main%29/%5Bowner%5D/%5Brepo%5D/%5Bbranch%5D/collection/%5Bname%5D/edit/%5Bpath%5D/page.tsx)
et [éditeur de fichier](https://github.com/pages-cms/pages-cms/blob/main/app/%28main%29/%5Bowner%5D/%5Brepo%5D/%5Bbranch%5D/file/%5Bname%5D/page.tsx).

`/admin/preview.json` contient l’identité de construction (`CF_PAGES_BRANCH`,
`CF_PAGES_COMMIT_SHA`, date, environnement, adresse immutable si fournie par
`CF_PAGES_URL`) et le catalogue généré. Localement, l’identité provient de Git et
est explicitement marquée locale : elle ne certifie pas les changements non enregistrés.
`PREVIEW_BUILD=true` permet de vérifier localement l’exclusion du suivi et de l’indexation.
Les identifiants absents ne sont jamais remplacés par une valeur inventée.

La recherche d’un autre espace interroge, sans jeton, les enregistrements et les
**check-runs** publics GitHub. Elle extrait l’adresse immutable de la sortie du contrôle
**Cloudflare Pages** réussi, puis vérifie que son manifeste répond et correspond
à l’enregistrement demandé. Un alias de branche calculé n’est jamais annoncé comme
prêt. Les constructions en attente, échecs, adresses manquantes, anciennes versions,
erreurs réseau/CORS et limites de requêtes sont signalés. Pour un dépôt privé, les
vérifications publiques ne fonctionnent pas : consulter les contrôles GitHub avec son
compte et ouvrir le déploiement depuis Cloudflare. Ne jamais ajouter de jeton dans le
navigateur. La comparaison d’identifiants prouve un écart de version, pas nécessairement
un changement visible sur la page sélectionnée.

**Sécurité et publication :** « non publiée » signifie hors du domaine de production,
pas confidentielle. Le dépôt est public et les déploiements de prévisualisation le sont
aussi par défaut. `noindex`, `robots.txt` et l’absence d’analytics ne sont pas une
authentification. Avant tout contenu confidentiel, configurer une protection Cloudflare
Access adaptée ; le dépôt public ne doit en aucun cas contenir ces données. Aucune
ressource ni configuration de production n’est créée automatiquement par cet espace.
L’édition reste authentifiée chez Pages CMS/GitHub. Le lien de relecture ouvre la
comparaison GitHub pour demander une validation ; aucun bouton ne simule une
publication, ne lance de workflow Pages CMS ni ne fusionne une pull request.

Validation ciblée : `npm run test:preview`, `npm run test:analytics`, puis
`npm run build`. Le validateur contrôle également que chaque aperçu référence
une page réellement générée, que chaque collection CMS est couverte et que
`/admin/` est absent du sitemap et du suivi.
