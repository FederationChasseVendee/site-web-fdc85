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

La production Cloudflare est `https://fdc85.maury.app/`, avec
`ASTRO_SITE=https://fdc85.maury.app` et `ASTRO_BASE_PATH=/`. Sans variables,
le build conserve le repli historique `https://federationchassevendee.github.io/site-web/`.
Le build adapte les liens Markdown importés depuis l’ancien préfixe et les trois
redirections HTML Unicode à la base choisie, sans réécrire les contenus source.

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
4. Modifier les champs en français puis enregistrer sur la branche de travail. Pages CMS crée un commit : attendre le build Cloudflare, relire la preview puis faire valider la pull request. Il n’existe pas de publication distincte dans cette interface ; enregistrer sur `main` déclenche le déploiement de production.

Les collections autorisent explicitement création, renommage et suppression. **Accueil** et **Paramètres du site** sont protégés contre ces trois opérations. Les images et documents chargés dans la médiathèque sont enregistrés dans `public/assets/`.

Les redirections d’anciennes adresses sont visibles mais protégées contre la création, le renommage et la suppression : elles font partie de la structure SEO du site.

### Atelier `/admin/` — variante C, véritable CMS en iframe

Ouvrir `/admin/` sur le déploiement de la branche (ou `/site-web/admin/` avec le
repli local). L’atelier embarque **app.pagescms.org**, sans éditeur local ni proxy
d’authentification. Il associe les contenus aux routes réellement produites par
Astro : sous-dossiers et chemins de fichiers originaux, accueil, paramètres,
médiathèque `public/assets`, collections de données et index filtrés, références
documentaires, redirections, actualités et pagination. Les listes sont celles du
build, pas un inventaire GitHub en temps réel ; après une création ou un renommage,
ouvrir l’atelier du nouveau déploiement.

L’éditeur et l’aperçu sont indépendants : le sélecteur de contenu ouvre le fichier
CMS exact et une page concernée ; le sélecteur de page permet de parcourir tout le
site sans changer le fichier en cours d’édition. L’aperçu montre le **HTML compilé**,
jamais un brouillon non enregistré. Ordinateur (1280 px), mobile (390 px),
comparaison à la production, focus et plein écran sont disponibles. Les routes
`admin` sont exclues de la prévisualisation pour éviter une récursion.

La branche, le commit et le déploiement proviennent de `CF_PAGES_BRANCH`,
`CF_PAGES_COMMIT_SHA` et `CF_PAGES_URL` au build, ou du checkout Git local.
**Chercher le dernier build** consulte les API publiques GitHub, sélectionne le
contrôle **Cloudflare Pages** réussi du dernier commit, puis vérifie son
`admin/manifest.json` avant d’afficher son URL immuable. Il ne devine aucun alias de
branche, ne confond pas un alias actualisable avec un déploiement précis et ne
revient pas silencieusement à un ancien build. Une limite d’API ou un build encore
en cours est affiché explicitement. Sur `main`, le cadre CMS n’est pas ouvert
automatiquement : créer une branche et utiliser sa preview avant de modifier.

**Connexion et limites de l’iframe.** Connectez-vous dans « Ouvrir le CMS (nouvel
onglet) », puis rechargez le cadre. Si le navigateur refuse les cookies tiers ou
si Pages CMS change sa politique d’intégration, continuez à éditer dans cet onglet.
Le lien reste toujours accessible, même pendant un chargement ou après une erreur.
Après 12 secondes sans événement de chargement, l’atelier propose ce repli ; un
événement `load` ne prouve **ni authentification, ni accès au dépôt, ni succès de
l’éditeur**. La politique same-origin empêche de consulter ces états.

