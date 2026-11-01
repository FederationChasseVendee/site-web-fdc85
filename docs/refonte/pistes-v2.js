(function () {
  const concepts = [
    {
      id: "guichet",
      title: "Le guichet en ligne",
      short: "Un site de service : la navigation reste à gauche, les démarches sont classées comme dans un guichet.",
      palette: "Marine · blanc · ocre",
      navigation: "Six rubriques en colonne, toujours distinctes des actions.",
      composition: "Pas de grand bandeau : une liste de démarches occupe immédiatement l’essentiel de l’écran.",
      tradeoff: "Très direct ; l’identité paraît plus administrative.",
      layout: "v2-office"
    },
    {
      id: "journal",
      title: "Le journal vendéen",
      short: "Un accueil éditorial avec une vraie manchette, une photographie et un bandeau de démarches placé avant la une.",
      palette: "Papier clair · encre · rouge brique",
      navigation: "Menu horizontal sous la manchette, puis accès rapides en bandeau.",
      composition: "Les services ouvrent la page ; une grande photographie et les actualités prennent ensuite le relais.",
      tradeoff: "Chaleureux et vivant ; la une doit rester secondaire par rapport aux services.",
      layout: "v2-journal"
    },
    {
      id: "two-doors",
      title: "Deux portes d’entrée",
      short: "L’accueil se partage en deux : effectuer une démarche d’un côté, trouver une information de l’autre.",
      palette: "Vert profond · bleu pâle · jaune",
      navigation: "Les rubriques d’information forment un second volet, face aux démarches.",
      composition: "Deux grandes surfaces côte à côte, sans imposer de choisir un profil.",
      tradeoff: "La séparation est immédiate ; les deux volets doivent rester lisibles sur mobile.",
      layout: "v2-two-doors"
    },
    {
      id: "directory",
      title: "Le répertoire ouvert",
      short: "Une page sans image d’ambiance : les mots recherchés et leurs destinations composent l’identité.",
      palette: "Bleu encre · bleu pâle · blanc",
      navigation: "Barre de rubriques et index de liens textuels, avec descriptions courtes.",
      composition: "Une grande question, puis un répertoire à deux colonnes et des actualités en brèves.",
      tradeoff: "Très efficace pour chercher ; le résultat est volontairement plus sobre.",
      layout: "v2-directory"
    },
    {
      id: "subject-map",
      title: "La carte des sujets",
      short: "Les grandes rubriques composent une mosaïque ; les démarches restent regroupées dans un panneau voisin.",
      palette: "Bleu · abricot · jaune · sauge",
      navigation: "Six zones de tailles différentes, chacune nommée directement.",
      composition: "Carte de sujets à gauche, liste d’actions à droite, actualités ensuite.",
      tradeoff: "Expressif et mémorable ; l’ordre et le contraste des zones doivent rester évidents.",
      layout: "v2-map"
    },
    {
      id: "journey",
      title: "Les chemins du permis",
      short: "Un accueil qui montre les portes d’entrée du permis sans obliger les autres visiteurs à suivre un parcours.",
      palette: "Vert forêt · blanc · orange",
      navigation: "Menu horizontal, puis accès directs regroupés par intention.",
      composition: "Passer, valider et se former sont mis en regard ; déclarations et espaces restent accessibles à côté.",
      tradeoff: "Aide les nouveaux chasseurs ; les accès directs doivent rester aussi simples pour les autres.",
      layout: "v2-journey"
    },
    {
      id: "big-type",
      title: "L’affiche de territoire",
      short: "Une identité typographique affirmée : une affiche à gauche, les démarches en grand à droite.",
      palette: "Rouge profond · rose pâle · encre",
      navigation: "Rubriques en ligne ; les actions forment une colonne distincte.",
      composition: "Le nom du territoire devient le visuel principal, sans photographie ni illustration décorative.",
      tradeoff: "Identité forte ; le grand titre ne doit pas repousser les liens utiles.",
      layout: "v2-poster"
    },
    {
      id: "open-files",
      title: "Les dossiers ouverts",
      short: "Les démarches sont présentées comme trois dossiers déjà ouverts, plutôt que comme huit cartes identiques.",
      palette: "Prune · lilas · ivoire",
      navigation: "Menu complet en haut ; permis, déclarations et espaces sont visibles simultanément.",
      composition: "Trois groupes de profondeur et de largeur différentes exposent directement leurs liens.",
      tradeoff: "Le classement est explicite ; les dossiers doivent se réorganiser en pile sur mobile.",
      layout: "v2-folders"
    },
    {
      id: "photo-guide",
      title: "Le carnet photographique",
      short: "Une photographie verticale donne de la place au vivant ; les démarches occupent un panneau voisin.",
      palette: "Vert sombre · blanc · photographie",
      navigation: "Menu en haut ; image et liste de services se lisent côte à côte.",
      composition: "Un grand cadrage photographique contrebalance une liste d’actions très lisible.",
      tradeoff: "Plus incarné ; les photographies et leurs droits seront à valider avant publication.",
      layout: "v2-photo"
    },
    {
      id: "landscape",
      title: "Le grand paysage",
      short: "Un panorama vendéen fait entrer dans le territoire, suivi d’une grande étagère d’accès rapides.",
      palette: "Bleu nuit · sable · photographie",
      navigation: "Rubriques dans un bandeau stable ; accès rapides regroupés sous le paysage.",
      composition: "Photographie panoramique, bloc de titre décalé, puis liens d’action en deux rangées.",
      tradeoff: "Très immersif ; il faut préserver la visibilité des démarches dès le premier écran.",
      layout: "v2-landscape"
    }
  ];

  const navigation = [
    "Mes démarches",
    "Devenir chasseur",
    "Formations",
    "Chasser en Vendée",
    "Nature et biodiversité",
    "La Fédération"
  ];

  const tasks = [
    ["Passer mon permis", "Inscription et préparation"],
    ["Valider mon permis", "Première validation ou renouvellement"],
    ["Se former", "Choisir une formation"],
    ["Déclarer mes prélèvements", "Choisir l’outil adapté"],
    ["Déclarer une arme", "Accéder à la démarche officielle"],
    ["Déclarer un dégât", "Grand gibier · autres dégâts — DECLADOM"],
    ["Déclarer une perte", "Permis · arme"],
    ["Se connecter à mon espace", "Espace adhérent · espace maître d’équipage"]
  ];

  const photos = {
    roeDeer: "../../public/assets/articles/actions-terrain/federation-chasseurs-vendee-37-477055ed.webp",
    lagoon: "../../public/assets/articles/la-lagune-de-bouin-labellisee-ens/principale-f207db59.webp",
    stag: "../../public/assets/articles/actions-terrain/principale-5dcec20d.webp"
  };

  function brand(extra = "") {
    return `<div class="v2-brand ${extra}"><strong>FDC<span>85</span></strong><span>Fédération des chasseurs<br>de la Vendée</span></div>`;
  }

  function menu(className = "v2-nav", items = navigation) {
    return `<nav class="${className}" aria-label="Rubriques simulées">${items.map((item) => `<span>${item}</span>`).join("")}</nav>`;
  }

  function links(indexes, details = false) {
    return indexes.map((index) => {
      const [label, detail] = tasks[index];
      return `<div class="v2-task"><span><strong>${label}</strong>${details ? `<small>${detail}</small>` : ""}</span><span class="v2-arrow" aria-hidden="true">→</span></div>`;
    }).join("");
  }

  function news(className = "") {
    return `<section class="v2-news ${className}">
      <div class="v2-news-heading"><h4>Actualités</h4><span>Toutes les actualités →</span></div>
      <div class="v2-news-items">
        <article><span>La Fédération</span><strong>L’arrêté ESOD 2026-2029 est paru !</strong></article>
        <article><span>Nature et biodiversité</span><strong>J’aime la Nature Propre revient en 2026 !</strong></article>
      </div>
    </section>`;
  }

  function footer() {
    return `<footer class="v2-footer"><strong>Fédération des chasseurs de la Vendée</strong><span>Nous contacter · Coordonnées en pied de page · Mentions légales</span></footer>`;
  }

  const layouts = {
    "v2-office": () => `
      <div class="office-shell">
        <aside class="office-rail">${brand()}${menu("office-nav")}<div class="office-contact">Besoin d’aide ?<br><strong>Nous contacter →</strong></div></aside>
        <div class="office-main">
          <div class="office-top"><span>Accueil</span><span>Fédération des chasseurs de la Vendée</span></div>
          <div class="office-intro"><div><h3>Vos démarches,<br>sans détour.</h3><p>Tous les accès utiles, au même endroit.</p></div><div class="office-seal" aria-hidden="true">FDC<br><strong>85</strong></div></div>
          <section class="office-actions"><h4>Mes démarches</h4>
            <div class="office-columns"><div><h5>Permis et formation</h5>${links([0, 1, 2], true)}</div><div><h5>Déclarations et espaces</h5>${links([3, 4, 5, 6, 7], true)}</div></div>
          </section>
          ${news("office-news")}${footer()}
        </div>
      </div>`,

    "v2-journal": () => `
      <header class="journal-header">
        <div class="journal-meta"><span>Fédération des chasseurs de la Vendée</span><span>Nous contacter</span></div>
        <div class="journal-mast"><strong>La Vendée<br><i>grande nature.</i></strong><span>Le site de la<br>Fédération · FDC 85</span></div>
        ${menu("journal-nav")}
      </header>
      <section class="journal-services"><h4>Les démarches</h4><div>${links([0, 1, 2, 3, 4, 5, 6, 7])}</div></section>
      <section class="journal-lead"><div><h3>La chasse ici,<br>ensemble.</h3><p>Des repères pour pratiquer, comprendre et agir en Vendée.</p><span>Découvrir la Fédération →</span></div><img src="${photos.roeDeer}" alt="Chevreuil dans une prairie fleurie"></section>
      ${news("journal-news")}${footer()}`,

    "v2-two-doors": () => `
      <header class="doors-header">${brand()}<span>Nous contacter →</span></header>
      <div class="doors-layout">
        <section class="doors-actions"><p class="doors-label">Mes démarches</p><h3>J’ai quelque chose<br>à faire.</h3><p>Choisissez directement votre démarche.</p><div class="doors-list">${links([0, 1, 2, 3, 4, 5, 6, 7])}</div></section>
        <section class="doors-info"><p class="doors-label">S’informer</p><h3>Je cherche<br>à comprendre.</h3>${menu("doors-nav", navigation.slice(1))}
          <div class="doors-begin"><strong>Devenir chasseur</strong><span>Passer mon permis →</span><span>Valider mon permis en Vendée →</span></div>
        </section>
      </div>
      ${news("doors-news")}${footer()}`,

    "v2-directory": () => `
      <header class="directory-header">${brand()}${menu("directory-nav")}</header>
      <div class="directory-title"><div><h3>Que souhaitez-vous<br>faire ?</h3><p>Des démarches aux informations, trouvez les bons mots pour avancer.</p></div><strong aria-hidden="true">FDC<br>85.</strong></div>
      <div class="directory-layout"><section><h4>Mes démarches</h4><div class="directory-list">${links([0, 1, 2, 3, 4, 5, 6, 7], true)}</div></section>
        <aside><h4>Explorer le site</h4>${menu("directory-topics", navigation.slice(1))}<div class="directory-help">Une question ?<br><strong>Nous contacter →</strong></div></aside>
      </div>
      ${news("directory-news")}${footer()}`,

    "v2-map": () => `
      <header class="map-header">${brand()}<span>Actualités · Nous contacter</span></header>
      <div class="map-layout"><section class="map-topics"><h3>Explorez la Fédération.</h3><p>Choisissez un sujet pour trouver les informations qui vous intéressent.</p>
        <nav class="map-mosaic" aria-label="Rubriques simulées">${navigation.map((item, index) => `<span class="map-tile map-tile-${index}">${item}<b aria-hidden="true">↗</b></span>`).join("")}</nav>
      </section><section class="map-actions"><h4>Mes démarches</h4><p>Un accès direct pour chaque action.</p>${links([0, 1, 2, 3, 4, 5, 6, 7])}</section></div>
      ${news("map-news")}${footer()}`,

    "v2-journey": () => `
      <header class="journey-header">${brand()}${menu("journey-nav")}</header>
      <div class="journey-intro"><h3>Votre prochain pas,<br>à votre rythme.</h3><p>Commencer, poursuivre ou simplement accéder à une démarche : choisissez votre entrée.</p></div>
      <div class="journey-layout"><section class="journey-permit"><h4>Permis et formation</h4><div class="journey-path">${links([0, 1, 2], true)}</div><div class="journey-learn"><strong>Devenir chasseur</strong><span>Comprendre le parcours →</span><small>Passer mon permis · Valider mon permis en Vendée</small></div></section>
        <section class="journey-other"><h4>Déclarations et espaces</h4>${links([3, 4, 5, 6, 7], true)}</section>
      </div>
      ${news("journey-news")}${footer()}`,

    "v2-poster": () => `
      <header class="poster-header">${brand()}${menu("poster-nav")}</header>
      <div class="poster-layout"><div class="poster-title"><p>Fédération des chasseurs<br>de la Vendée</p><h3>LA<br>CHASSE<br>EN VENDÉE.</h3><div class="poster-stamp" aria-hidden="true">85</div><span>Pratiquer · Comprendre · Agir</span></div>
        <section class="poster-actions"><h4>Mes démarches</h4><p>Que souhaitez-vous faire ?</p>${links([0, 1, 2, 3, 4, 5, 6, 7])}</section>
      </div>
      ${news("poster-news")}${footer()}`,

    "v2-folders": () => `
      <header class="folders-header">${brand()}${menu("folders-nav")}</header>
      <div class="folders-title"><h3>Un dossier pour<br>chaque besoin.</h3><p>Les démarches sont ouvertes et classées par sujet.</p></div>
      <div class="folders-layout">
        <section class="folder folder-permit"><h4>Permis & formation</h4><p>Commencer ou poursuivre.</p>${links([0, 1, 2], true)}</section>
        <section class="folder folder-report"><h4>Déclarations</h4><p>Trouver la bonne procédure.</p>${links([3, 4, 5, 6], true)}</section>
        <section class="folder folder-space"><h4>Mon espace</h4><p>Choisir son accès.</p>${links([7], true)}<div class="folder-detail">Espace adhérent<br>Espace maître d’équipage</div></section>
      </div>
      ${news("folders-news")}${footer()}`,

    "v2-photo": () => `
      <header class="photo-header">${brand()}${menu("photo-nav")}</header>
      <div class="photo-layout"><figure class="photo-image"><img src="${photos.stag}" alt="Cerf dans un sous-bois"><figcaption>La faune et les milieux de Vendée</figcaption></figure>
        <section class="photo-actions"><h3>Une fédération<br>de terrain.</h3><p>Des démarches aux connaissances : tous vos repères en un lieu.</p><h4>Mes démarches</h4>${links([0, 1, 2, 3, 4, 5, 6, 7])}</section>
      </div>
      ${news("photo-news")}${footer()}`,

    "v2-landscape": () => `
      <header class="landscape-header">${brand()}${menu("landscape-nav")}</header>
      <section class="landscape-hero"><img src="${photos.lagoon}" alt="Vue aérienne de la lagune de Bouin"><div><h3>La Vendée,<br>un territoire vivant.</h3><p>Démarches, pratique et découverte : la Fédération à vos côtés.</p></div></section>
      <section class="landscape-actions"><div class="landscape-heading"><h4>Mes démarches</h4><span>Toutes les démarches →</span></div><div class="landscape-grid">${links([0, 1, 2, 3, 4, 5, 6, 7])}</div></section>
      <div class="landscape-explore"><strong>Découvrir la chasse en Vendée</strong><span>Devenir chasseur →</span><span>Nature et biodiversité →</span></div>
      ${news("landscape-news")}${footer()}`
  };

  function render(concept) {
    const layout = layouts[concept.layout];
    if (!layout) throw new Error(`Piste visuelle inconnue : ${concept.layout}`);
    return `<div class="site-preview v2-site" data-layout="${concept.layout}">${layout()}</div>`;
  }

  window.fdcVisualV2 = Object.freeze({ concepts, render });
}());
