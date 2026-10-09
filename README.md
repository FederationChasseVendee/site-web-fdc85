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
La surveillance interne du store Astro n’est pas persistante et continue
à fournir le HMR pendant que le serveur tourne. Ce changement seul n’a pas
suffi à terminer l’attente du check dans le navigateur. Une instrumentation
réelle a confirmé que le résultat SDK et le code de sortie étaient bien `0`,
mais que WebContainer ne fermait pas le flux de sortie de ce processus WASI.
Un runner CLI interne attend donc les API officielles `astro.sync`,
`@astrojs/check.check` et `astro.build`, transmet les échecs, vide les sorties,
puis termine explicitement son processus dédié avec le code réel du résultat.
Après le véritable code de sortie, l’adaptateur laisse une seconde au journal
pour se vider, puis ferme explicitement son lecteur si le flux reste ouvert
(événement consigné). Un code non nul ou une erreur de lecture reste un échec.
Il ne modifie aucun paquet fournisseur et n’infère jamais une réussite depuis
le texte du journal. Le contrôle du site généré reste une étape obligatoire.
L’aperçu et sa validation conservent la base déclarée par le dépôt, au lieu
de forcer `/` : les anciennes branches contiennent encore des liens
`/site-web/`, et leur validateur distingue mal une base racine explicite.
Le serveur transmet sa base effective dans une preuve locale vérifiée avant
de construire l’URL de l’iframe. Ses réponses sont toujours `noindex/nofollow`
et bloquent les scripts tiers, même si une ancienne branche ne possède pas
encore le garde `PUBLIC_BROWSER_DRAFT` dans son layout.
Le suivi de la page courante est aussi injecté par un middleware enregistré
avec l’API officielle d’intégration Astro : il ne dépend pas de la présence
du bridge dans une ancienne branche. L’essai `WebContainer.setPreviewScript`
n’a pas livré de script dans les réponses réelles du host `local-corp` testé,
donc ce chemin n’est pas utilisé. Les messages de navigation sont adressés
à l’origine exacte de l’éditeur ; aucune information de session n’entre dans
ce script, et aucun fichier public du dépôt n’est réécrit.

Les mesures natives du 9 octobre 2026 distinguent une **nouvelle page avec les
caches du navigateur conservés** (115,7–152,3 s jusqu’à Node/Astro prêt) d’une
reprise dans le **même conteneur vivant** (28,3–33,9 s). Une création réelle
a pris 48,2 s, dont 7,4 s pour la confirmation de création GitHub ; un changement
entre deux PR aux dépendances identiques a pris 29,3 s. La première visite
complète de l’éditeur sans cache et le changement vers un verrou différent
n’ont pas été mesurés ; ces valeurs sont celles du parcours avant réutilisation
du serveur, pas une promesse pour toutes les machines.

Un essai indépendant dans un nouveau profil Chrome, sans caches navigateur,
a mesuré **125,8 s de Node jusqu’au document Astro utilisable**. Le vrai SDK,
npm, WASI et Astro ont exécuté les sources de main. Ce chronomètre commence
après réception et extraction des sources : l’archive de 98,6 Mo était servie
sur loopback, pas par la passerelle de production. L’authentification,
le téléchargement de production, les imports initiaux de la page et le modèle
IA sont exclus ; ce n’est pas un temps complet de première visite de `/edit/`.
Sur cet essai unique, l’enveloppe montage/configuration faisait 59,1 s,
npm ci 9,3 s et le démarrage Astro 20,4 s. Les frontières d’observation
diffèrent de celles des stages UI ; ces sous-phases ne sont pas un comparatif
causal des caches. Le profil Chrome authentifié n’a pas été touché.

La réutilisation du serveur a ensuite été vérifiée sur le vrai déploiement
avec le bundle chargé `YuLy1LGT` :

| Parcours, conteneur déjà actif et sources montées identiques | Jusqu’à l’aperçu prêt |
| --- | ---: |
| Reprendre #20 dans la même page | 8,3 s |
| Changer de #20 vers #21 | 9,5 s |
| Revenir de #21 vers #20 | 9,5 s |

