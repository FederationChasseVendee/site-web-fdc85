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

L’URL de production Cloudflare est `https://fdc85.maury.app/`. Les builds Cloudflare utilisent
automatiquement la racine `/`, même sans variables de preview. Hors Cloudflare, le préfixe
`/site-web/` et le domaine GitHub Pages sont conservés comme repli ; `ASTRO_SITE` et
`ASTRO_BASE_PATH` restent prioritaires lorsqu’ils sont définis.

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

Les schémas typés et leurs valeurs par défaut sont définis dans `src/lib/content-schemas.ts`,
puis utilisés par `src/content.config.ts` et par l’éditeur compagnon. La route statique
`src/pages/[...slug].astro` associe chaque collection au rendu partagé
`src/components/rendering/SiteContent.tsx`. Deux contenus ne peuvent pas produire la même URL.

## Modifier le site avec Pages CMS

1. Ouvrir [Pages CMS](https://app.pagescms.org/) et choisir le dépôt `FederationChasseVendee/site-web-fdc85`.
2. Choisir la branche de travail appropriée.
3. Ouvrir la collection correspondant au besoin : **Pages standard**, **Pages carrefour**, **Articles**, **Fiches espèces**, **Formations**, **Index et listes**, ou une collection de ressources.
4. Modifier les champs en français puis enregistrer. Pages CMS crée le commit ; attendre le déploiement Cloudflare. Aucun Git ni HTML n’est demandé.

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

### Éditeur compagnon avec aperçu avant enregistrement

Ouvrir **`/editeur/` sur le déploiement de la branche** (ou `/site-web/editeur/` avec le
repli local). Cet éditeur français place les champs de `.pages.yml` à côté du rendu réel :
accueil, pages standard, articles, carrefours, espèces, formations et index. Les ressources
s’affichent dans leurs index ; les paramètres du site sont exportables sans aperçu.

**Il fonctionne en mode brouillon local, pas comme une extension du Pages CMS hébergé.**
Les modifications sont prévisualisées sans attendre de commit, conservées sur cet appareil
et exportables en Markdown avec frontmatter YAML ou en JSON. L’export ne publie rien.
Ouvrir Pages CMS ne lui transfère pas le brouillon : reporter les champs dans son interface,
ou faire appliquer le fichier exporté à son chemin d’origine par un mainteneur.

L’ancienne action **Ouvrir la preview Cloudflare** et son workflow sont supprimés, sans
action de remplacement. L’éditeur et son cadre sont `noindex`, exclus du sitemap et sans
analytics. [Fonctionnement, limites, architecture et prérequis de publication](docs/editeur-apercu.md).

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

Cloudflare Pages publie aussi chaque branche de travail en preview. Le lien exact est fourni
par le contrôle **Cloudflare Pages** du commit ou de la pull request ; utiliser ce lien,
sans reconstruire l’alias à partir du nom de branche. Ajouter `/editeur/` à l’URL de la
preview pour essayer l’éditeur intégré. La version de contenu et le commit de ce build
sont affichés dans l’éditeur : ils ne prouvent pas qu’un brouillon local a été enregistré
dans GitHub, ni qu’une modification plus récente y a déjà été déployée.
