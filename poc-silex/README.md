# POC Silex v3 — microsite autonome FDC 85

> **Statut : expérimental, `noindex`, sans déploiement.** Ce dossier n’est pas relié
> au build Astro ni au projet Cloudflare de production.

## Verdict

**No-go pour remplacer Pages CMS sur le site Astro actuel. Hybride envisageable
uniquement pour un microsite ou une landing page autonome.**

Silex v3 fournit un véritable éditeur visuel et génère un site statique, mais il ne
sait pas relire et réécrire les composants `.astro`, les fichiers Markdown typés, les
collections Astro ou les helpers de chemins de ce dépôt. Son offre hébergée gratuite
s’appuie sur GitLab ; aucun connecteur officiel GitHub n’a été trouvé. Le workflow
quotidien demandé — ouvrir Silex, modifier, cliquer sur Publier, puis laisser un commit
GitHub déclencher Cloudflare — n’existe donc pas gratuitement et sûrement sans pont
sur mesure.

Le POC prépare honnêtement l’option réaliste :

- deux pages autonomes, une variation de l’accueil et une page Contact ;
- un scaffold source Silex v3 séparé de l’export statique ;
- un export sans dépendance serveur, avec chemins relatifs ;
- un contrôle local et un artifact GitHub Actions manuel qui **ne déploie rien**.

Il ne démontre pas une intégration Astro qui n’existe pas. Il ne prétend pas non plus
que l’export versionné a été produit par la source : le runtime npm Silex a échoué sous
Windows et Docker Desktop n’était pas démarré dans l’environnement de validation.

## Silex actuel et versions à ne pas confondre

Cette évaluation cible **Silex v3**, le projet actif basé sur GrapesJS :

