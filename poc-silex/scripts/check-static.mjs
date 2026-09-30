import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const exportRoot = join(projectRoot, "export");
const sourceRoot = join(projectRoot, "source");
const websiteRoot = join(sourceRoot, "fdc85-silex-poc");

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(existsSync(sourceRoot), "Le dossier source Silex v3 est absent.");
assert(existsSync(join(websiteRoot, "website.json")), "La source Silex doit contenir website.json.");
assert(existsSync(join(websiteRoot, "meta.json")), "La source Silex doit contenir meta.json.");

const metadata = JSON.parse(readFileSync(join(websiteRoot, "meta.json"), "utf8"));
const website = JSON.parse(readFileSync(join(websiteRoot, "website.json"), "utf8"));
assert(metadata.name && metadata.connectorUserSettings, "meta.json ne respecte pas le contrat Silex v3.");
assert(website.pagesFolder === "pages", "Le dossier de pages Silex doit être pages.");
assert(website.pages.length === 2, "La source Silex doit référencer exactement deux pages.");
assert(website.assets.length === 2, "La source Silex doit enregistrer les deux médias locaux.");
for (const asset of website.assets) {
  assert(asset.type === "image" && asset.src.startsWith("/assets/"), `Média Silex invalide : ${asset.name}`);
  assert(existsSync(join(websiteRoot, asset.src.replace(/^\/+/, ""))), `Média source absent : ${asset.src}`);
}
for (const page of website.pages) {
  const filename = `${page.name}-${page.id}.json`;
  const pagePath = join(websiteRoot, website.pagesFolder, filename);
  assert(page.isFile === true, `La page ${page.name} doit être stockée dans un fichier distinct.`);
  assert(existsSync(pagePath), `Le fichier de page Silex est absent : ${filename}`);
  const pageData = JSON.parse(readFileSync(pagePath, "utf8"));
  assert(pageData.id === page.id && pageData.name === page.name, `Les identifiants de ${filename} ne correspondent pas à website.json.`);
  assert(Array.isArray(pageData.frames) && pageData.frames.length > 0, `${filename} ne contient aucune frame GrapesJS.`);
}

const htmlFiles = walk(exportRoot).filter((file) => extname(file) === ".html");
assert(htmlFiles.length === 2, `Deux pages HTML exportées sont attendues (trouvé : ${htmlFiles.length}).`);

for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  const displayPath = relative(projectRoot, file);
  assert(/<html\s+lang="fr">/.test(html), `${displayPath} doit déclarer lang="fr".`);
  assert(/<meta\s+name="viewport"/.test(html), `${displayPath} doit contenir la meta viewport.`);
  assert(/<meta\s+name="description"/.test(html), `${displayPath} doit contenir une description SEO.`);
  assert(/<meta\s+name="robots"\s+content="noindex, nofollow">/.test(html), `${displayPath} doit rester noindex.`);
  assert((html.match(/<h1(?:\s|>)/g) ?? []).length === 1, `${displayPath} doit contenir exactement un h1.`);
  assert(html.includes('href="#contenu"') && html.includes('<main id="contenu">'), `${displayPath} doit contenir le lien d’évitement et la zone principale.`);
  assert(!/(?:href|src)="\/(?!\/)/.test(html), `${displayPath} contient un chemin racine incompatible avec un sous-chemin.`);
  assert(!html.includes("\uFFFD"), `${displayPath} contient un caractère Unicode de remplacement.`);

  for (const image of html.matchAll(/<img\b[^>]*>/g)) {
    assert(/\salt="[^"]*"/.test(image[0]), `${displayPath} contient une image sans attribut alt.`);
  }

  for (const attribute of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const target = attribute[1];
    if (/^(?:https?:|mailto:|tel:|#)/.test(target)) continue;
    const cleanTarget = target.replace(/[?#].*$/, "");
    const localTarget = resolve(file, "..", cleanTarget);
    assert(existsSync(localTarget), `${displayPath} référence une cible locale absente : ${target}`);
  }
}

const css = readFileSync(join(exportRoot, "css", "site.css"), "utf8");
assert(css.includes(":focus-visible"), "Le style de focus visible est absent.");
assert(css.includes("@media (max-width:"), "La mise en page responsive est absente.");
assert(css.includes("prefers-reduced-motion"), "La préférence de réduction des animations n’est pas respectée.");

console.log("POC Silex vérifié : 2 pages, liens et assets locaux valides, chemins relatifs, repères d’accessibilité et responsive présents.");
