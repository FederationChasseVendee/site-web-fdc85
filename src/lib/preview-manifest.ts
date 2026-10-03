import { readFileSync } from "node:fs";
import { getCollection } from "astro:content";
import { parse } from "yaml";
import { getTemplateEntries, titleForEntry } from "./content";
import { buildIdentity } from "./preview-identity.mjs";
import { cmsUrl, indexContains, isRecord, PRODUCTION_URL, REPOSITORY, sitePath } from "./preview.mjs";

interface CmsCollection {
  name: string;
  label: string;
  type: "file" | "collection";
  path: string;
}

interface PreviewContent {
  id: string;
  title: string;
  collection: string;
  label: string;
  file: string;
  editorUrl: string | null;
  pages: Array<{ title: string; path: string }>;
  note: string;
}

function cmsCollections(): CmsCollection[] {
  const config: unknown = parse(readFileSync(".pages.yml", "utf8"));
  if (!isRecord(config) || !Array.isArray(config.content)) throw new Error("Configuration Pages CMS absente.");
  return config.content.map((item: unknown) => {
    if (!isRecord(item) || typeof item.name !== "string" || typeof item.label !== "string"
      || typeof item.path !== "string" || (item.type !== "file" && item.type !== "collection")) {
      throw new Error("Collection Pages CMS invalide pour la prévisualisation.");
    }
    return { name: item.name, label: item.label, type: item.type, path: item.path };
  });
}

export async function getPreviewManifest(base: string) {
  const collections = cmsCollections();
  const templates = await getTemplateEntries();
  const indexes = templates.filter((item) => item.template === "index");
  const contents: PreviewContent[] = [];
  for (const collection of collections) {
    if (collection.type === "file") {
      if (!["home", "site"].includes(collection.name)) throw new Error(`Fichier CMS sans route : ${collection.name}`);
      contents.push({
        id: collection.name, title: collection.label, collection: collection.name, label: collection.label,
        file: collection.path, editorUrl: buildIdentity.branch ? cmsUrl(buildIdentity.branch, collection) : null,
        pages: [{ title: "Accueil", path: sitePath(base, "") }],
        note: collection.name === "site" ? "Réglages partagés par toutes les pages : menu, pied de page et identité." : "",
      });
      continue;
    }
    // File paths come from Astro's loader, not guessed from normalized IDs.
    const collectionName = ([
      "standardPages", "crossroads", "articles", "species", "trainings", "indexes",
      "documents", "faqs", "glossary", "directories", "redirects",
    ] as const).find((name) => name === collection.name);
    if (!collectionName) throw new Error(`Collection CMS inconnue : ${collection.name}`);
    const entries = await getCollection(collectionName);
    for (const entry of entries) {
      if (!entry.filePath) throw new Error(`Chemin source absent : ${collection.name}/${entry.id}`);
      const file = entry.filePath.replace(/\\/g, "/").replace(/^.*?src\/content\//, "src/content/");
      if (!file.startsWith(`${collection.path}/`)) throw new Error(`Chemin CMS incohérent : ${file}`);
      const template = templates.find((item) => item.entry.collection === collection.name && item.entry.id === entry.id);
      const title = template ? titleForEntry(template) : "question" in entry.data ? entry.data.question
        : "term" in entry.data ? entry.data.term : "name" in entry.data ? entry.data.name
        : "title" in entry.data ? entry.data.title : entry.id;
      const pages = template ? [{ title: "Page du site", path: sitePath(base, `${template.slug}/`) }]
        : indexes.filter((item) => indexContains(item.entry.data, collection.name, {
          category: "category" in entry.data ? entry.data.category : undefined,
        }))
          .map((item) => ({ title: item.entry.data.title, path: sitePath(base, `${item.slug}/`) }));
      if (collection.name === "articles") {
        pages.push({ title: "Accueil et actualités importantes", path: sitePath(base, "") });
        pages.push({ title: "Actualités", path: sitePath(base, "actualites/") });
        pages.push({ title: "Archives", path: sitePath(base, "actualites/archives/") });
      }
      contents.push({
        id: file, title, collection: collection.name, label: collection.label, file,
        editorUrl: buildIdentity.branch ? cmsUrl(buildIdentity.branch, collection, file) : null,
        pages, note: collection.name === "redirects" ? "Ancienne adresse : le site redirige vers sa destination."
          : !template ? "Ressource partagée : choisissez une page qui l’affiche. Les documents peuvent aussi être liés ailleurs."
          : "",
      });
    }
  }
  return {
    schemaVersion: 1, repository: REPOSITORY, productionUrl: PRODUCTION_URL, base, build: buildIdentity,
    collections: collections.map((collection) => ({
      name: collection.name, label: collection.label,
      editorUrl: buildIdentity.branch ? cmsUrl(buildIdentity.branch, collection) : null,
    })),
    contents,
  };
}

export type PreviewManifest = Awaited<ReturnType<typeof getPreviewManifest>>;