- [dépôt officiel `silexlabs/Silex`](https://github.com/silexlabs/Silex) ;
- [documentation v3](https://docs.silex.me/) ;
- [éditeur hébergé v3](https://v3.silex.me/) ;
- [modes d’exécution et auto-hébergement](https://docs.silex.me/en/dev/run) ;
- [publication](https://docs.silex.me/en/user/publish) ;
- [pages et liens](https://docs.silex.me/en/user/pages) ;
- [Symbols réutilisables](https://docs.silex.me/en/user/Symbols) ;
- [réglages de site et SEO](https://docs.silex.me/en/user/settings) ;
- [sémantique et SEO](https://docs.silex.me/en/guides/seo) ;
- [services et coûts](https://www.silex.me/services/).

La [documentation v2](https://docs.silex.me/en/user/v2), l’ancien
`editor.silex.me`, `Silex-v1`, les prototypes v2 et les anciens dépôts séparés ne
décrivent pas le produit courant. La v2 est dépréciée et aucune conversion automatique
v2 vers v3 n’est annoncée.

## Ce que contient le POC

```text
poc-silex/
├── source/                  source éditable Silex v3
│   └── fdc85-silex-poc/     identifiant du site dans le connecteur filesystem
│       ├── meta.json
│       ├── website.json
│       ├── pages/
│       └── assets/
├── export/                  référence statique distincte
│   ├── index.html
│   ├── contact.html
│   ├── css/site.css
│   └── assets/
├── scripts/
│   ├── check-static.mjs
│   └── serve-static.mjs
└── README.md
```

Silex v3 conserve l’état d’édition GrapesJS dans `website.json`, `meta.json` et des
fichiers JSON de pages. La publication produit séparément HTML, CSS et médias. Modifier
l’HTML exporté n’est pas un round-trip fiable vers la source Silex.

La source fournie respecte la structure filesystem v3, référence deux pages et
enregistre les deux médias locaux. Elle constitue un scaffold à ouvrir et normaliser
par Silex, pas une source déclarée byte-for-byte de `export/`.

`export/` est un **rendu statique de référence stabilisé manuellement** pour évaluer
l’expérience finale, les chemins, les liens, le responsive et les repères
d’accessibilité. Il contient davantage de blocs et de garde-fous que le scaffold
Silex. Une vraie publication Silex devra remplacer cet export seulement après
comparaison et validation ; cette étape reste manuelle et non vérifiée dans ce POC.

L’export de ce POC utilise uniquement des liens relatifs. Il fonctionne donc :

- localement à `/site-web/poc-silex/` ;
- sous `/site-web/poc-silex/` sur un GitHub Pages de dépôt ;
- sous `/poc-silex/` ou à la racine d’un domaine Cloudflare.

Cela évite les chemins `/css/...` et `/assets/...` que Silex peut produire par défaut
et qui casseraient sous le préfixe GitHub Pages `/site-web/`. Cette portabilité doit être
revérifiée après chaque vraie publication Silex.

Les liens vers le site de référence ciblent la production Cloudflare actuelle
`https://fdc85.maury.app/`, construite avec `ASTRO_SITE=https://fdc85.maury.app` et
`ASTRO_BASE_PATH=/`. Le serveur local monte volontairement le POC sous
`/site-web/poc-silex/` pour exercer aussi le scénario GitHub Pages historique, plus
contraignant.

## Tester le rendu local

Prérequis : Node.js 22.

```bash
node poc-silex/scripts/check-static.mjs
node poc-silex/scripts/serve-static.mjs
```

Puis ouvrir :

```text
http://127.0.0.1:4174/site-web/poc-silex/
```

Pour choisir un autre port :

```bash
PORT=4180 node poc-silex/scripts/serve-static.mjs
```

Sous PowerShell :

```powershell
$env:PORT=4180; node poc-silex/scripts/serve-static.mjs
```

Le contrôle vérifie les deux pages, les liens et médias locaux, l’absence de chemins
racine, `lang="fr"`, une description, un `h1`, le lien d’évitement, les alternatives
d’images, le focus visible, le responsive et `prefers-reduced-motion`. Ce contrôle ne
remplace pas un audit WCAG manuel au clavier, au zoom 200 % et avec lecteur d’écran.

## Ouvrir et modifier dans Silex

### Option 1 — Desktop alpha, sans compte

1. Télécharger l’application depuis [silex.me/download](https://www.silex.me/download/).
2. Ouvrir le tableau de bord local.
3. Ouvrir le dossier `poc-silex/source/`.
4. Modifier visuellement les pages **Accueil** et **Contact**.
5. Utiliser des **Symbols** pour le header et le footer afin de propager leurs
   modifications aux deux pages.
6. Publier vers un dossier local ou télécharger un ZIP.
7. Comparer la sortie avec `poc-silex/export/`. Ne pas remplacer le rendu de référence
   tant que les liens, le responsive, `noindex` et les repères WCAG ne sont pas repris.
8. Lancer `node poc-silex/scripts/check-static.mjs`.

Le Desktop est annoncé **alpha**. L’édition est locale et gratuite, mais le déploiement
et la sauvegarde distante restent à organiser.

### Option 2 — instance locale ou auto-hébergée

La documentation officielle propose encore `npx @silexlabs/silex`, mais le paquet npm
`@silexlabs/silex@3.9.0` publié au moment du POC n’expose pas de champ `bin` : la
commande `npx` échoue et ne constitue donc pas une procédure reproductible. Cette
incohérence entre documentation et paquet est une limite observée, pas contournée dans
le workflow éditorial.

Un démarrage direct du serveur npm a également échoué sous Windows avec
`ERR_UNSUPPORTED_ESM_URL_SCHEME` lors de l’import de la configuration depuis un chemin
`C:`. Ce défaut intervient avant le chargement du projet. Il renforce le choix du
Desktop ou de l’image Docker pour une évaluation locale.

Dans l’environnement du POC, le client Docker était installé mais le moteur Docker
Desktop n’était pas actif. Le chargement visuel du scaffold et sa normalisation par
Silex restent donc une étape manuelle bloquée. Le rendu statique, lui, a été servi et
parcouru localement.

Le chemin reproductible est l’image Docker officielle. Créer d’abord un dossier de
sortie vide `poc-silex/hosting/`, puis sous PowerShell :

```powershell
$storage = (Resolve-Path ".\poc-silex\source").Path
$hosting = (Resolve-Path ".\poc-silex\hosting").Path

docker run --rm `
  -p 6805:6805 `
  -e STORAGE_CONNECTORS=fs `
  -e HOSTING_CONNECTORS=fs,download `
  -e SILEX_FS_ROOT=/silex/storage `
  -e SILEX_FS_HOSTING_ROOT=/silex/hosting `
  -v "${storage}:/silex/storage" `
  -v "${hosting}:/silex/hosting" `
  silexlabs/silex
```

Ouvrir ensuite
`http://localhost:6805/?id=fdc85-silex-poc&connectorId=fs-storage`.
`SILEX_FS_ROOT` désigne le dossier parent `source/`, pas directement le sous-dossier
du site.

L’instance locale/self-hosted demande de configurer un stockage persistant et les
connecteurs utiles. L’éditeur est sous AGPL-3.0 ; exploiter une instance modifiée sur le
réseau implique d’examiner les obligations AGPL. Le logiciel est gratuit, pas
l’exploitation, les sauvegardes, les mises à jour ni le support.

### Option 3 — offre web gratuite

1. Ouvrir [v3.silex.me](https://v3.silex.me/).
2. S’authentifier avec un compte GitLab.
3. Créer ou ouvrir le projet GitLab depuis le tableau de bord.
4. Éditer visuellement puis publier vers GitLab Pages, FTP ou ZIP selon le connecteur.

Cette option ne peut pas ouvrir directement ce dépôt GitHub et ne déclenche pas
Cloudflare Pages connecté à GitHub.

## Publication et transparence de Git

### Workflow actuel avec Pages CMS

```text
Éditrice → Pages CMS → commit GitHub → build Cloudflare Pages
```

Git est transparent au quotidien. Les collections et validations Astro protègent les
268 routes et les contenus structurés.

### Workflow natif réaliste avec Silex Cloud

```text
Éditrice → Silex → commit GitLab → GitLab Pages
```

Git peut être transparent, mais la forge et l’hébergement ne sont plus ceux du projet.
Cloudflare connecté au dépôt GitHub n’est pas déclenché.

### Workflow GitHub + Cloudflare demandé

```text
Éditrice → Silex → [connecteur/bridge non fourni] → commit GitHub → Cloudflare Pages
```

Il faudrait maintenir au moins l’une de ces solutions :

1. un connecteur Silex GitHub sur mesure ;
2. un miroir GitLab vers GitHub avec gestion des erreurs et conflits ;
3. une instance Silex auto-hébergée qui publie vers un service chargé de committer sur
   GitHub ;
4. un export ZIP manuel remis à une personne technique.

Les trois premières solutions introduisent OAuth ou un jeton d’écriture, un service à
maintenir, des sauvegardes, des journaux, une gestion des conflits et une surface de
sécurité. La quatrième ne donne pas l’autonomie demandée. Le POC n’en simule aucune et
ne stocke aucun secret.

### Artifact de preview, sans déploiement

Le workflow manuel **POC Silex preview artifact**
(`.github/workflows/poc-silex-preview.yml`) :

1. valide l’export ;
2. téléverse `poc-silex/export/` comme artifact pendant 14 jours ;
3. ne possède que `contents: read` ;
4. n’appelle ni Cloudflare Pages ni GitHub Pages.

Il sert à relire un export dans une PR. Il n’écrase pas le workflow de production.

## Approches évaluées

### A — site statique Silex autonome

**Viable pour ce POC**, sous réserve d’un hébergement séparé ou d’une étape de
publication assumée.

Silex sait créer/supprimer des pages, composer visuellement, gérer des médias, des
réglages SEO, des points de rupture et des Symbols pour le header/footer. La sortie
HTML/CSS est statique et peut être hébergée gratuitement.

Limites :

- pas de connecteur GitHub/Cloudflare officiel identifié ;
- publication native orientée GitLab Pages, FTP ou ZIP ;
- chemins de sortie à contrôler pour un sous-chemin ;
- Desktop alpha ;
- sémantique, responsive et accessibilité modifiables librement, donc cassables ;
- édition simultanée déconseillée par la documentation de collaboration Silex.

### B — pages ou sections Silex intégrées dans Astro

**Rejetée : pas de round-trip supporté.**

Silex ne produit ni composants `.astro`, ni imports, ni schémas
`src/content.config.ts`, ni Markdown conforme aux collections. Il ne préserve pas les
layouts, routes, flux, sitemap, redirections, helpers de base URL ou contrôles de build.

Copier manuellement le HTML/CSS exporté dans Astro serait une reprise frontend
unidirectionnelle. Un `iframe` isolerait le rendu au prix de la navigation, du SEO, de
l’accessibilité et de la cohérence globale. Aucune de ces options n’offre une édition
visuelle durable de l’accueil ou de Contact dans le site existant.

## Grille d’évaluation

| Critère | Constat Silex v3 | Comparaison / risque pour ce site |
| --- | --- | --- |
| Autonomie réelle | Bonne dans Silex Cloud + GitLab ; locale dans Desktop | Pas de publication transparente vers GitHub + Cloudflare sans intégration custom |
| Création/suppression de pages | Oui depuis le panneau Pages ; la dernière page ne peut pas être supprimée | Adapté à un microsite, sans schémas métier |
| Header/footer globaux | Symbols réutilisables et synchronisés | Efficace si bien configuré ; ne crée pas les composants Astro |
| Risque de casser le design | Élevé : styles, structure et classes restent librement éditables | Pages CMS borne les champs et conserve les templates |
| Responsive | Prévisualisations et styles par device | Une éditrice peut aussi créer des débordements ou incohérences |
| WCAG | Balises sémantiques, `alt`, langue et labels disponibles | Pas de preuve d’un audit WCAG automatique ; garde-fous Astro plus forts |
| SEO | Titre, description, langue, favicon, Open Graph, `<head>` custom | Sitemap, canonical, robots et flux du site Astro ne sont pas repris automatiquement |
| Articles | Possible comme pages libres ou via CMS 11ty/GraphQL | Aucun mapping vers les 85 articles Astro |
| Espèces | Pas de modèle Astro | Perd les champs identification, habitat, alimentation, reproduction, galerie, etc. |
| Formations | Pas de modèle Astro | Perd objectifs, prérequis, programme, dates et inscription typés |
| Documents | Médias et liens possibles | Pas de collection documentaire ni validation PDF équivalente |
| Historique/versioning | Commits GitLab en cloud ; Git local dans Desktop | Historique oui, mais pas dans le dépôt GitHub actuel sans pont |
| Médias | Dossier `assets/`, gestion dans l’éditeur | Pas de pipeline Astro ; poids, noms, droits et textes alternatifs restent à contrôler |
| Publication | GitLab Pages, FTP, ZIP, dossier local selon connecteur | Pas de publication GitHub + Cloudflare en un clic prouvée |
| Maintenance | Logiciel libre AGPL-3.0 | Auto-hébergement/connecteur = exploitation supplémentaire |
| Coexistence Pages CMS | Possible seulement dans un périmètre séparé | Deux éditeurs et deux sources de vérité si Silex touche les mêmes pages |
| Coût | Logiciel, cloud annoncé et Desktop à 0 € | Infrastructure, intégration, support et temps de maintenance ne sont pas gratuits |

## Recommandation

Conserver **Pages CMS + Astro + Cloudflare** pour l’accueil, Contact et l’ensemble des
contenus structurés. Cette architecture offre déjà le workflow sans Git ni HTML,
l’historique GitHub, les previews de branche, les garde-fous typés et un build statique
gratuit.

Évaluer Silex uniquement pour un besoin nettement séparé : campagne temporaire,
mini-site événementiel ou landing page sur un domaine/sous-domaine indépendant, avec
une personne responsable de l’accessibilité et de la publication. Même dans ce cas,
préférer un hébergement à la racine ou vérifier systématiquement la réécriture des
chemins avant une publication sous `/site-web/`.

## Contrôles à refaire après une édition Silex

1. Publier dans un dossier local, jamais directement en production.
2. Conserver la source JSON et l’export dans des dossiers distincts.
3. Vérifier qu’aucun `href="/..."` ou `src="/..."` ne casse le sous-chemin.
4. Lancer `node poc-silex/scripts/check-static.mjs`.
5. Tester Accueil et Contact au clavier, à 200 % de zoom, en mobile et sans animation.
6. Contrôler titre, description, hiérarchie des titres, textes alternatifs et contraste.
7. Ouvrir une PR ; utiliser l’artifact manuel et la preview Cloudflare de branche si
   elle est volontairement configurée, sans toucher à `main`.
8. Ne publier qu’après revue humaine.
