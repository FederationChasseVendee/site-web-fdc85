# Éditeur compagnon et aperçu des brouillons

## Ce qui fonctionne

`/editeur/` est une page statique du site, et non une iframe du Pages CMS hébergé.
Les champs français viennent directement de `.pages.yml`. Le catalogue contient les
fichiers publics de **la branche et du commit ayant construit ce déploiement**, pas une
lecture en temps réel de GitHub. `?fichier=src/content/standard-pages/contact.md` ouvre
un fichier connu ; aucun chemin arbitraire n’est lu.

Les sept modèles utilisent le même composant Preact en génération statique Astro et dans
l’aperçu : `src/components/rendering/SiteContent.tsx`. Les styles, l’en-tête et le pied de
page sont ceux du site réel, chargés depuis `/editeur/cadre/`. Le Markdown est traité
par le même pipeline Unified/Remark/Rehype des deux côtés : GFM, typographie, HTML
sanitisé, identifiants de titres et réécriture des liens/médias selon la base.

| Contenu | Aperçu |
| --- | --- |
| Accueil, standard, article, carrefour, espèce, formation, index | Modifications non enregistrées visibles à côté des champs |
| Documents, FAQ, glossaire, annuaire | Rendu dans un index de cette source ; choix de l’index disponible, filtres conservés |
| Redirections | Destination affichée, sans redirection automatique |
| Paramètres du site | Édition et export JSON ; pas d’aperçu des modifications de l’en-tête/pied de page ou des analytics |

Les listes permettent ajout, suppression et réordonnancement ; leurs bornes dans le
schéma sont respectées. Les blocs facultatifs peuvent être activés/désactivés. Les
valeurs non décrites par `.pages.yml` sont conservées dans l’export. Un type de champ
inconnu est signalé et non modifiable, jamais remplacé silencieusement.

Le contenu riche est un champ Markdown avec boutons de mise en forme et vraie zone de
texte accessible au clavier, pas un éditeur WYSIWYG. Les boutons de titre insèrent `##` :
le modèle possède déjà le titre principal `h1`. Les images utilisent les médias existants
ou une URL HTTPS ; aucun téléversement n’est réalisé. Une image inaccessible est signalée.

## Brouillon, export, dépôt et déploiement sont différents

Le bandeau et le bouton de publication désactivé indiquent explicitement :
**aucune sauvegarde dans GitHub ou Pages CMS depuis cet éditeur**.

1. Modifier : le rendu est actualisé après une courte temporisation, sans rechargement
   complet du cadre (la position de lecture est conservée).
2. Le brouillon est conservé dans le stockage local du navigateur, par branche et fichier.
   Si ce stockage est refusé, une erreur annonce le mode mémoire uniquement ; exporter
   avant de quitter. Le navigateur est partagé ? Les brouillons restent accessibles aux
   utilisateurs de ce profil. Ne pas y saisir de secrets.
3. Revenir : un brouillon retrouvé demande confirmation avant reprise. Si la source du
   dépôt a changé depuis, un avertissement explicite signale l’absence de fusion automatique.
4. **Exporter** : télécharger le vrai `.md` ou `.json` destiné au chemin affiché. Le fichier
   est réanalysé avec les schémas réellement utilisés par Astro avant téléchargement.
   L’état « non enregistré dans GitHub » reste affiché.
5. **Publier réellement** : ouvrir le lien authentifié de ce contenu dans Pages CMS et y
   reporter les champs, ou faire appliquer l’export au dépôt par un mainteneur. **Le lien
   ne transfère pas le brouillon**, même si Pages CMS est déjà connecté.
6. Pages CMS crée un commit. Attendre le contrôle Cloudflare Pages, puis ouvrir le nouveau
   déploiement pour voir son contenu. L’ancienne fenêtre d’éditeur reste un catalogue de
   son ancien build.

Changer de contenu avec un brouillon demande confirmation. Le dernier changement est
conservé avant la navigation, même avant la temporisation normale. Fermer/recharger
utilise la garde native du navigateur ; **Abandonner les modifications** demande
confirmation, supprime uniquement le brouillon de ce fichier/branche et rétablit le
contenu de ce déploiement. Annuler ces confirmations conserve le travail.

L’import lit un `.md` ou `.json` local (maximum 2 Mo), valide les champs et crée un
brouillon ; il ne publie rien. Création de fichier, renommage, suppression de contenu
et médiathèque restent des opérations de Pages CMS.

## Isolation et compatibilité du rendu