Les trois traces confirment la réutilisation d’Astro et aucune nouvelle
commande `npm run dev`. Un vrai HTTP 200 Astro, le titre courant et noindex
ont été contrôlés, ainsi que les octets CSS inchangés. Le helper attendait
volontairement quatre secondes avant ce contrôle : son temps total n’est
pas présenté comme la latence minimale de démarrage. Ces gains concernent
des sources identiques ; une PR modifiant le site ou ses dépendances
conserve le redémarrage et les validations.
Un ancien iframe pouvait retourner un HTTP 200 de placeholder après un
redémarrage Astro à URL inchangée. Chaque signal réel de disponibilité du
serveur consomme désormais une nouvelle révision de navigation de l’iframe,
en conservant la route. À URL inchangée, le cadre et son contexte de navigation
sont recréés : réassigner seulement `src` pouvait conserver le pont vers
l’ancien port, notamment après une validation Astro. Les rendus et la seconde
confirmation du contrôleur ne rejouent pas cette reconnexion ; les messages
de route provenant du cadre détaché sont ignorés.
La vérification exige le vrai contenu Astro et ses en-têtes
`noindex/nofollow` et CSP, pas seulement HTTP 200 ou un ancien titre dans le DOM.
La régression a été vérifiée sur Chrome natif avec le bundle public corrigé
`BHf-lfIr` : un changement réel #21 → #20 a réaffecté l’URL identique de
l’iframe une seule fois, malgré les confirmations/rendus suivants. Le vrai
contenu Astro, HTTP 200, `X-Robots-Tag: noindex, nofollow` et la CSP ont été
confirmés sans reconnexion manuelle ; la CSS physique est restée inchangée.

Le profil WebLLM sélectionné par défaut est **Automatique** :
`Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC` sur GPU Intel ou sans f16,
et `Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC` sur les autres GPU avec f16.
Cette règle conservatrice réduit la charge sans prétendre mesurer la VRAM
disponible. Le choix explicite du 3B reste respecté sur tous les GPU,
avec la variante q4f32 si nécessaire. L’estimation
d’environ **2,5 GB de VRAM** correspond au catalogue et à l’exécution du modèle,
pas à la taille d’un fichier téléchargé. Le choix explicite
`Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC` réduit l’empreinte à environ **1,6 GB
de VRAM**. Sur un appareil sans prise en charge f16, le choix fp32 consomme
davantage de VRAM. Il n’existe pas de repli vers un fournisseur cloud.

### Perte du GPU pendant une demande

`DXGI_ERROR_DEVICE_HUNG` indique que Windows a réinitialisé le périphérique
graphique ; les seules traces ne permettent pas d’affirmer un manque de VRAM.
WebLLM décharge alors le moteur, qui peut ensuite rejeter une génération avec
`Object has already been disposed`. Le téléchargement terminé ne garantit donc
pas que l’inférence soit stable sur ce GPU/pilote.

Les erreurs de perte/libération du GPU arrêtent réellement le worker sans lui
envoyer un nouvel RPC d’interruption. Le diagnostic d’origine est conservé,
et l’interface propose **Recharger avec Coder 1,5B**. Ce bouton choisit
explicitement le modèle léger, mais ne relance pas la demande ni une sauvegarde.
Les écritures de la demande échouée sont restaurées ; le dépôt GitHub reste
inchangé. Si le modèle léger échoue aussi, redémarrer Chrome et vérifier le
pilote graphique. Ce mécanisme n’est pas une garantie contre un reset matériel.
Le blocage CSP d’Umami est volontaire dans l’aperçu et n’explique pas cette
perte du GPU ; les avertissements `powerPreference` et preload ne sont pas
des échecs de chargement du modèle.

Après une interruption ou un délai dépassé de l’IA, le cache local du modèle
reste disponible. Le worker interrompu doit être arrêté ; le bouton
**Charger / réessayer** recharge alors le modèle depuis ce cache au lieu de
réutiliser le moteur interrompu.

