import { execFileSync } from "node:child_process";
import { getCollection, type CollectionEntry } from "astro:content";
import { getTemplateEntries, titleForEntry } from "./content";
import { getArticlesByStatus, pageCount } from "./news";
import { normalizeBase, REPOSITORY, type AdminContent, type AdminManifest, type AdminRoute } from "./admin";

const labels = {
  standardPages: "Pages standard", crossroads: "Pages carrefour", articles: "Articles",
  species: "Fiches espèces", trainings: "Formations", indexes: "Index et listes",
  documents: "Documents", faqs: "Questions fréquentes", glossary: "Glossaire",
  directories: "Annuaires", redirects: "Redirections",
};

function sourcePath(entry: CollectionEntry<keyof typeof labels>): string {
  if (!entry.filePath) throw new Error(`Chemin source absent pour ${entry.collection}/${entry.id}.`);
  const path = entry.filePath.replace(/\\/g, "/");
  const start = path.indexOf("src/content/");
  if (start < 0) throw new Error(`Chemin source inattendu : ${path}.`);
  return path.slice(start);
}

export async function getAdminManifest(): Promise<AdminManifest> {
  const entries = await getTemplateEntries();
  const routes: AdminRoute[] = [{ path: "", label: "Accueil", contentId: "home" }];
  const contents: AdminContent[] = [
    { id: "home", label: "Accueil", collection: "home", kind: "file", path: "src/content/home.json", routes: [""], impact: "La page d’accueil." },
    { id: "site", label: "Paramètres du site", collection: "site", kind: "file", path: "src/content/site.json", routes: [""], impact: "Tout le site : navigation, pied de page et paramètres communs." },
    { id: "media", label: "Médiathèque · images et PDF", collection: "default", kind: "media", path: "public/assets", routes: [""], impact: "Les pages utilisant ces médias. Les fichiers sont stockés dans public/assets ; les liens publics commencent par /assets/." },
    ...Object.entries(labels).map(([collection, label]): AdminContent => ({
      id: `collection:${collection}`, label: `Tous les contenus · ${label}`, collection,
      kind: "collection", routes: [], impact: "Créer, renommer ou retrouver un contenu dans Pages CMS. Les nouveaux contenus apparaissent ici après compilation.",
    })),
  ];
  for (const item of entries) {
    const id = `${item.entry.collection}:${item.entry.id}`;
    const path = `${item.slug}/`;
    routes.push({ path, label: titleForEntry(item), contentId: id });
    contents.push({
      id, label: titleForEntry(item), collection: item.entry.collection,
      kind: "entry", path: sourcePath(item.entry), routes: [path],
      impact: item.template === "redirect" ? `Redirection vers ${item.entry.data.destination}.` : `Page /${path}. Les listes associées sont également mises à jour à la compilation.`,
    });
  }
  for (const archived of [false, true]) {
    const root = archived ? "actualites/archives/" : "actualites/";
    const title = archived ? "Archives des actualités" : "Actualités";
    const articles = await getArticlesByStatus(archived);
    for (let page = 1; page <= pageCount(articles); page += 1) {
      const path = page === 1 ? root : `${root}page/${page}/`;
      routes.push({ path, label: `${title}${page > 1 ? ` · page ${page}` : ""}`, contentId: "collection:articles" });
    }
  }
  const [documents, faqs, glossary, directories] = await Promise.all([
    getCollection("documents"), getCollection("faqs"), getCollection("glossary"), getCollection("directories"),
  ]);
  for (const entry of [...documents, ...faqs, ...glossary, ...directories]) {
    const affected = entries.filter((item) => {
      if (item.template === "index" && item.entry.data.source === entry.collection) {
        const category = item.entry.data.category;
        if (!category || entry.collection === "faqs" || entry.collection === "glossary") return true;
        if (entry.collection === "directories") return entry.data.category.toLocaleLowerCase("fr").includes(category.toLocaleLowerCase("fr"));
        return entry.collection === "documents" && entry.data.category === category;
      }
      if (entry.collection !== "documents") return false;
      const data = item.entry.data;
      return ("documents" in data && data.documents.some((document) => document.url === entry.data.file))
        || Boolean(item.entry.body?.includes(entry.data.file));
    }).map((item) => `${item.slug}/`);
    const label = entry.collection === "faqs" ? entry.data.question
      : entry.collection === "glossary" ? entry.data.term
      : entry.collection === "directories" ? entry.data.name : entry.data.title;
    contents.push({
      id: `${entry.collection}:${entry.id}`, label, collection: entry.collection,
      kind: "entry", path: sourcePath(entry), routes: affected,
      impact: affected.length ? `Donnée affichée dans ${affected.length} page(s) compilée(s), selon les filtres des index et les références documentaires.` : "Donnée sans page propre ni index correspondant. Choisissez une autre page pour examiner le site.",
    });
  }
  for (const collection of Object.keys(labels)) {
    const group = contents.find((content) => content.id === `collection:${collection}`)!;
    group.routes = [...new Set(contents.filter((content) => content.collection === collection && content.kind === "entry").flatMap((content) => content.routes))];
    if (collection === "articles") group.routes.unshift("actualites/", "actualites/archives/");
  }
  const cloudflare = Boolean(process.env.CF_PAGES_BRANCH && process.env.CF_PAGES_COMMIT_SHA);
  const git = (args: string[]) => execFileSync("git", args, { encoding: "utf8" }).trim();
  return {
    repository: REPOSITORY,
    branch: process.env.CF_PAGES_BRANCH || git(["branch", "--show-current"]),
    commit: process.env.CF_PAGES_COMMIT_SHA || git(["rev-parse", "HEAD"]),
    buildTime: new Date().toISOString(),
    deployment: process.env.CF_PAGES_URL ? new URL(process.env.CF_PAGES_URL).origin : null,
    base: normalizeBase(import.meta.env.BASE_URL),
    source: cloudflare ? "cloudflare" : "git",
    contents,
    routes: routes.sort((a, b) => a.label.localeCompare(b.label, "fr")),
  };
}
