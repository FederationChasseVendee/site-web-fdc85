# Site web — Fédération des Chasseurs de la Vendée

Le site public reste un site statique [Astro](https://astro.build/) : les contenus,
les templates et les pages SEO sont versionnés dans Git. La route `/edit/` ajoute un
atelier local dans le navigateur et quelques fonctions Cloudflare Pages pour
l'authentification et les pull requests ; elle ne remplace pas Astro par un CMS ou
un serveur de rendu distant. La mesure d’audience Umami Cloud est prête mais
désactivée par défaut : sans configuration, aucun script de suivi ni aucune
requête vers Umami n’est généré.

## Développement et validation

Prérequis : **Node.js 24** (runtime `>=22.12`) et npm.

```bash
npm ci
npm run dev
```

Le build de production exécute le contrôle TypeScript, génère le site puis vérifie
les routes, les liens internes, les médias et plusieurs repères d’accessibilité :

```bash
npm run build
npm run preview
```

Les tests de l’éditeur sont exécutés par `node --test
scripts/test-editor-*.mjs`. Node 24 est recommandé localement, notamment parce que
sa prise en charge native du stripping TypeScript permet d’exécuter ces tests sans
compilation distante.

L’URL historique de production est
`https://federationchassevendee.github.io/site-web/`. Astro génère donc encore
tous les liens et médias de cette variante sous le préfixe `/site-web/`. La
configuration Cloudflare utilise `/` comme base et le site Cloudflare documenté
par `siteConfig` est `https://sitefdc85.maury.app`; les variables explicites de la
validation CI sont indiquées plus bas.

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
[rapport machine](docs/migration-actualites.json) documentent chaque décision,
média, catégorie et destination. Cette information de migration et les
redirections restent indépendantes de l’atelier d’édition.

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

L’Index générique affiche les actualités, espèces, formations, documents, questions
fréquentes, termes du glossaire ou entrées d’annuaire. Ces quatre dernières sources
sont de simples collections de données dans `src/content/documents/`, `faqs/`,
`glossary/` et `directories/` : elles ne créent pas de nouveaux templates.

Les schémas typés et leurs valeurs par défaut sont définis dans
`src/content.config.ts`. La route statique `src/pages/[...slug].astro` associe
chaque collection à son template. Deux contenus ne peuvent pas produire la même
URL.

## Modifier le site avec `/edit/`

L’atelier se trouve sur `/edit/` et fait passer chaque modification par une pull
request. Il ne demande pas de connaître Git, HTML ou le code : décrivez le
résultat souhaité dans le chat, puis vérifiez l’aperçu local et les validations.
Les limites de contenu et les sept templates restent celles décrites ci-dessus.

1. Ouvrir `/edit/` dans le site publié ou dans l’environnement de développement,
   puis choisir **Continuer avec GitHub**. L’authentification GitHub est
   nécessaire pour accéder au dépôt autorisé.
2. Dans la liste, **sélectionner** une modification existante pour la reprendre,
   ou **créer** une modification avec un intitulé court. Une nouvelle branche
   `editor/<login>/...` et une pull request brouillon sont créées avec le titre
   `[Editor][<login>] <description>`.
3. Décrire le changement dans le chat en français courant. L’assistant local
   prépare les fichiers de contenu autorisés et l’aperçu ; aucune écriture de
   code n’est nécessaire pour une modification éditoriale.
4. Le brouillon affiché dans le navigateur est persistant localement, séparé de
   l’enregistrement GitHub. **Sauvegarder** est une action distincte : elle
   valide l’état contrôlé et crée un commit uniquement sur la branche de la pull
   request, jamais directement sur `main` ou sur le site en production.
5. **Abandonner** ferme la pull request. La branche n’est pas supprimée
   automatiquement : cette conservation permet de reprendre ou d’inspecter la
   demande ; sa suppression éventuelle est une action GitHub distincte.

Les images et documents éditoriaux chargés par l’atelier restent dans
`public/assets/`. Pour une image informative, renseigner une description utile.
Pour une image purement décorative, activer **Image uniquement décorative** et
laisser sa description vide. Le build refuse une image qui n’est ni décrite ni
déclarée décorative.

### Créer une page

Le nom de fichier devient l’URL. Par exemple :

- `src/content/standard-pages/contact.md` → `/contact/` ;
- `src/content/articles/mon-article.md` → `/mon-article/`.

Les sous-dossiers servent à créer le fil d’Ariane. La page parente doit exister
avant d’exposer un lien vers une page profonde.

Pour une page carrefour, saisir des cartes dans l’ordre souhaité. Lorsque la
rubrique doit simplement reprendre tous les articles, espèces, formations ou
index enfants, choisir **Ajouter automatiquement les contenus** plutôt que
dupliquer les liens.

Pour un index, choisir clairement sa **Collection à afficher**, sa présentation
en liste ou en cartes et, si nécessaire, une catégorie. FAQ, glossaire et
annuaire sont toujours affichés directement : aucun accordéon ou contenu
indispensable masqué.

### Choisir, reprendre et publier une modification

L’atelier peut afficher plusieurs pull requests `[Editor]`. La sélection et la
reprise concernent toujours la branche de la demande choisie ; elles ne
réécrivent pas `main`. Le bouton de sauvegarde refuse une branche dont le SHA a
changé sans revalidation.

La mise en production n’est jamais implicite. Après une sauvegarde, il faut
demander explicitement **Mettre en production**, confirmer dans la boîte de
dialogue, puis laisser l’éditeur recontrôler le SHA exact de la pull request, son
état de fusion et chaque validation requise. Par défaut, les validations
attendues sont `Editor validation` et `Cloudflare Pages`. L’action fusionne dans
`main` uniquement si cette version précise est toujours valide et si la méthode
compatible avec le dépôt est disponible.

La fusion et le déploiement sont deux états différents. Après la fusion, l’état
de déploiement de production est consultable séparément ; une pull request
fusionnée ne signifie pas que le build ou le déploiement Cloudflare est déjà
terminé ou réussi. Ce suivi confirme uniquement les statuts GitHub de production
associés au SHA fusionné : le simple succès d’un build de pull request ne suffit
jamais.

Si Cloudflare n’émet pas ce signal de production via GitHub, l’état reste
**en attente**, puis le polling s’arrête au bout de dix minutes. Il faut alors
vérifier manuellement le déploiement dans Cloudflare. Dans l’état observé du
dépôt, `GET deployments?per_page=5` ne renvoie que d’anciens environnements
`github-pages` et aucun signal Cloudflare de production ; la documentation ne
promet donc pas qu’un suivi Cloudflare est effectivement configuré.

## Runtime local de l’éditeur

Il n’y a **ni IA distante ni compilation distante** : le modèle et l’aperçu
Astro s’exécutent dans le navigateur, avec WebLLM et WebContainer. Les premiers
téléchargements peuvent nécessiter une connexion réseau et l’accès à npm, au
service WebContainer de StackBlitz et au catalogue de modèles Hugging Face.
L’absence du réseau, un quota ou une erreur d’installation est signalé
explicitement ; l’éditeur ne remplace pas l’aperçu par une fausse réussite.

Le modèle WebLLM sélectionné par défaut est
`Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC`, choisi pour la qualité. L’estimation
d’environ **2,5 GB de VRAM** correspond au catalogue et à l’exécution du modèle,
pas à la taille d’un fichier téléchargé. Le choix explicite
`Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC` réduit l’empreinte à environ **1,6 GB
de VRAM**. Sur un appareil sans prise en charge f16, le choix fp32 consomme
davantage de VRAM. Il n’existe pas de repli vers un fournisseur cloud.

Après une interruption ou un délai dépassé de l’IA, le cache local du modèle
reste disponible. Le worker interrompu doit être arrêté ; le bouton
**Charger / réessayer** recharge alors le modèle depuis ce cache au lieu de
réutiliser le moteur interrompu.

Pour un aperçu réel, utiliser Chrome ou Edge sur ordinateur dans un contexte
HTTPS (localhost est l’exception de développement). La page `/edit/` doit
recevoir `Cross-Origin-Opener-Policy: same-origin` et
`Cross-Origin-Embedder-Policy: require-corp`, afin de disposer de
`SharedArrayBuffer`; le navigateur doit aussi exposer WebGPU. Les quotas OPFS,
IndexedDB et du cache du navigateur peuvent être insuffisants : ces erreurs
restent visibles et doivent être corrigées localement (libérer de l’espace,
réessayer ou changer de profil).

### Benchmark navigateur reproductible

Le script `scripts/editor-browser-benchmark.mjs` permet de vérifier le runtime
réel sans GitHub, pull request ni publication. Depuis la racine du dépôt :

```bash
npm.cmd run dev -- --host 127.0.0.1 --port 4322
git archive --format=zip --prefix=repo/ --output=public\editor-validation-archive.zip HEAD
node scripts\editor-browser-benchmark.mjs
```

Pour la campagne actuelle, lancer un Chrome indépendant avec le débogage
distant limité à `127.0.0.1:9222` (`--remote-debugging-address=127.0.0.1
--remote-debugging-port=9222`) et un profil dédié situé hors du dépôt. Ce
profil ne doit pas être partagé avec une autre session de développement.
Laisser Astro tourner sur le port `4322`, puis ouvrir
`http://127.0.0.1:4335/` dans un onglet Chrome ou Edge de premier niveau
(pas dans un iframe). Choisir **Coder 3B** ou **Coder 1,5B**, puis lancer le
vrai WebContainer et les dix demandes du benchmark : contenus JSON, Markdown et
CSS. Chaque cas doit être isolé, avec vérification exacte de la modification
ciblée et aucune modification hors cible. Le seuil de validation n’est pas
encore établi.

La vérification préalable a confirmé npm, WASI, le serveur Astro de
développement et des réponses HTTP 200 avec le modèle GPU. Les mesures réelles
restent non validées :

- première tentative : **0/10** sous un plafond de quatre minutes ; le timeout
  a révélé la réutilisation invalide d’un moteur interrompu, donc les cas
  suivants n’étaient pas indépendants ;
- schéma `oneOf` et regex : échec après **324 secondes** avec
  `Grammar matcher rejected the newly sampled token`, après un candidat ayant
  inventé un hash et du texte avant lecture ;
- objet plat Coder 3B : timeout du premier cas après **480 secondes** ;
- Coder 1,5B : lecture complète de 81 lignes, puis échec après **468 secondes**
  avec `oldText` absent ou ambigu ; candidat incorrect bloqué ;
- contexte brut Coder 3B : répétition de `/src/content/home.json` après
  **259 secondes**, alors qu’un chemin absolu est interdit ;
- correctif de chemins : lecture correcte, puis timeout du premier cas après
  **481 secondes** ; le modèle a recopié
  `« V démarches de chasse, simplement »` au lieu du vrai
  `« Vos démarches de chasse, simplement »`, et l’édition a été refusée.

L’exécution a été arrêtée avant le cas 2 lors du rechargement. La cause
identifiée était aussi un contexte JSON doublement encodé contenant le texte
source et les corrections sans source visible.

Le contrat à conserver est désormais : texte brut sous `SOURCE TEXT`, actions
d’écriture uniquement après lecture, hashes limités aux SHA lus, chemins limités
à la liste réellement lisible de la phase courante et relecture obligatoire
après échec. Le générateur reçoit cette liste et un schéma `enum` de chemins
pendant la lecture ; la policy n’est pas relâchée. Il n’y a plus de
réutilisation du moteur après une erreur de grammaire ou de génération, et les
erreurs fatales remontent immédiatement.

Aucun score de 9/10 n’a été atteint et aucun ensemble de dix cas indépendants
n’a été terminé. npm, WASI, Astro et les réponses HTTP 200 sont prouvés, mais
le modèle local reste trop lent et peu fiable sur un GPU sans f16. Les 99 tests,
le typecheck et le build passent. Le travail reste une pull request brouillon, la production est désactivée et la
performance ainsi que la qualité restent à résoudre. Les corrections précédentes
ont été poussées dans `c1766f9` et `4e2390f`.

Cette procédure est documentée pour une reprise ultérieure : aucun résultat
mesuré ne valide la qualité globale. À la fin d’une exécution, arrêter les deux
serveurs (Ctrl+C), puis supprimer précisément
`public\editor-validation-archive.zip`. Ne pas envoyer l’archive, créer de
pull request, fusionner ou publier pendant ce benchmark.

Le runtime navigateur vient du prototype PR17. Le benchmark de cohabitation de
cette nouvelle intégration reste bloqué sur la performance et la qualité :
cette documentation ne revendique aucune mesure de qualité d’un nouveau modèle
en production.

En développement, le runtime est activé par le mode dev. Pour un build non
développement, `PUBLIC_EDITOR_RUNTIME_ENABLED=true` est **obligatoire** avant
d’ouvrir l’atelier aux utilisateurs. Ne l’activer qu’après avoir confirmé avec
StackBlitz les conditions de licence de WebContainer en production : le client
runtime est MIT, mais la licence du service runtime est distincte. Aucun achat,
compte fournisseur ou changement de configuration externe n’est fourni ou
partagé par ce dépôt ; le runtime de production reste donc opt-in et bloqué
tant que cette confirmation de licence n’a pas été obtenue. Cette campagne
n’autorise ni n’active la production, qui reste actuellement désactivée.

## Configuration externe de l’authentification et des Functions

Le handler Cloudflare Pages Functions est
`functions/api/editor/[[path]].ts`. Le projet Pages doit lui fournir la liaison
KV `EDITOR_SESSIONS`. Les réglages suivants sont à saisir dans l’environnement
Cloudflare, jamais dans Git, un exemple de configuration ou une pull request :

| Nom | Type | Rôle |
| --- | --- | --- |
| `EDITOR_GITHUB_CLIENT_ID` | secret | Identifiant de l’application GitHub |
| `EDITOR_GITHUB_CLIENT_SECRET` | secret | Secret de l’application GitHub |
| `EDITOR_SESSION_KEY` | secret | Clé AES-GCM de 32 octets encodée en base64 |
| `EDITOR_ORIGIN` | secret/configuration | Origine HTTPS fixe, sans chemin ni paramètre |
| `EDITOR_BASE_PATH` | optionnel | Préfixe absolu si le site est servi sous un sous-chemin |
| `EDITOR_REQUIRED_CHECKS` | optionnel | Noms exacts séparés par des virgules ; défaut `Editor validation,Cloudflare Pages` |
| `EDITOR_MERGE_METHOD` | optionnel | `merge`, `squash` ou `rebase`, si la méthode est autorisée par le dépôt |

Générer `EDITOR_SESSION_KEY` hors du dépôt (par exemple avec un générateur de
secrets local), puis l’enregistrer comme secret Cloudflare ; aucune valeur réelle
ne doit apparaître dans la documentation ou les exemples. `EDITOR_ORIGIN` doit
correspondre exactement à l’origine publiée, et le callback GitHub doit être
`<origin>/api/editor/callback` (avec le préfixe de base éventuel).

Créer ou configurer l’application GitHub pour le dépôt
`FederationChasseVendee/site-web-fdc85`, puis l’installer uniquement sur ce
dépôt sélectionné. Accorder seulement : **Contents** en lecture/écriture,
**Pull requests** en lecture/écriture, **Checks**, **Commit statuses** et
**Deployments** en lecture, ainsi que **Metadata** en lecture. Enregistrer le
callback dans la configuration externe ; le serveur génère et vérifie l’état
OAuth et le PKCE, conserve les jetons chiffrés dans KV et utilise des cookies
`HttpOnly` et `Secure`; les actions d’écriture exigent un contrôle CSRF et une
origine exacte. L’application GitHub, son OAuth et ses réglages ne sont pas
configurés par ce dépôt : l’administrateur doit les enregistrer lui-même.

Une configuration manquante échoue avec un message actionnable ; il n’y a pas de
fallback de preview fictif et aucun secret ne doit être commité.

### Site Cloudflare et chemins historiques

Le projet Cloudflare Pages `fdc85` doit être connecté directement au dépôt GitHub
`FederationChasseVendee/site-web-fdc85` avec `main` comme branche de production.
Cette intégration évite de stocker un jeton de déploiement dans GitHub.

Paramètres Pages : preset **Astro**, commande de build `npm run build`,
répertoire de sortie `dist`, Node.js 24, `ASTRO_SITE=https://fdc85.maury.app`
et `ASTRO_BASE_PATH=/` pour la validation et la production actuelle. Le domaine
publié doit être enregistré dans Cloudflare Pages et sa zone DNS. Le
`siteConfig` Cloudflare conserve la base `/` et son défaut documenté
`https://sitefdc85.maury.app`; le mode historique GitHub Pages conserve
`https://federationchassevendee.github.io` et `/site-web`.

Cloudflare Pages peut publier les branches de travail sur ses previews natives.
Le lien de preview et l’état de déploiement sont ceux du fournisseur Cloudflare ;
aucun ancien workflow de commentaire ou d’action CMS n’est requis. Ils ne
déclenchent ni la fusion ni l’écriture d’un token dans GitHub.

## Navigation et accessibilité

Le menu principal est limité aux six rubriques conservées dans
`src/content/site.json`. Le logo fournit le retour à l’accueil. **Valider mon
permis** et **Contact** restent séparés comme actions prioritaires.

La météo de l’accueil affiche les conditions et les températures du jour à La
Roche-sur-Yon, comme indication locale pour la Vendée. Le navigateur interroge
l’API publique Open-Meteo à l’ouverture de la page ; si elle est inaccessible,
le widget affiche une erreur et permet de réessayer. Aucune clé API n’est
nécessaire.

Le socle vise WCAG 2.2 AA : landmarks, titre unique, lien d’évitement,
fils d’Ariane, focus visible, navigation clavier, cibles d’au moins 44 px, menu
mobile à état explicite, alternatives d’images, annonce des nouveaux onglets,
mise en page responsive et respect de `prefers-reduced-motion`. Les tests
statiques ne remplacent pas un audit manuel avec clavier, lecteur d’écran et
zoom à 200 %.

## Actualités, archives et référencement

Les actualités en cours sont triées par date décroissante et paginées par 12.
Les alertes actives disposent d’un bloc distinct sur l’accueil ; les actions
prioritaires restent affichées avant toute actualité. Les contenus anciens ou
temporaires expirés sont conservés dans les
[archives](/site-web/actualites/archives/) avec un avertissement explicite.

Le build génère `sitemap.xml`, `robots.txt` et un flux Atom `feed.xml` sous
`/site-web/`. Chaque article possède une URL canonique, des métadonnées OpenGraph
et `NewsArticle`. Les pages de redirection utilisent une canonique vers leur
destination et `noindex, follow`.

## Mesure d’audience Umami Cloud

L’intégration utilise exclusivement le script officiel
`https://cloud.umami.is/script.js`, avec `defer`, le `data-website-id` public
fourni par Umami et `data-do-not-track="true"` pour respecter la préférence Do
Not Track du navigateur. Le script est injecté une seule fois par le layout
global : il couvre toutes les pages Astro, dont toutes les pages indexables, les
redirections gérées par Astro et la page 404. Trois redirections historiques à
slug emoji sont des fichiers HTML statiques `noindex` à rafraîchissement
immédiat ; elles sont volontairement exclues du suivi.

Pour l’activer :

1. Créer un compte ou se connecter à [Umami Cloud](https://cloud.umami.is/),
   puis ajouter un site pour le domaine publié.
2. Dans les réglages de ce site Umami, copier son **Website ID**. Cet identifiant
   est public : ne jamais saisir ici de clé API, jeton ou secret.
3. Dans `/edit/`, demander la modification de `src/content/site.json` et
   renseigner le Website ID ainsi que l’opt-in Analytics.
4. Vérifier l’aperçu et les validations, sauvegarder sur la pull request, puis
   demander explicitement sa fusion dans `main`.
5. Après le déploiement de la version fusionnée, ouvrir le site publié, vérifier
   dans l’onglet Réseau une requête vers `cloud.umami.is`, puis confirmer la
   visite dans le tableau de bord Umami.

L’activation sans Website ID valide fait échouer le build avec un message
actionnable, afin d’éviter une fausse impression de collecte. Umami est
généralement utilisé ici dans sa configuration standard sans cookies ; aucune
bannière n’est ajoutée sur cette hypothèse. Cela ne constitue pas un avis
juridique : vérifier les réglages réellement activés dans Umami et faire
confirmer les obligations applicables au site.

## CI de validation

Le workflow **Editor validation** se déclenche pour chaque pull request vers
`main` et pour chaque push sur `main`. Son job porte exactement le nom
**Editor validation**, utilise des actions stables de checkout et de
configuration Node, exécute Node 24 puis :

```text
npm ci
npm run test:editor
npm run test:analytics
npm run build
```

La CI expose `ASTRO_SITE=https://fdc85.maury.app` et `ASTRO_BASE_PATH=/`. Elle
possède uniquement `contents: read` : elle n’écrit aucun token, ne fusionne
aucune pull request et ne déploie rien. Les benchmarks GPU réels ne font pas
partie de la CI ; ils restent une vérification locale séparée, notamment parce
que WebGPU, la VRAM et les quotas navigateur ne sont pas disponibles de manière
reproductible sur le runner.