Pour un aperçu réel, utiliser Chrome ou Edge sur ordinateur dans un contexte
HTTPS (localhost est l’exception de développement). La page `/edit/` doit
recevoir `Cross-Origin-Opener-Policy: same-origin` et
`Cross-Origin-Embedder-Policy: require-corp`, afin de disposer de
`SharedArrayBuffer`. Le script du worker IA doit également recevoir
`Cross-Origin-Embedder-Policy: require-corp` ; sans cela, Chrome refuse de le
démarrer depuis le document isolé, même si JavaScript est servi avec HTTP 200.
L’intégration génère une règle ciblée `/_astro/ai-worker-*` avec cette politique
et `Cross-Origin-Resource-Policy: same-origin`, en tenant compte du préfixe de
base. Les mêmes headers sont appliqués au worker source en développement.
Les autres assets et pages publiques ne sont pas isolés par cette règle.
Le navigateur doit aussi exposer WebGPU. Les quotas OPFS,
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
encore atteint : la cible est au moins neuf cas réussis sur dix.

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

Le contrat actuel ne demande plus au modèle de recopier un hash ou un ancien
texte. Une lecture expose des références vérifiées : pointeurs JSON pour les
valeurs, références de valeurs CSS comme `--forest-950` et identifiants
de lignes pour Markdown et templates. Un parseur CSS expose uniquement
les plages réelles des valeurs de déclaration, sans recopier les sélecteurs,
accolades ou `!important`. `format:"lines"` conserve l’édition du code CSS.
Les propriétés répétées dans une lecture sont désambiguïsées par la ligne
(`L2/color`) ; les déclarations ambiguës sur une même ligne ne sont pas
proposées comme valeurs.
L’action
`edit(target, text)` remplace uniquement la référence lue ; `lines` permet un
passage de code dont toutes les lignes ont été consultées. Les versions restent
vérifiées par le filesystem hôte ; les autres octets, fins de ligne et valeurs
JSON sont préservés. Une erreur impose une relecture, et chaque changement
reste soumis à la validation Astro et au rollback atomique.
`edits(changes)` groupe de 1 à 32 références du même fichier et de la même
lecture en une écriture atomique, sans recopier un bloc de code complet.
Les références répétées ou qui se chevauchent sont refusées. Après un échec
de validation, le diagnostic réel du processus est transmis au modèle :
une nouvelle lecture et une correction effective sont exigées avant de
réessayer, au lieu de répéter `done` et la compilation du même fichier invalide.

Les phases d’inspection, d’édition et de conclusion sont séparées. Aucun outil
d’écriture n’est proposé avant une lecture réelle ; aucune conclusion initiale
n’est acceptée. Une lecture de valeurs utilise un contrat court d’édition
groupée ; les créations et changements de code demandent d’abord une lecture
brute, y compris sans matcher GPU. Les paramètres non reconnus sont refusés.
Les instructions restent génériques : découvrir les sources, lire avant
d’écrire, préserver ce qui est hors demande et vérifier les sources liées.
Aucune palette prédéfinie ni procédure propre à une demande de couleur
n’est codée. Les références CSS concernent toutes les déclarations,
par exemple les espacements ou la typographie, pas seulement les couleurs.
Sur les GPU f16, le schéma JSON contraint les chemins et
références proposés. Sur le GPU Intel fp32 testé, le matcher a rejeté des tokens
avec le schéma détaillé **et** avec un schéma d’objet JSON générique, y compris
sur le déploiement. Ce profil conserve donc le même modèle local et le
préprompt JSON, sans activer le matcher GPU. Le parseur, les références,
les versions et les contrôles de fichiers restent obligatoires dans les outils.
Ce mode est signalé dans le diagnostic. WebLLM 0.2.85 compile
`response_format.type="json_object"` avec `compileJSONSchema` même sans
schéma : une chaîne JSON explicite est donc fournie lorsque le matcher est utilisé. Le premier
essai du chat déployé a exposé ce défaut (`Cannot pass non-string to std::string`)
avant toute lecture ou écriture ; la demande a été restaurée et rien poussé.
Ce n’est pas un repli vers une IA
distante ni une permission d’écrire sans lecture/version. Une génération JSON
courte réelle a abouti en 39 secondes avec Coder 1,5B fp32 ; elle ne prouve pas
la réussite d’une demande de modification complète.

