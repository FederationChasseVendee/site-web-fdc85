/** @type {Record<string, string>} */
const destinations = {
  "permis-et-formations": "devenir-chasseur",
  "permis-et-formations/devenir-chasseur": "devenir-chasseur/comprendre-le-parcours",
  "permis-et-formations/passer-son-permis": "mes-demarches/passer-mon-permis",
  "permis-et-formations/formations": "formations",
  "chasser-en-vendee/validation-du-permis": "mes-demarches/valider-mon-permis",
  "chasser-en-vendee/espace-adherent": "mes-demarches/mon-espace",
  "chasser-en-vendee/decladom": "mes-demarches/declarer-un-degat/decladom",
  "nature-et-territoires/chassadapt": "mes-demarches/declarer-mes-prelevements",
};

/** @param {string} slug */
export function canonicalSlug(slug) {
  if (destinations[slug]) return destinations[slug];
  if (slug.startsWith("permis-et-formations/")) {
    const child = slug.slice("permis-et-formations/".length);
    return `${["chasse-accompagnee", "entrainement-examen"].includes(child) ? "devenir-chasseur" : "formations"}/${child}`;
  }

  if (slug === "nature-et-territoires" || slug.startsWith("nature-et-territoires/")) {
    return slug.replace("nature-et-territoires", "nature-et-biodiversite");
  }
  return slug;
}

/** @param {string} url @param {string} base */
export function resolvePublicUrl(url, base) {
  if (/^(https?:|mailto:|tel:|#|\/\/)/.test(url)) return url;
  const local = url.startsWith("/site-web/") ? url.slice("/site-web/".length) : url.replace(/^\/+/, "");
  const suffixIndex = local.search(/[?#]/);
  const path = suffixIndex < 0 ? local : local.slice(0, suffixIndex);
  const suffix = suffixIndex < 0 ? "" : local.slice(suffixIndex);
  const canonical = canonicalSlug(path.replace(/\/+$/, ""));
  const resolvedPath = `${base}${canonical}${path.endsWith("/") ? "/" : ""}`.replace(/\/{2,}/g, "/");
  return `${resolvedPath}${suffix}`;
}

export const procedures = [
  { title: "Passer mon permis", url: "mes-demarches/passer-mon-permis/", text: "Préparer l’examen et accéder à l’inscription.", group: "permit" },
  { title: "Valider mon permis", url: "mes-demarches/valider-mon-permis/", text: "Accéder au service de validation.", group: "permit" },
  { title: "Se former", url: "mes-demarches/se-former/", text: "Choisir une formation et trouver son inscription.", group: "permit" },
  { title: "Déclarer mes prélèvements", url: "mes-demarches/declarer-mes-prelevements/", text: "Carnet numérique et documents de suivi.", group: "report" },
  { title: "Déclarer une arme", url: "mes-demarches/declarer-une-arme/", text: "Système d’information sur les armes (SIA).", group: "report" },
  { title: "Déclarer un dégât", url: "mes-demarches/declarer-un-degat/", text: "Grand gibier ou autres dégâts — DECLADOM.", group: "report" },
  { title: "Déclarer une perte", url: "mes-demarches/declarer-une-perte/", text: "Perte de mon permis ou perte d’une arme.", group: "report" },
  { title: "Se connecter à mon espace", url: "mes-demarches/mon-espace/", text: "Accès unique au portail RETRIEVER.", group: "space" },
];
