# Consignes pour la refonte FDC 85

## Sources de décision

- Lire `PRODUCT.md` pour le périmètre et les contraintes confirmés.
- Lire `docs/refonte/personas-et-navigation.md` pour les personas, les parcours, le regroupement des contenus et les propositions à valider.
- Les documents de migration décrivent l'existant ; ils ne prescrivent pas le futur site.
- Distinguer explicitement une décision confirmée, une proposition et un point à vérifier.
- Actualiser ces documents lorsqu'une décision est validée. Ne pas créer une autorité concurrente.

## Étape actuelle : cadrage

Ne pas supprimer le code, les contenus, `.pages.yml` ou les accès existants pendant cette étape. Ne pas transformer une proposition d'arborescence en navigation publiée sans validation.

La demande de copie propre concerne la prochaine implémentation. Celle-ci devra retirer l'édition et l'administration du site, mais préserver les accès aux inscriptions, validations et espaces adhérents externes.

## Principes UX

- Partir d'une action ou d'une question réelle du visiteur.
- Distinguer « Passer mon permis », « Valider mon permis » et les formations des chasseurs déjà titulaires.
- Regrouper toutes les démarches dans « Mes démarches », y compris passer le permis et se former. Les autres rubriques informent et renvoient aux mêmes pages de démarche, sans deuxième parcours d'inscription.
- Dans « Devenir chasseur », donner directement accès à « Passer mon permis » et « Valider mon permis en Vendée » : ce sont des liens vers les démarches existantes, pas des copies.
- Sous « Se connecter à mon espace », distinguer « Espace adhérent » (chasseurs et responsables de territoire) et « Espace maître d'équipage ». Préserver les deux accès externes et vérifier leurs destinations avant publication.
- Conserver les huit entrées demandées et les distinctions dégâts grand gibier / DECLADOM et perte de permis / perte d'arme. Ne pas promettre une indemnisation ni inventer de procédure de déclaration ; vérifier les modalités officielles avant publication.
- Donner à chaque contenu une destination principale et autoriser des raccourcis depuis d'autres parcours ; ne pas dupliquer les pages.
- Rattacher documents, formulaires et tutoriels au sujet concerné. Un index transversal peut compléter les parcours, jamais les remplacer.
- Garder l'aide et le contact accessibles sans recherche complexe.
- Écrire les sigles en toutes lettres à la première occurrence. Employer le nom d'un outil externe en complément de l'action, pas comme seul libellé.
- Ne pas imposer un choix de persona avant l'accès au site.

## Contenu et accessibilité

Ne pas inventer de règles, de tarifs, de dates, de témoignages ni de services. Revérifier les informations saisonnières et les liens externes avant publication. Signaler ce qui est ancien, indisponible ou encore à confirmer.

La moyenne d'âge élevée appelle une lecture confortable, des liens explicites, des cibles faciles à activer, un focus visible, un usage au clavier et un zoom sans perte d'information. Ne pas réserver les menus au survol et ne pas cacher tout le menu derrière un bouton sur grand écran.

## Direction visuelle

Aucune direction artistique n'est encore validée. La référence FDC 41 concerne surtout l'ordre « accès rapides, puis actualités ». Ne pas copier son graphisme ni considérer les couleurs actuelles comme imposées.

Cette étape produit un brief lisible, pas du code UI ni une maquette finale. Établir la direction visuelle avec la cliente avant de créer `DESIGN.md`.

## Travail dans le dépôt

Respecter `.github/copilot-instructions.md` : branche dédiée, commit et pull request pour chaque modification ; aucune fusion sans accord explicite.

Pour du code, utiliser les commandes existantes de `package.json` et les contrôles les plus ciblés couvrant le changement. Les modifications documentaires seules ne nécessitent pas de build.
