# Produit — FDC 85

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Publics demandés pour le cadrage :

- Les chasseurs qui veulent effectuer leurs démarches et accéder aux formations.
- Les personnes qui souhaitent devenir chasseurs : comprendre le parcours, passer le permis, le valider puis découvrir la pratique en Vendée.
- Les personnels administratifs qui cherchent des informations sur la Fédération. Leur contexte exact reste à préciser ; le cadrage propose le cas d'un agent de collectivité ou d'un organisme partenaire.

La moyenne d'âge du public est élevée, selon le brief client. Cela impose une attention à la lisibilité et au repérage, sans présumer du niveau numérique de chaque visiteur.

Autres publics proposés, non encore validés : responsables d'associations ou de territoires de chasse, agriculteurs et propriétaires concernés par les dégâts, enseignants et visiteurs intéressés par la nature.

## Product Purpose

Le site de la Fédération Départementale des Chasseurs de la Vendée informe ses visiteurs et les oriente vers les démarches et formations qui les concernent.

La refonte doit partir des besoins des visiteurs, et non de l'organisation interne des services. La première étape est le cadrage des personas, des parcours et de la navigation.

L'utilisateur demande de regrouper toutes les démarches dans « Mes démarches », pour les distinguer du reste du site consacré à la prise d'information. Les mêmes liens peuvent aussi être proposés dans les rubriques d'information, sans dupliquer les pages : « Devenir chasseur » doit notamment donner accès à « Passer mon permis » et « Valider mon permis en Vendée ».

## Operating Context

Le dépôt contient déjà un site Astro statique, du contenu migré de WordPress, des ressources documentaires, des annuaires et des liens vers des services externes.

Le futur site doit rester statique. L'utilisateur a confirmé que les inscriptions, validations et autres services externes sont conservés : le site explique puis oriente ; il ne remplace pas les services authentifiés.

## Capabilities and Constraints

- Repartir d'un code propre lors de l'implémentation de la refonte.
- Récupérer le contenu utile du site existant, sans considérer son classement ou ses composants comme des décisions à conserver.
- Retirer les fonctionnalités d'édition et l'administration du site lors de cette implémentation.
- Ne pas confondre suppression de l'édition du site et suppression des accès aux espaces adhérents externes.
- Pendant le cadrage, conserver le site actuel intact.
- « Mes démarches » doit donner accès à : passer le permis, le valider, se former, déclarer ses prélèvements, une arme, un dégât ou une perte, et « Se connecter à mon espace ».
- Sous « Se connecter à mon espace », distinguer « Espace adhérent » pour les chasseurs et responsables de territoire et « Espace maître d'équipage ». Le site actuel indique deux services externes distincts, à revérifier avant publication.
- Pour les dégâts, distinguer grand gibier et DECLADOM (non indemnisable, selon la demande utilisateur) ; pour les pertes, distinguer permis et arme. Les modalités et l'éligibilité restent à vérifier auprès des sources officielles avant publication.
- Placer les coordonnées, dont le numéro de téléphone, dans le pied de page commun et sur une page « Nous contacter », pas dans l'en-tête ni dans le contenu principal de l'accueil. Le pied de page reste présent sur l'accueil.
- Ne pas inventer de dates, tarifs, conditions d'inscription, obligations réglementaires ou disponibilités de formation.
- Le framework et le dispositif de publication de la future copie propre ne sont pas encore arrêtés.

## Brand Commitments

Conserver l'identité de l'organisme : Fédération Départementale des Chasseurs de la Vendée, FDC 85.

La cliente apprécie l'accueil de <https://fdc41.com/>, en particulier la succession accès rapides puis actualités. Cette référence porte sur la hiérarchie de l'accueil ; elle ne constitue pas une demande de copie graphique.

Palette, typographie, traitement des images et direction artistique restent ouverts.

## Evidence on Hand

- Brief utilisateur et confirmation de la conservation des services externes.
- PDF fourni « Mon premier tableau » : proposition d'arborescence, pas décision validée.
- `src/content/` : contenu existant à auditer avant réutilisation.
- `src/content/site.json` : identité et paramètres actuels, à revérifier avant publication.
- `docs/migration-wordpress.md` et `docs/migration-actualites.md` : inventaires historiques, pas arborescence cible.
- Le cadrage proposé et ses sources figurent dans `docs/refonte/personas-et-navigation.md`.

## Product Principles

1. Permettre au visiteur de reconnaître son action sans connaître les termes internes de la Fédération.
2. Distinguer obtenir le permis, valider le permis et se former.
3. Expliquer un service externe avant de demander au visiteur de l'ouvrir.
4. Classer les documents par besoin plutôt que par format de fichier.
5. Regrouper les démarches et distinguer leur accès des rubriques d'information et des actualités datées.

## Accessibility & Inclusion

Prévoir une navigation explicite, un vocabulaire courant, une lecture confortable et une aide humaine accessible. L'âge ne doit ni enfermer les visiteurs dans un persona « senior », ni justifier une interface infantilisante.

Le socle actuel vise WCAG 2.2 AA. La refonte doit préserver cette ambition ; les contrôles automatiques ne constituent pas une certification.
