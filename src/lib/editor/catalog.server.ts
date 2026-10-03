import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { execFileSync } from "node:child_process";
import { z } from "zod";
import { parse } from "yaml";
import type { Catalog, RenderContext } from "./model";
import { collectionSchema, parseRenderEntry, parseSource } from "./model";
import { normalizeSlug } from "../content";

const configSchema = z.object({
  content: z.array(collectionSchema),
});

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

let cached: Catalog | undefined;

export function getCatalog(): Catalog {
  if (cached) return cached;
  const config = configSchema.parse(parse(readFileSync(".pages.yml", "utf8")));
  const entries = config.content.flatMap((collection) => {
    const paths = collection.type === "file" ? [collection.path] : walk(collection.path).filter((path) => path.endsWith(".md"));
    return paths.map((path) => {
      const source = readFileSync(path, "utf8");
      const draft = parseSource(source, collection.format);
      const slug = collection.type === "file" ? "" : normalizeSlug(relative(collection.path, path));
      const label = [draft.title, draft.name, draft.question, draft.term].find((value) => typeof value === "string");
      return {
        path: path.replaceAll("\\", "/"), collection: collection.name, slug,
        source, label: typeof label === "string" ? label : collection.label,
      };
    });
  });
  cached = {
    collections: config.content, entries,
    images: walk("public/assets").filter((path) => /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(path))
      .map((path) => `/${relative("public", path).replaceAll("\\", "/")}`),
    branch: process.env.CF_PAGES_BRANCH ?? execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim(),
    commit: process.env.CF_PAGES_COMMIT_SHA ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    builtAt: new Date().toISOString(),
    base: import.meta.env.BASE_URL,
    siteUrl: process.env.ASTRO_SITE ?? (process.env.CF_PAGES === "1" || process.env.CF_PAGES_BRANCH ? "https://fdc85.maury.app" : "https://federationchassevendee.github.io"),
  };
  return cached;
}

let renderContext: RenderContext | undefined;

export function getRenderContext(): RenderContext {
  if (renderContext) return renderContext;
  const catalog = getCatalog();
  renderContext = {
    base: catalog.base, siteUrl: catalog.siteUrl, now: catalog.builtAt,
    entries: catalog.entries.flatMap((entry) => {
      const collection = catalog.collections.find((item) => item.name === entry.collection);
      if (!collection) throw new Error(`Schéma manquant : ${entry.collection}`);
      const parsed = parseRenderEntry(entry, parseSource(entry.source, collection.format));
      return parsed ? [parsed] : [];
    }),
  };
  return renderContext;
}
