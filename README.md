# Site public — Fédération des Chasseurs de la Vendée

Site Astro entièrement statique, sans serveur applicatif, compte local, formulaire de collecte ni administration. Les inscriptions, validations et espaces externes sont conservés ; Pages CMS, sa configuration, son workflow et les accès `/admin` sont retirés.

## Refonte provisoire « dossiers ouverts »

L’utilisateur a demandé le 1 novembre 2026 l’implémentation complète avec la piste 8 `v2-folders`. **La direction visuelle n’est pas validée par la cliente.** Ce travail est une version de revue, pas une autorisation de publication ou de fusion. [PRODUCT.md](PRODUCT.md) porte les décisions confirmées et [le cadrage de navigation](docs/refonte/personas-et-navigation.md) conserve les propositions et points à vérifier. Aucun `DESIGN.md` ne fige prématurément l’identité.

Le menu expose six rubriques : Mes démarches, Devenir chasseur, Formations, Chasser en Vendée, Nature et biodiversité, La Fédération. Les huit actions sont regroupées dans trois dossiers ouverts ; les sous-choix dégâts de grand gibier/DECLADOM et permis/arme restent explicites, avec un accès unique « Espace Adhérent » vers le portail RETRIEVER. Devenir chasseur renvoie directement aux mêmes démarches de permis. L’accueil expose les actions avant les actualités, puis les parcours de découverte. Les coordonnées restent dans le pied de page et Nous contacter.

L’atelier `docs/refonte/propositions-visuelles.html`, ses pistes et ses avis sont conservés. Ses variantes circulaires ne sont pas utilisées dans cette implémentation.

## Développement

Prérequis : Node.js 22.12 ou plus récent et npm.

```sh
npm ci
npm run dev
npm run build
npm run preview
```

Sous Windows, utiliser `npm.cmd` si la politique PowerShell bloque `npm.ps1`.

Le build exécute le contrôle Astro/TypeScript, génère toutes les pages et vérifie leurs liens, médias, documents PDF, redirections, métadonnées, sitemap, flux et repères d’accessibilité. Il contrôle aussi les huit démarches, les liens de permis partagés avec Devenir chasseur, les deux accès externes et l’absence du téléphone dans le contenu principal de l’accueil.

```sh
npm run test:visual
npm run test:analytics
npm run test:routes
```

Les contrôles automatiques ne constituent pas une certification WCAG. Vérifier également la navigation clavier, le menu mobile, le zoom et les annonces avec un lecteur d’écran.

## Contenus et anciennes adresses

Les collections typées dans `src/content.config.ts` conservent les 85 articles migrés, 16 fiches espèces, 6 formations, 47 ressources documentaires, 15 questions fréquentes, 116 termes de glossaire et 92 entrées d’annuaire. Les [inventaires WordPress](docs/migration-wordpress.md) et [actualités](docs/migration-actualites.md) décrivent la migration historique, pas l’arborescence future.

Les composants partagés et les templates de lecture sont publics. Les contenus se modifient dans le dépôt par branche et pull request, sans éditeur sur le site.

`src/lib/routes.mjs` associe les adresses historiques aux destinations principales de la refonte. Les templates et liens structurés utilisent ces adresses canoniques ; les anciennes URL génèrent une redirection HTML avec lien de secours et `noindex, follow`. Le plugin `src/lib/markdown-links.mjs`, exécuté avec le processeur officiel `@astrojs/markdown-remark`, adapte également les liens et médias Markdown historiques à la base de publication et aux adresses canoniques. Les trois anciennes URL à emoji sont générées par Astro pour fonctionner à la racine comme sous `/site-web/`. Articles, archives, documents publics et flux restent disponibles.

La compacité équilibrée approuvée conserve les textes d’action à 18 px et les cibles d’au moins 44 px. Les contrôles sur 1280 × 800 placent tous les choix des dossiers au-dessus de la ligne de flottaison ; sur 1440 × 900, le bloc suivant commence dans le premier écran. Ces mesures portent sur la version de revue, pas sur toutes les tailles de fenêtre possibles.

Une fiche formation est l’unique dossier d’information et d’inscription : Mes démarches → Se former renvoie à son ancre d’inscription, sans recopier le catalogue. Les documents sont également rattachés aux pages concernées (prélèvements, permis, pertes, gestion, formations, sanitaire). L’index Ressources, accessible dans le pied de page, complète ces parcours.

## Vérifications éditoriales avant publication

Les contenus historiques sont préservés sans être présentés comme une validation réglementaire nouvelle. Les pages affichent les limites lorsqu’une destination ou une procédure reste inconnue.

| Sujet | État |
| --- | --- |
| Inscription au permis | Portail de l’Office français de la biodiversité conservé depuis un article migré ; répond lors de la vérification. |
| Validation du permis | Portail national conservé depuis une actualité migrée ; ne pas réutiliser l’ancien lien OAuth éphémère. |
| Espaces externes | Les deux adresses répondent ; l’accès adhérent redirige vers le domaine de l’autre accès. Faire confirmer les rôles par la Fédération. |
| DECLADOM | Présentation officielle accessible ; destination directe de déclaration encore à confirmer. |
| Dégâts de grand gibier | Canal, pièces et conditions à confirmer ; aucune promesse d’indemnisation. |
| Perte de permis ou d’arme | Orientations et documents conservés ; modalités détaillées à confirmer avant publication. |
| Formations | Tarifs et informations historiques signalés ; absence de dates confirmées ne signifie pas absence de sessions. |
| Dates de chasse | Repères généraux 2026-2027 recoupés le 1 novembre 2026 avec la Fédération ; consulter les arrêtés et modifications. |
| Coordonnées, horaires, annuaires et autres liens | Faire confirmer leur actualité avant publication. |

## Référencement et mesure d’audience

Le site génère `sitemap.xml`, `robots.txt` et `feed.xml` sous la base configurée. Les articles conservent canonique, OpenGraph et données `NewsArticle` ; les pages de redirection ne sont pas indexées.

La configuration Umami existante est conservée dans `src/content/site.json > analytics`. Mettre `enabled: false` pour désactiver le suivi. Si activé, seul le script officiel `https://cloud.umami.is/script.js` est chargé avec `defer` et `data-do-not-track="true"`. Le Website ID est public ; ne pas ajouter de clé API ou de secret. Le build refuse une activation avec un identifiant invalide. Faire confirmer les obligations de confidentialité applicables avant publication.

## Publication

Le site reste compatible avec le déploiement statique existant. Pour Cloudflare Pages : commande `npm run build`, sortie `dist`, Node.js 22.12 ou plus récent, `ASTRO_SITE=https://fdc85.maury.app` et `ASTRO_BASE_PATH=/`. Pour la compatibilité GitHub Pages par défaut : `https://federationchassevendee.github.io/site-web/`.

Les previews de branche Cloudflare sont indépendantes de Pages CMS ; aucun workflow d’édition n’est requis. Le domaine et l’état réel du projet Cloudflare restent à vérifier dans le service de déploiement. Ne pas fusionner ni publier sans accord explicite.
