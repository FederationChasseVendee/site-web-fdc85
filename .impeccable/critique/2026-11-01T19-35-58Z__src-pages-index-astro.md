---
target: "Accueil : tout semble énorme, rendre plus compact"
total_score: 24
max_score: 36
na_heuristics: 9
p0_count: 0
p1_count: 1
timestamp: 2026-11-01T19-35-58Z
slug: src-pages-index-astro
---
Method: dual-agent (A: a0f02d69-b2e9-4ef2-8e25-4803131565bb · B: 31b1dc7f-1c78-4cb0-874a-c86eee1a9ec1)

## Verdict

**Oui : compacter la composition, pas miniaturiser les textes.** À 1440 × 900, l’en-tête et l’introduction prennent environ **406 px, soit 45 % du premier écran**. Les huit actions principales sont visibles, mais pas tous leurs sous-choix ; les actualités restent très loin en dessous. Sur un écran plus petit, certaines actions sortent du premier écran.

La piste « dossiers ouverts » fonctionne : elle regroupe des actions concrètes et distingue les sujets sensibles. Le grand slogan et les espacements ont cependant plus de poids que les démarches.

## Santé du design

| Heuristique | Note /4 | Point principal |
| --- | --- | --- |
| Visibilité de l’état | 3 | Navigation courante explicite |
| Correspondance au monde réel | 3 | Verbes utiles, slogan abstrait |
| Contrôle et liberté | 3 | Menu visible, flèches ambiguës |
| Cohérence | 2 | Flèches et styles de liens différents |
| Prévention des erreurs | 3 | Distinctions dégâts/pertes/espaces conservées |
| Reconnaissance | 3 | Actions nommées et regroupées |
| Efficacité | 2 | Trop de défilement sur portable |
| Minimalisme | 2 | Bandeau et répétitions coûteux |
| Récupération d’erreur | n/a | Accueil sans saisie ni formulaire |
| Aide | 3 | Nous contacter accessible |
| **Total** | **24/36** | **Clair, mais insuffisamment compact** |

## Ce qui fonctionne

- Trois dossiers reconnaissables, sans imposer un choix de persona.
- Les huit actions et les distinctions importantes sont explicites.
- Texte courant de 18 px et cibles généreuses : un socle à préserver pour le confort de lecture.

## Trois priorités

**[P1] Réduire le haut de page.** L’en-tête mesure 129 px et le bandeau 277 px. Proposition : un en-tête autour de 80–96 px sur grand écran, un titre de 40–44 px plutôt que 65 px, et moins de hauteur de bandeau. Gain visé : **100–140 px**, sans supprimer les six rubriques. Commande adaptée : `/impeccable layout`.

**[P2] Compacter les dossiers.** Les sous-titres génériques et les quatre sous-liens placés en bloc sous les déclarations allongent fortement le dossier central. Rattacher chaque paire à sa ligne (grand gibier/DECLADOM, permis/arme), utiliser deux colonnes pour les sous-liens quand la largeur le permet, réduire les paddings et les décalages entre dossiers. **Conserver les deux espaces et toutes les distinctions visibles**, pas les masquer derrière un accordéon. Commande adaptée : `/impeccable distill`.

**[P2] Rétablir une hiérarchie de liens.** La flèche ↗ évoque un départ externe alors que ces actions ouvrent des pages internes. Utiliser → pour les parcours internes ; réserver ↗ aux services externes. Les répétitions de liens peuvent aider, mais elles ne doivent pas prendre autant de place que l’action principale. Commande adaptée : `/impeccable clarify`.

**Objectif proposé, à vérifier après modification :** les huit actions et leurs distinctions visibles à 1280 × 800 ; le début du bloc suivant visible à 1440 × 900. Garder le texte des actions à 18 px et les cibles à au moins 44 px.

## Charge cognitive et profils

La charge vient surtout du dossier central : quatre actions, puis quatre sous-liens séparés. Les groupes réduisent l’effort de repérage, mais les répétitions recréent un second niveau de décision. Le menu à six rubriques est une contrainte confirmée : le réduire n’est pas la solution.

**Chasseur habitué :** doit parfois défiler pour une perte ou son espace ; le bandeau ne l’aide pas à agir. **Débutant :** le bouton de validation dans l’en-tête pèse plus que « Passer mon permis ». **Lecteur avec zoom :** bénéficie davantage d’un bandeau raccourci que d’un texte plus petit.

L’arrivée est calme et rassurante ; le creux du parcours est le défilement nécessaire pour retrouver une action stressante comme une perte. La fin de page répète plusieurs destinations déjà présentées.

## Éléments techniques et limites

Le scan statique trouve **0 anomalie**. Le scan navigateur rapporte 11 signaux sur grand écran et 18 sur mobile, mais sa liste détaillée est incomplète : ce n’est pas un audit d’accessibilité. Le signal de couleur dans le bandeau est un faux positif (contraste mesuré 9,6:1) ; le plus faible contraste principal mesuré est 4,62:1. Les outils navigateur natifs des sous-agents étaient indisponibles ; les mesures ont été prises dans Edge headless à des tailles fixées, pas dans la fenêtre réelle de l’utilisateur. **Aucun overlay n’est visible dans votre navigateur.**

L’orientation reste provisoire, sans identité cliente validée. Aucun compactage n’a encore été appliqué.

## Question de conception

La meilleure prochaine étape est une compacité équilibrée : réduire le bandeau et les répétitions tout en conservant le confort de lecture. Chercher à rendre tout l’accueil visible en un écran imposerait une réduction excessive.