Les routes ont été vérifiées dans le
[code public Pages CMS](https://github.com/pages-cms/pages-cms/tree/6f4e860a35d934406580287e7042e5e111e207a1) :
`/{owner}/{repo}/{branch}/file/{name}`,
`/collection/{name}/edit/{path}` (chemin complet du dépôt encodé comme un segment)
et `/media/default` pour la configuration média unique. L’authentification redirige
vers `/sign-in?redirect=…` et la connexion GitHub utilise une navigation dans le
cadre courant. Les réponses HTTP réelles des routes home, fichier, collection et
sign-in contrôlées le 3 octobre 2026 ne portaient ni X-Frame-Options ni CSP
frame-ancestors. **GitHub `/login` renvoie X-Frame-Options: deny et
frame-ancestors 'none'** : sa connexion ne peut donc pas fonctionner dans le cadre.
Ces observations ne garantissent pas la session authentifiée ni le partage des
cookies dans tous les navigateurs.
Un essai réel dans Chrome headless, avec un profil isolé sans session utilisateur,
a affiché **Sign in to Pages CMS** dans l’iframe et préservé l’URL de retour vers
le fichier de la branche. La navigation de contenu, le repli, les deux largeurs,
la comparaison, le focus et l’absence de débordement mobile ont été exercés dans
ce navigateur. Aucun compte n’a été connecté et aucun enregistrement CMS n’a été
effectué pendant cette vérification.

Le sandbox CMS autorise scripts, origine réelle, formulaires, popups et
téléchargements : nécessaires à l’application, ses médias et ses liens. Les
popups peuvent quitter le sandbox pour permettre une ouverture normale du CMS,
mais la navigation du document parent n’est pas autorisée. Le seul droit
supplémentaire est l’écriture au presse-papiers. Aucun contournement de cookies,
de CSP ou d’authentification, aucune clé PAT et aucun stockage de jeton.

L’atelier est `noindex, nofollow`, exclu du sitemap et sans Umami. Le layout public
empêche Umami dans les iframes, sur les previews `*.pages.dev` et lorsque
`?admin-preview=1` est présent ; les liens internes de ce mode conservent ce
paramètre. Une ancienne version de production ne possède pas nécessairement cette
protection avant fusion. Les previews Cloudflare et l’atelier sont **publics** :
`noindex`, y compris l’en-tête Cloudflare, n’est pas une protection d’accès.

Validation ciblée après le build :

```bash
npm run test:admin
npm run test:analytics
```

Les tests couvrent les URLs CMS, branches et chemins imbriqués, base racine et
historique, exclusion admin, messages d’état honnêtes, repli permanent,
validation commit/déploiement, inventaire compilé, impacts des données et
exclusion du suivi. La connexion authentifiée et l’enregistrement CMS nécessitent
un compte autorisé dans un navigateur et ne sont pas prouvés par ces tests.

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
[archives](https://fdc85.maury.app/actualites/archives/) avec un avertissement explicite.

Le build génère `sitemap.xml`, `robots.txt` et un flux Atom `feed.xml` sous la base configurée. Chaque article
possède une URL canonique, des métadonnées OpenGraph et `NewsArticle`. Les pages de redirection utilisent
une canonique vers leur destination et `noindex, follow`.

## Mesure d’audience Umami Cloud

L’intégration utilise exclusivement le script officiel `https://cloud.umami.is/script.js`, avec `defer`,
le `data-website-id` public fourni par Umami et `data-do-not-track="true"` pour respecter la préférence
Do Not Track du navigateur. Le script est injecté au plus une fois par le layout global,
hors contexte admin/iframe/preview : il couvre les pages publiques Astro, dont les
redirections gérées par Astro et la page 404. Trois
redirections historiques à slug emoji sont des fichiers HTML statiques `noindex` à rafraîchissement
immédiat ; elles sont volontairement exclues du suivi.

Pour l’activer :

1. Créer un compte ou se connecter à [Umami Cloud](https://cloud.umami.is/), puis ajouter un site pour le domaine publié.
2. Dans les réglages de ce site Umami, copier son **Website ID**. Cet identifiant est public : ne jamais saisir ici de clé API, jeton ou secret.
3. Ouvrir Pages CMS, puis **Paramètres du site > Analytics — Umami Cloud**.
4. Coller le Website ID, puis activer **Activer la mesure d’audience Umami**.
5. Enregistrer sur une branche de travail, valider le build et la preview Cloudflare puis faire approuver la fusion. Pages CMS crée un commit ; Cloudflare publie `main` après fusion.
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

Cloudflare Pages publie aussi chaque branche de travail sur un alias de preview et
chaque build réussi sur une URL immuable. Le contrôle **Cloudflare Pages** du commit
GitHub fournit le vrai lien de déploiement. Ouvrir `/admin/` sur cette adresse pour
modifier la branche et vérifier le résultat. L’ancienne action Pages CMS
**Ouvrir la preview Cloudflare** et son workflow ont été retirés : aucun workflow
d’action CMS supplémentaire ni jeton Cloudflare n’est nécessaire.