Le cadre est une iframe **du site lui-même**, isolée avec `sandbox="allow-same-origin"`
sans permission de script, formulaire, popup ou navigation de la fenêtre principale.
Les liens de l’aperçu sont désactivés ; un lien séparé compare avec la page déjà déployée.
Le Markdown actif (scripts, iframes, gestionnaires d’événements, URLs exécutables) est
neutralisé ; le JSON-LD du site publié échappe les chevrons. Ni éditeur ni cadre
n’exécutent Umami. Les scripts du cadre sont retirés, et la météo en direct est inactive.
Les aperçus mobile/tablette/bureau changent la largeur du vrai cadre, pas une simple
mise à l’échelle du texte.

Le passage de Sätteri à un pipeline Markdown partagé a une différence inspectée et
bornée dans la comparaison de référence : l’article
`levee-des-restrictions-sur-la-zone-reglementee-de-vaire-et-st-mathurin.md` contient des
délimiteurs `**` adjacents autour d’un emoji ; CommonMark place leurs astérisques
littéraux autrement. Les mots restent identiques. Les autres pages, liens, images,
alternatives, blocs optionnels, navigation et JSON-LD sont comparés à la référence
`cfe1b2a` après normalisation de la base. Le HTML actif non pris en charge est
intentionnellement exclu du rendu commun plutôt que simulé.

Les liens importés commençant par `/site-web/` et les médias sont normalisés dans le
rendu, sans modifier les sources. Trois redirections HTML historiques à slug emoji
sont rebasées uniquement dans `dist` à la fin du build. Sur Cloudflare (détection
`CF_PAGES`/`CF_PAGES_BRANCH`), la base par défaut est `/` et le domaine canonique
`https://fdc85.maury.app`. Les variables explicites restent prioritaires ; aucun réglage
Cloudflare partagé n’est modifié.

## Pourquoi ce n’est pas une extension du Pages CMS hébergé

Les [actions documentées](https://pagescms.org/docs/configuration/actions/) déclenchent
des workflows GitHub. Elles ne permettent pas d’injecter un panneau ou du code dans
l’éditeur hébergé. L’ancienne action de preview et son workflow ont été retirés.

Le [Pages CMS amont](https://github.com/pagescms/pagescms) est une application Next.js
avec PostgreSQL et GitHub App ; ses
[prérequis d’installation](https://pagescms.org/docs/guides/installing/) ne correspondent
pas au seul build statique Astro/Cloudflare Pages. Aucun fork, service supplémentaire,
PAT côté navigateur ou endpoint GitHub d’écriture n’est installé par cette variante.
Les liens utilisent les routes amont `/OWNER/REPO/BRANCH/file/NAME` et
`/OWNER/REPO/BRANCH/collection/NAME/edit/ENCODED_FULL_PATH`.

## Blocage exact d’une publication intégrée

La variante est utilisable sans aucun secret, mais **ne possède pas de backend de
publication configurable**. Aucun paramètre d’environnement ne peut activer une
fausse sauvegarde. Le Pages CMS hébergé ne fournit pas à cette page sa session ou ses
jetons, et aucune API de transfert de brouillon n’est supposée.

Une publication directement depuis cette interface nécessiterait une nouvelle phase,
avec autorisation de provisionner un backend OAuth/GitHub App et ses credentials.
Il manque actuellement l’application installée sur ce dépôt, l’ID/client secret et la
clé privée, les URLs de callback approuvées, un stockage serveur de sessions/jetons,
les secrets de chiffrement et la politique de branches/permissions.

Un backend acceptable doit conserver les jetons exclusivement côté serveur, utiliser
des cookies `HttpOnly`, `Secure`, `SameSite`, valider le state OAuth et la protection CSRF,
vérifier côté serveur les droits d’écriture sur **ce dépôt** à chaque opération,
limiter les chemins à `.pages.yml`, valider les schémas et détecter les conflits via le
SHA GitHub avant commit. Publication directe sur `main` et création de PR doivent faire
l’objet d’une décision explicite ; aucune protection ne doit dépendre seulement du
JavaScript client. Réutiliser Pages CMS auto-hébergé demanderait aussi PostgreSQL,
`DATABASE_URL`, `BETTER_AUTH_SECRET`, `CRYPTO_KEY` et les variables GitHub App décrites
par l’amont. Aucun de ces services ou secrets n’a été créé ou configuré ici.

## Vérification reproductible

Après le build, exécuter :

```bash
npm run test:editor
npm run test:rendering
npm run test:editor:browser
```

Les tests couvrent le round-trip de tous les contenus réels, les champs et blocs,
les URLs/base/échappements, la neutralisation du HTML, les sept modèles, les index,
les états sans publication, noindex et absence d’analytics. La fixture sémantique est
capturée à partir du build **avant refactorisation**, pas régénérée depuis le nouveau
rendu. Les tests Chromium vérifient édition non enregistrée, Markdown, images,
export, navigation annulée, reset, reprise après rechargement et largeur mobile.
`EDITOR_TEST_URL` permet de répéter ces tests sur une preview Cloudflare plutôt
que de lancer le serveur local.