Les premières campagnes avaient observé une mauvaise cible SEO avec Coder 1,5B
et une conclusion initiale sans édition avec Coder 3B. Le contrat et les gardes
ont été corrigés. Le 9 octobre 2026, le parcours complet a ensuite fonctionné
sur le **déploiement Cloudflare Preview**, avec un seul WebContainer, le vrai
Coder 3B local et le vrai dépôt téléchargé après OAuth :
demande naturelle de remplacement du titre de la photo d’accueil,
édition de `hero.title`, check/build/contrôle du site généré, aperçu HTTP 200,
annulation groupée, répétition du changement et clic sur **Sauvegarder**.
Le titre physique et le `h1` compilé/affiché étaient tous
« Vos démarches de chasse en Vendée ».

La sauvegarde réelle dans la PR temporaire [#19](https://github.com/FederationChasseVendee/site-web-fdc85/pull/19)
a produit `eb5ff6b84b319a9ef8261424b10e9057471a5370`.
La comparaison avec son parent confirme **un seul fichier et une seule ligne
modifiés**, exclusivement ce titre. Le SHA-256 du fichier GitHub est identique
à celui du fichier réellement testé dans WebContainer :
`d3db8e8a1128a33697cccb9de81a584072c374bc89a5cb9c389e763b577a6fbc`.
La branche `main` et la configuration Cloudflare Production sont restées
inchangées. Les réponses de l’aperçu ont réellement fourni `noindex/nofollow`
et le CSP interdisant les scripts tiers ; Umami n’était pas initialisé.
Le lien Contact de cet ancien site a ensuite retourné HTTP 200 et transmis
sa route à l’éditeur ; le passage en affichage Mobile et le rendu suivant ont
conservé cette page. Le middleware privé a aussi passé le véritable
check/build et le contrôle généré inchangé dans WebContainer.

Enfin, **Abandonner cette modification** et sa confirmation ont réellement
fermé la PR #19, sans fusion. Une lecture GitHub indépendante confirme que
sa branche existe toujours au commit sauvegardé ci-dessus et que `main`
est inchangée. Le navigateur conserve les brouillons et revient au choix
de modification.

Le rejeu de la demande de palette marron sur la PR de test #20 a ensuite
exposé une perte du périphérique GPU avec 3B et plusieurs actions invalides
avec 1,5B. Les essais refusés ont restauré les fichiers et n’ont rien
sauvegardé. Avec le nouveau contrat CSS réellement chargé, 1,5B a passé
check/build/contrôle généré, mais a donné la même couleur au fond et au
texte : cette proposition a été annulée par l’UI, pas sauvegardée.
3B a ensuite conservé des teintes vertes et dépassé la limite de 480 secondes.
Le parseur et une compilation réussie ne prouvent donc pas le respect
de la demande ni les contrastes. La récupération GPU, les références CSS
et le contrat court sont couverts par les tests ; une palette marron
déployée réellement correcte reste à établir. La requête utilisateur
est placée après les données source, pour ne pas être éclipsée par celles-ci.
Le dernier essai 3B avec cet ordre a encore conservé certaines anciennes
teintes. Le délai global a interrompu le build après le check ; l’arrêt
du processus a ensuite détruit le WebContainer. Le brouillon en mémoire
a été restauré, mais la restauration physique a nécessité un rechargement
de l’éditeur. Aucun résultat de cet essai n’a été sauvegardé.

Le budget est désormais séparé : huit minutes cumulées de génération,
puis au plus trois minutes pour chaque validation complète, avec les mêmes
contrôles obligatoires. Un échec de build ne réinitialise pas le budget IA.
Annuler interrompt aussi la validation. Après une validation commencée,
le rollback redémarre l’aperçu à partir du snapshot complet, sans dépendre
de la capacité d’écriture de l’ancien conteneur. Une restauration impossible
reste une erreur explicite et désactive l’aperçu.

Le choix initial de Qwen2.5-Coder repose sur sa spécialisation code,
sa disponibilité dans WebLLM et son empreinte matérielle, pas sur un
benchmark comparatif réussi de cet éditeur. Le profil automatique 1,5B
sur Intel/sans f16 réduit la charge, sans garantir une meilleure qualité.
Les essais applicatifs restent nécessaires : les gardes et la compilation
ne prouvent ni la pertinence de la modification ni la qualité visuelle.

Aucun score de 9/10 n’a été atteint et aucun ensemble de dix cas indépendants
n’a été terminé : deux réussites du même scénario ne constituent pas cette
mesure. Le scénario de titre du POC fonctionne, mais une demande prend encore
plusieurs minutes sur l’Intel gen-9 sans f16 testé. Les tests, le typecheck et le
build passent. La PR d’implémentation reste brouillon ; le runtime, l’App,
le KV et les secrets ne sont activés que sur Preview. Une licence pour
l’utilisation commerciale et une mesure de qualité globale restent requises
avant de considérer une mise en production.

Cette procédure est documentée pour une reprise ultérieure : aucun résultat
mesuré ne valide la qualité globale. À la fin d’une exécution, arrêter les deux
serveurs (Ctrl+C), puis supprimer précisément
`public\editor-validation-archive.zip`. Ne pas envoyer l’archive, créer de
pull request, fusionner ou publier pendant ce benchmark.

Le runtime navigateur vient du prototype PR17. Le benchmark contrôle chaque
écriture physique dans WebContainer et le `h1` compilé du premier cas.
Sa campagne globale reste à terminer avec un seul runtime et un seul moteur
GPU ; cette documentation ne revendique pas de score global ni de mesure
de qualité en production.

La reprise d’un aperçu conserve désormais le processus Astro si le serveur
est sain et que tous les fichiers montés sont identiques, octet par octet.
Les métadonnées privées de PR, absentes du guest, ne forcent pas un redémarrage.
Les changements de source, de dépendances ou de médias reprennent le parcours
normal. Une écriture locale interdit la réutilisation jusqu’au redémarrage,
pour ne pas confondre une notification HMR avec des sources réellement chargées.
Les validations restent intégralement exécutées et redémarrent leur serveur.
Les reprises identiques ont été mesurées sur le déploiement ci-dessus ;
l’optimisation ne conserve pas Node après un rechargement de page.

En développement, le runtime est activé par le mode dev. Pour un build non
développement, `PUBLIC_EDITOR_RUNTIME_ENABLED=true` est **obligatoire** avant
d’ouvrir l’atelier aux utilisateurs. Pour le POC déployé, définir ce flag
**uniquement dans l’environnement Preview de Cloudflare Pages**, puis relancer
le build de la branche : une variable publique est incorporée au JavaScript
lors du build.

La [politique officielle de WebContainer](https://webcontainers.io/enterprise)
exempte les prototypes et POC de licence commerciale. Cette exemption permet
la prévisualisation de test, pas une activation implicite en production.
Le client runtime est MIT, mais la licence du service est distincte : confirmer
les conditions applicables avant une utilisation commerciale en production.
Aucun achat n’est effectué par ce dépôt. La configuration Production demeure
inchangée, avec le runtime désactivé tant que son activation n’est pas approuvée.

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

Pour le POC de cette branche, utiliser l’origine stable
`https://artymaury-local-ai-editor.fdc85.pages.dev`, pas l’URL immuable d’un
déploiement. Les connexions provenant d’une autre origine sont redirigées vers
`EDITOR_ORIGIN` **avant** la création du cookie OAuth, pour que le callback
retrouve son état sur le même hôte.

Limiter les secrets, `PUBLIC_EDITOR_RUNTIME_ENABLED=true` et la liaison
`EDITOR_SESSIONS` à la configuration **Preview**. Utiliser un namespace KV
dédié au POC et conserver intégralement les autres variables et bindings.
Ne pas modifier la configuration Production ou fusionner `main` pour activer
ce test. La création de l’application peut demander une confirmation GitHub
« Confirm access » ; celle-ci et la connexion Cloudflare doivent être effectuées
directement par l’administrateur dans son navigateur, sans communiquer ses
identifiants ou codes de double authentification.

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

Le SHA d’une demande sélectionnée est lu sur sa référence Git, et non seulement
dans les métadonnées de PR : celles-ci peuvent rester temporairement en retard
après une sauvegarde. Le commit effectivement sauvegardé (`savedSha`) reste
distinct du head courant. Si GitHub n’a pas encore recalculé la mergeabilité
de ce head, la publication attend ; elle ne réutilise pas un résultat périmé.

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
