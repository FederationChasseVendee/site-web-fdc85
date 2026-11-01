import { getCollection, type CollectionEntry } from "astro:content";
import { normalizeSlug } from "./slug.mjs";
export { normalizeSlug } from "./slug.mjs";

export type TemplateEntry =
  | { template: "standard"; entry: CollectionEntry<"standardPages"> }
  | { template: "crossroads"; entry: CollectionEntry<"crossroads"> }
  | { template: "article"; entry: CollectionEntry<"articles"> }
  | { template: "species"; entry: CollectionEntry<"species"> }
  | { template: "training"; entry: CollectionEntry<"trainings"> }
  | { template: "index"; entry: CollectionEntry<"indexes"> }
  | { template: "redirect"; entry: CollectionEntry<"redirects"> };

const reservedSlugs = new Set(["404", "index", "admin"]);

export async function getTemplateEntries(): Promise<Array<TemplateEntry & { slug: string }>> {
  const [standardPages, crossroads, articles, species, trainings, indexes, redirects] = await Promise.all([
    getCollection("standardPages"),
    getCollection("crossroads"),
    getCollection("articles"),
    getCollection("species"),
    getCollection("trainings"),
    getCollection("indexes"),
    getCollection("redirects"),
  ]);

  const entries: TemplateEntry[] = [
    ...standardPages.map((entry) => ({ template: "standard" as const, entry })),
    ...crossroads.map((entry) => ({ template: "crossroads" as const, entry })),
    ...articles.map((entry) => ({ template: "article" as const, entry })),
    ...species.map((entry) => ({ template: "species" as const, entry })),
    ...trainings.map((entry) => ({ template: "training" as const, entry })),
    ...indexes.map((entry) => ({ template: "index" as const, entry })),
    ...redirects.map((entry) => ({ template: "redirect" as const, entry })),
  ];
  const seen = new Set<string>();

  return entries.map((item) => {
    const slug = normalizeSlug(item.entry.id);
    if (!slug || slug.split("/").some((segment) => reservedSlugs.has(segment))) {
      throw new Error(`Le fichier "${item.entry.id}" utilise un segment d’URL réservé.`);
    }
    if (seen.has(slug)) {
      throw new Error(`Plusieurs contenus produisent l’URL "/${slug}/".`);
    }
    seen.add(slug);
    return { ...item, slug };
  });
}

export function titleForEntry(item: TemplateEntry): string {
  return item.template === "species" ? item.entry.data.name : item.entry.data.title;
}

export function descriptionForEntry(item: TemplateEntry): string {
  return item.entry.data.description;
}
