# Site web — Fédération des Chasseurs de la Vendée

Site statique [Astro](https://astro.build/) administrable dans [Pages CMS](https://pagescms.org/). Il fonctionne sans serveur ni base de données. La mesure d’audience Umami Cloud est prête mais désactivée par défaut : sans configuration, aucun script de suivi ni aucune requête vers Umami n’est généré.

## Développement et validation

Prérequis de développement : Node.js 22.12 ou plus et npm.

```bash
npm ci
npm run dev
```

Le build de production exécute le contrôle TypeScript, génère le site puis vérifie les routes, les liens internes, les médias et plusieurs repères d’accessibilité :

```bash
npm run build
npm run preview
```

Sur Cloudflare Pages, l’URL de production est `https://fdc85.maury.app/`, sans préfixe.
La présence de `CF_PAGES` ou `CF_PAGES_BRANCH` choisit ces valeurs même si les variables
personnalisées ne sont pas définies dans les previews. Les variables `ASTRO_SITE` et
`ASTRO_BASE_PATH` explicites restent prioritaires. Hors Cloudflare, le défaut historique
`https://federationchassevendee.github.io/site-web/` est conservé. Les liens Markdown et
les trois redirections HTML historiques sont adaptés au rendu, sans modifier les contenus.

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
4. Modifier les champs en français, enregistrer puis publier. Aucun Git ni HTML n’est demandé.

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

L’intégration utilise exclusivement le script officiel `https://cloud.umami.is/script.js`, avec `defer`,
le `data-website-id` public fourni par Umami et `data-do-not-track="true"` pour respecter la préférence
Do Not Track du navigateur. Le script est injecté une seule fois par le layout global : il couvre toutes
les pages Astro, dont toutes les pages indexables, les redirections gérées par Astro et la page 404. Trois
redirections historiques à slug emoji sont des fichiers HTML statiques `noindex` à rafraîchissement
immédiat ; elles sont volontairement exclues du suivi.

Pour l’activer :

1. Créer un compte ou se connecter à [Umami Cloud](https://cloud.umami.is/), puis ajouter un site pour le domaine publié.
2. Dans les réglages de ce site Umami, copier son **Website ID**. Cet identifiant est public : ne jamais saisir ici de clé API, jeton ou secret.
3. Ouvrir Pages CMS, puis **Paramètres du site > Analytics — Umami Cloud**.
4. Coller le Website ID, puis activer **Activer la mesure d’audience Umami**.
5. Publier la modification. Pages CMS crée un commit ; attendre la fin du nouveau build GitHub Actions et du déploiement GitHub Pages.
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

Cloudflare Pages publie aussi chaque branche de travail sur un alias de preview,
accessible depuis le contrôle Cloudflare de la pull request. L’ancienne action
Pages CMS et son workflow `pages-cms-preview.yml` sont supprimés dans cette variante.

## Option 4 — Node et npm dans le navigateur

Cette branche expérimente **WebContainers**, pas un serveur cloud ni un moteur qui
imite le HTML du site. Ouvrir `/admin/` sur la preview Cloudflare (ou
`/site-web/admin/` avec la base locale historique), dans un onglet complet de **Chrome
ou Edge sur ordinateur**. Aucun Node/npm, terminal ou logiciel n’est à installer sur
l’ordinateur de la personne qui édite.

1. Cliquer **Démarrer Node et Astro**. Le moteur et les sources ne sont chargés
   qu’à ce moment ; npm installe les dépendances dans le système de fichiers de
   l’onglet, puis exécute `npm run dev` avec `--host 0.0.0.0 --port 4321`.
2. Attendre **Serveur Astro prêt**, puis choisir une collection et un fichier.
   Les collections, labels et fichiers proviennent de `.pages.yml`. C’est un
   éditeur de fichier JSON ou Markdown/YAML, pas encore le formulaire riche de Pages CMS.
3. Modifier le fichier et cliquer **Appliquer à l’aperçu**. Le vrai Astro utilise
   `src/content.config.ts`, les templates, composants et renderers du site. L’écriture
   du fichier virtuel déclenche sa mise à jour à chaud. Les erreurs de format sont
   signalées dans l’atelier, les erreurs de schéma/rendu dans Astro et son journal.
4. Consulter le cadre ordinateur ou mobile ; le champ d’adresse ouvre une route
   locale. Les collections de données se consultent depuis leurs index.
5. **Exporter les brouillons (.zip)** conserve les vrais chemins
   `src/content/home.json`, `src/content/standard-pages/contact.md`, etc. Les fichiers
   restent des brouillons, à recopier dans Pages CMS ou à importer par la procédure
   GitHub habituelle. Le lien **Publier avec Pages CMS** mène à l’outil authentifié.

**Appliquer n’est pas publier.** Aucun commit, enregistrement GitHub, jeton PAT,
backend d’écriture ou workflow de publication n’est caché derrière ces boutons.
Les fichiers modifiés sont conservés dans le stockage local de ce navigateur pour
reprise ; un changement de snapshot est signalé afin de comparer avec le nouveau
site. Un avertissement protège la fermeture avant export. **Arrêter** libère Node
et conserve les brouillons ; **Effacer les brouillons** demande confirmation puis
supprime cette sauvegarde locale. Une erreur de stockage impose d’exporter avant
fermeture. Ne saisir que des contenus destinés à devenir publics.

### Contraintes réelles

- **HTTPS + isolation** : COOP `same-origin`, COEP `require-corp` et
  `SharedArrayBuffer` sont obligatoires. Le build génère `public/_headers`, avec
  isolation **uniquement** pour `/admin`, `/admin/` et `/admin/index.html` dans la
  base choisie. Les routes publiques et l’authentification Pages CMS ne sont pas
  isolées globalement. Les médias publics reçoivent seulement CORP `cross-origin`
  pour rester accessibles à l’aperçu. Le site ne désactive aucune protection du
  navigateur pour contourner une incompatibilité.
- **Navigateurs** : Chromium desktop est la cible validée. La documentation
  fournisseur décrit Firefox et Safari 16.4+ comme expérimentaux, avec différences
  de preview et de ressources externes ; le prototype les refuse explicitement,
  ainsi que les mobiles, plutôt que produire un faux aperçu.
- **Premier chargement** : Internet est nécessaire pour le runtime JS/WASM,
  npm et les compilateurs. Prévoir plusieurs minutes et des dizaines de Mo,
  selon le cache, la machine et le réseau. Les 260 médias existants (environ 106 Mo)
  restent sur ce site et sont servis à la demande ; ils ne sont pas tous montés
  dans Node. Les favicons binaires sont hydratés byte-for-byte. Le snapshot généré
  est limité aux sources publiques allowlistées, configuration/lockfile nécessaires
  et petites redirections HTML, jamais `.git`, `.env`, `node_modules` ou credentials.
  Il ne se régénère qu’au prochain démarrage/build du site hébergeur.
- **Astro 7** : les bindings natifs de Rolldown, du compilateur Astro et de
  Satteri ne peuvent pas tourner directement dans WebContainers. Le prototype
  installe leurs **artifacts WASI officiels aux versions du lockfile**, dans trois
  répertoires virtuels séparés. Rolldown exige le bridge emnapi 2.0.0-alpha.5 ;
  Astro/Markdown utilisent emnapi 1.11.1. Les réunir provoque `setLastError` ou
  `napi_create_async_work` incompatibles. Chaque artifact est lié à son propre
  bridge ; aucun code du fournisseur n’est patché et Astro/Vite ne sont pas
  rétrogradés. Dans le serveur navigateur seulement, un plugin Vite invalide
  les caches des runners après l’écriture du data-store Astro et déclenche son
  rechargement à chaud : le singleton de collection immuable ne doit pas masquer
  une modification du YAML/Markdown. Les routes et templates restent d’origine.
  `--force` sert uniquement à installer ces packages WASI marqués
  pour une autre architecture, dans l’onglet ; `--ignore-scripts` s’applique à ces
  trois installations supplémentaires. La compatibilité reste expérimentale et
  doit être revalidée lors d’une mise à jour du lockfile.
- **Données et fournisseur** : les calculs et les fichiers virtuels sont locaux
  à l’onglet, mais WebContainers dépend de StackBlitz (runtime, service workers,
  domaines de preview, cache/proxy de packages) et de npm. Ce code ne téléverse
  pas le dépôt vers un service d’exécution et n’utilise ni Bolt ni ses fonctions
  IA. Cela ne garantit pas l’absence de métadonnées réseau ou de traitement par
  ces fournisseurs : voir leurs politiques. Les bloqueurs de stockage tiers,
  restrictions réseau et limites de session peuvent bloquer le démarrage.
- **Licence** : la [documentation commerciale officielle](https://webcontainers.io/enterprise)
  dispense les prototypes/POC de licence commerciale. Les
  [conditions actuelles, §1.5(c)](https://stackblitz.com/terms-of-service) ont une
  formulation plus large concernant l’usage en production ou commercial : faire
  confirmer par StackBlitz les droits applicables à la Fédération avant de faire
  de cette option un outil de production. Aucun compte, abonnement, contrat payant
  ni achat n’a été créé. La licence MIT du client `@webcontainer/api` ne constitue
  pas à elle seule une licence pour le service runtime.

Les pages d’atelier et le site généré dans le navigateur sont `noindex` et ne
chargent pas Umami ; les paramètres analytics publiés ne sont pas modifiés. Les
ressources externes, notamment des médias de tiers, peuvent être bloquées par COEP.
En test sur localhost, les images redirigées depuis une preview HTTPS vers HTTP
loopback peuvent être bloquées : tester les médias sur la vraie preview HTTPS.

Références consultées : [browser support](https://webcontainers.io/guides/browser-support),
[headers](https://webcontainers.io/guides/configuring-headers),
[native addons et WASM](https://webcontainers.io/guides/troubleshooting),
[confidentialité](https://stackblitz.com/privacy-policy). Les sources Markdown
officielles sont aussi disponibles dans `stackblitz/webcontainer-docs`, quand le
site documentaire ne s’affiche pas correctement.

### Validation de l’expérimentation

```bash
npm run test:browser-admin
npm run build
npx playwright install chromium
```

Pour exercer **réellement** Node/npm/Astro (pas seulement des mocks), lancer un
build à base `/`, puis `node scripts/serve-browser-admin.mjs` dans un terminal.
Ce serveur statique de test sur `127.0.0.1:4358` reproduit les headers générés.
Dans un autre terminal, définir `ADMIN_TEST_URL=http://127.0.0.1:4358/admin/`
et lancer `npm run test:browser-admin:e2e`. `ADMIN_TEST_URL` peut aussi viser la
preview HTTPS Cloudflare. Le test exige server-ready, rendu original, HMR JSON
et Markdown, largeur mobile, absence d’Umami, noindex et ZIP exact. Il ne valide
les médias distants que sur HTTPS.

Pour un Chrome partagé déjà ouvert avec CDP, `ADMIN_TEST_CDP=http://127.0.0.1:9222`
utilise uniquement un nouvel onglet dans le contexte par défaut : aucune connexion,
approbation OAuth, écriture CMS, export de cookies ou fermeture du navigateur.
`ADMIN_TEST_LOG` et `ADMIN_TEST_SCREENSHOT` peuvent recevoir des chemins de preuves
locales (ne pas commiter ces artifacts).
