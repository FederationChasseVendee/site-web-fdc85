import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";

const hasConfiguredBase = process.env.ASTRO_BASE_PATH !== undefined;
const configuredBase = process.env.ASTRO_BASE_PATH?.replace(/^\/+|\/+$/g, "");
const base = hasConfiguredBase ? (configuredBase ? `/${configuredBase}/` : "/") : "/site-web/";
const siteUrl = process.env.ASTRO_SITE ?? "https://federationchassevendee.github.io";
const siteRoot = new URL(base, `${siteUrl.replace(/\/+$/, "")}/`).href;
const absoluteRoot = siteRoot.endsWith("/") ? siteRoot : `${siteRoot}/`;
const basePath = new URL(base, `${siteUrl.replace(/\/+$/, "")}/`).pathname;
const legacyCanonicalRoot = "https://federationchassevendee.github.io/site-web/";
const basePathPattern = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const internalAttributePattern = new RegExp(`(?:href|src)="(${basePathPattern}[^"]*)"`, "g");
const navigationLinkPattern = new RegExp(`href="(${basePathPattern}[^"#?]*)"`, "g");
const distDirectory = "dist";
const site = JSON.parse(readFileSync("src/content/site.json", "utf8"));
const newsMigration = JSON.parse(readFileSync("docs/migration-actualites.json", "utf8"));
const cloudflareRedirects = readFileSync("public/_redirects", "utf8");
const rewritesLegacyBaseAtRoot = /^\/site-web\/\*\s+\/:splat\s+301$/m.test(cloudflareRedirects);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function targetFor(url) {
  const rawPathname = new URL(url, siteRoot).pathname;
  const pathname = basePath === "/" && rewritesLegacyBaseAtRoot && rawPathname.startsWith("/site-web/")
    ? rawPathname.replace(/^\/site-web\//, "/")
    : rawPathname;
  const withoutBase = pathname.startsWith(basePath)
    ? pathname.slice(basePath.length)
    : pathname.replace(/^\/+/, "");
  if (!withoutBase) return join(distDirectory, "index.html");
  return withoutBase.endsWith("/")
    ? join(distDirectory, withoutBase, "index.html")
    : join(distDirectory, withoutBase);
}

const htmlFiles = walk(distDirectory).filter((file) => extname(file) === ".html");
const routeFiles = htmlFiles.filter((file) => !file.endsWith("404.html"));
const documentFiles = walk(join(distDirectory, "assets", "documents"))
  .filter((file) => extname(file).toLowerCase() === ".pdf");

for (const htmlFile of htmlFiles) {
  const html = readFileSync(htmlFile, "utf8");
  const displayPath = relative(distDirectory, htmlFile);
  const h1Count = (html.match(/<h1(?:\s|>)/g) ?? []).length;

  if (!html.includes('href="#contenu"') || !html.includes('<main id="contenu">')) {
    throw new Error(`Lien d’évitement ou zone principale absent dans ${displayPath}`);
  }
  if (h1Count !== 1) {
    throw new Error(`${displayPath} doit contenir exactement un titre h1 (trouvé : ${h1Count}).`);
  }
  if (html.includes("\uFFFD")) {
    throw new Error(`Caractère de remplacement Unicode détecté dans ${displayPath}.`);
  }
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  if (!canonical?.startsWith(absoluteRoot) && !canonical?.startsWith(legacyCanonicalRoot)) {
    throw new Error(`URL canonique absente ou hors de ${absoluteRoot} dans ${displayPath}.`);
  }

  for (const image of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\salt="[^"]*"/.test(image[0])) {
      throw new Error(`Image sans attribut alt dans ${displayPath}`);
    }
  }

  for (const match of html.matchAll(internalAttributePattern)) {
    const target = targetFor(match[1]);
    if (!existsSync(target)) {
      throw new Error(`Cible locale absente dans ${displayPath} : ${match[1]}`);
    }
  }

  for (const anchor of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>.*?<\/a>/gs)) {
    if (!/\srel="[^"]*noreferrer[^"]*"/.test(anchor[0]) || !anchor[0].includes("nouvel onglet")) {
      throw new Error(`Lien externe non annoncé ou sans rel=noreferrer dans ${displayPath}`);
    }
  }
}

for (const file of documentFiles) {
  if (readFileSync(file).subarray(0, 4).toString("ascii") !== "%PDF") {
    throw new Error(`Le document ${relative(distDirectory, file)} n’est pas un PDF valide.`);
  }
}

const redirectDirectory = join("src", "content", "redirects");
const redirectFiles = walk(redirectDirectory).filter((file) => extname(file) === ".md");
const unicodeRedirects = [
  "📢-securite-et-chasse-une-convention-renforcee-avec-la-gendarmerie",
  "🟢-ouverture-des-validations-du-permis-de-chasser-2026-2027-🟢",
  "🕊️-tourterelle-des-bois-ouverture-dimanche-30-aout",
];
for (const file of redirectFiles) {
  const source = readFileSync(file, "utf8");
  const destination = source.match(/^destination:\s*(.+)$/m)?.[1]?.trim();
  if (!destination) {
    throw new Error(`Destination absente dans ${file}.`);
  }

  for (const route of unicodeRedirects) {
    const html = readFileSync(join(distDirectory, route, "index.html"), "utf8");
    if (!html.includes('<meta name="robots" content="noindex, follow">')
      || (!html.includes(`<link rel="canonical" href="${absoluteRoot}`)
        && !html.includes(`<link rel="canonical" href="${legacyCanonicalRoot}`))) {
      throw new Error(`Redirection Unicode incomplète pour /${route}/.`);
    }
  }

  const route = relative(redirectDirectory, file).replace(/\\/g, "/").replace(/\.md$/, "");
  const html = readFileSync(join(distDirectory, ...route.split("/"), "index.html"), "utf8");
  const resolvedDestination = `${base}${destination.replace(/^\/+/, "")}`;
  const canonicalDestination = new URL(resolvedDestination, siteUrl).href;

  if (!html.includes(`content="0; url=${resolvedDestination}"`)) {
    throw new Error(`Redirection HTML absente ou incorrecte pour /${route}/.`);
  }
  if (!html.includes(`rel="canonical" href="${canonicalDestination}"`)) {
    throw new Error(`URL canonique incorrecte pour /${route}/.`);
  }
  if (!html.includes(`href="${resolvedDestination}"`)) {
    throw new Error(`Lien de secours visible absent pour /${route}/.`);
  }
  if (!html.includes('<meta name="robots" content="noindex, follow">')) {
    throw new Error(`Directive noindex absente pour la redirection /${route}/.`);
  }
}

if (newsMigration.sitemapUrlCount !== 86 || newsMigration.articleCount !== 85
  || newsMigration.importedCount !== 85 || newsMigration.errorCount !== 0) {
  throw new Error("Le rapport de migration doit confirmer 86 URL, 85 articles importés et aucune erreur.");
}

const articleSources = walk(join("src", "content", "articles")).filter((file) => extname(file) === ".md");
if (articleSources.length < 85) {
  throw new Error(`La collection Articles doit conserver les 85 migrations (trouvé : ${articleSources.length}).`);
}

for (const article of newsMigration.articles) {
  const route = article.file.replace(/^src\/content\/articles\//, "").replace(/\.md$/, "");
  if (!existsSync(join(distDirectory, ...route.split("/"), "index.html"))) {
    throw new Error(`Route d’article absente pour ${article.source} : /${route}/.`);
  }
}

for (const xmlFile of ["sitemap.xml", "feed.xml"]) {
  const xml = readFileSync(join(distDirectory, xmlFile), "utf8");
  if (!xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>') || xml.includes("\uFFFD")) {
    throw new Error(`${xmlFile} n’est pas un document XML UTF-8 exploitable.`);
  }
}

const sitemap = readFileSync(join(distDirectory, "sitemap.xml"), "utf8");
for (const article of newsMigration.articles) {
  const route = article.file.replace(/^src\/content\/articles\//, "").replace(/\.md$/, "");
  const url = `${absoluteRoot}${route}/`;
  if (!sitemap.includes(`<loc>${url}</loc>`)) {
    throw new Error(`Article absent du sitemap : ${url}`);
  }
}
if (sitemap.includes("📢") || sitemap.includes("🟢") || sitemap.includes("🕊")) {
  throw new Error("Les pages de redirection ne doivent pas être indexées dans le sitemap.");
}

const robots = readFileSync(join(distDirectory, "robots.txt"), "utf8");
if (!robots.includes(`Allow: ${new URL(base, siteUrl).pathname}`)
  || !robots.includes(`Sitemap: ${new URL("sitemap.xml", absoluteRoot).href}`)) {
  throw new Error("robots.txt ne référence pas correctement la base de production et le sitemap.");
}

const homeHtml = readFileSync(join(distDirectory, "index.html"), "utf8");
const navigationBlocks = [...homeHtml.matchAll(/<nav[^>]*aria-label="Navigation principale"[^>]*>(.*?)<\/nav>/gs)];
if (navigationBlocks.length !== 2) {
  throw new Error("Les navigations principale mobile et bureau n’ont pas été trouvées.");
}

const expectedNavigation = site.navigation.map(({ url }) => `${base}${url}`);
for (const [, navigationHtml] of navigationBlocks) {
  const links = [...navigationHtml.matchAll(navigationLinkPattern)].map((match) => match[1]);
  if (links.length !== 6 || expectedNavigation.some((href) => !links.includes(href))) {
    throw new Error("La navigation principale doit contenir exactement les six rubriques configurées.");
  }
}

for (const action of site.primaryActions) {
  const href = /^https?:|^mailto:|^tel:/.test(action.url) ? action.url : `${base}${action.url}`;
  if (!homeHtml.includes(`href="${href}"`)) {
    throw new Error(`Action prioritaire absente de l’accueil : ${action.label}`);
  }
}

if (!homeHtml.includes(`href="${base}" aria-label="${site.shortName} — Accueil"`)) {
  throw new Error("Le logo ne fournit pas de retour explicite vers l’accueil.");
}

for (const htmlFile of routeFiles) {
  if (htmlFile.endsWith(join(distDirectory, "index.html"))) continue;
  const html = readFileSync(htmlFile, "utf8");
  if (!html.includes('aria-label="Fil d’Ariane"')) {
    throw new Error(`Fil d’Ariane absent dans ${relative(distDirectory, htmlFile)}`);
  }
}

console.log(
  `${routeFiles.length} routes, 85 articles, ${redirectFiles.length + unicodeRedirects.length} redirections, ${documentFiles.length} PDF, leurs liens, leurs médias, le sitemap, le flux et les repères d’accessibilité ont été vérifiés sous ${base}.`,
);
