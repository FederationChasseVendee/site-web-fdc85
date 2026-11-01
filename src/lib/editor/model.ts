import { parse, stringify } from "yaml";
import { z } from "zod";
import type home from "../../content/home.json";
import { contentSchemas } from "../content-schemas";
import { renderMarkdown, safeUrl } from "./markdown";
import { getUmamiConfig } from "../umami.mjs";

export interface Field {
  name: string;
  label?: string;
  description?: string;
  type: string;
  required?: boolean;
  default?: unknown;
  list?: boolean | { min?: number; max?: number };
  fields?: Field[];
  options?: { values?: Array<{ value: string; label: string }>; clearable?: boolean };
}

export interface Collection {
  name: string;
  label: string;
  type: "file" | "collection";
  path: string;
  format: "json" | "yaml-frontmatter";
  fields: Field[];
}

export interface SourceEntry {
  path: string;
  collection: string;
  slug: string;
  label: string;
  source: string;
}

export type Draft = Record<string, unknown>;
type Data<K extends keyof typeof contentSchemas> = z.infer<(typeof contentSchemas)[K]>;
export type RenderEntry = {
  [K in keyof typeof contentSchemas]: { collection: K; slug: string; data: Data<K>; body: string }
}[keyof typeof contentSchemas] | { collection: "home"; slug: ""; data: typeof home; body: string };

export interface RenderContext {
  base: string;
  siteUrl: string;
  now: string;
  entries: RenderEntry[];
}

export interface Catalog {
  collections: Collection[];
  entries: SourceEntry[];
  images: string[];
  branch: string;
  commit: string;
  builtAt: string;
  base: string;
  siteUrl: string;
}

export const fieldSchema: z.ZodType<Field> = z.lazy(() => z.object({
  name: z.string(), label: z.string().optional(), description: z.string().optional(),
  type: z.string(), required: z.boolean().optional(), default: z.unknown().optional(),
  list: z.union([z.boolean(), z.object({ min: z.number().optional(), max: z.number().optional() })]).optional(),
  fields: z.array(fieldSchema).optional(),
  options: z.object({
    values: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
    clearable: z.boolean().optional(),
  }).optional(),
}));

export const collectionSchema = z.object({
  name: z.string(), label: z.string(), type: z.enum(["file", "collection"]),
  path: z.string(), format: z.enum(["json", "yaml-frontmatter"]),
  fields: z.array(fieldSchema),
});

export const catalogSchema = z.object({
  collections: z.array(collectionSchema).min(1),
  entries: z.array(z.object({
    path: z.string(), collection: z.string(), slug: z.string(), label: z.string(), source: z.string(),
  })).min(1),
  images: z.array(z.string()), branch: z.string().min(1), commit: z.string().min(1),
  builtAt: z.iso.datetime(), base: z.string().regex(/^\/(?:.*\/)?$/), siteUrl: z.url(),
});

const homeSchema = z.object({
  seo: z.object({ title: z.string().min(1), description: z.string().min(1) }),
  hero: z.object({
    eyebrow: z.string().min(1), title: z.string().min(1), text: z.string().min(1),
    image: z.string().min(1), imageAlt: z.string().min(1),
  }),
  tasks: z.object({
    title: z.string().min(1), intro: z.string().min(1),
    items: z.array(z.object({ title: z.string().min(1), text: z.string().min(1), url: z.string().min(1) })),
  }),
  news: z.object({
    title: z.string().min(1), intro: z.string().min(1),
    action: z.object({ label: z.string().min(1), url: z.string().min(1) }),
  }),
  institution: z.object({
    title: z.string().min(1), text: z.string().min(1),
    action: z.object({ label: z.string().min(1), url: z.string().min(1) }),
  }),
});

const object = (value: unknown): Draft => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Le contenu doit être un objet JSON ou YAML.");
  }
  return z.record(z.string(), z.unknown()).parse(value);
};

export function parseSource(source: string, format: Collection["format"]): Draft {
  if (format === "json") return object(JSON.parse(source));
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) throw new Error("En-tête YAML manquant ou incomplet.");
  return { ...object(parse(match[1], { maxAliasCount: 0 })), body: match[2] };
}

export function exportSource(draft: Draft, format: Collection["format"]): string {
  if (format === "json") return `${JSON.stringify(draft, null, 2)}\n`;
  const { body, ...frontmatter } = draft;
  return `---\n${stringify(frontmatter, { lineWidth: 0 })}---\n${typeof body === "string" ? body : ""}`;
}

export function parseRenderEntry(entry: SourceEntry, draft: Draft): RenderEntry | undefined {
  const body = typeof draft.body === "string" ? draft.body : "";
  const slug = entry.slug;
  switch (entry.collection) {
    case "home": return { collection: "home", slug: "", data: homeSchema.parse(draft), body };
    case "standardPages": return { collection: "standardPages", slug, data: contentSchemas.standardPages.parse(draft), body };
    case "articles": return { collection: "articles", slug, data: contentSchemas.articles.parse(draft), body };
    case "crossroads": return { collection: "crossroads", slug, data: contentSchemas.crossroads.parse(draft), body };
    case "species": return { collection: "species", slug, data: contentSchemas.species.parse(draft), body };
    case "trainings": return { collection: "trainings", slug, data: contentSchemas.trainings.parse(draft), body };
    case "indexes": return { collection: "indexes", slug, data: contentSchemas.indexes.parse(draft), body };
    case "documents": return { collection: "documents", slug, data: contentSchemas.documents.parse(draft), body };
    case "faqs": return { collection: "faqs", slug, data: contentSchemas.faqs.parse(draft), body };
    case "glossary": return { collection: "glossary", slug, data: contentSchemas.glossary.parse(draft), body };
    case "directories": return { collection: "directories", slug, data: contentSchemas.directories.parse(draft), body };
    case "redirects": return { collection: "redirects", slug, data: contentSchemas.redirects.parse(draft), body };
    case "site": getUmamiConfig(draft.analytics); return undefined;
    default: throw new Error(`Collection non prise en charge : ${entry.collection}`);
  }
}

export function validateFields(fields: Field[], draft: Draft, prefix = ""): string[] {
  return fields.flatMap((field) => {
    const value = draft[field.name];
    const label = `${prefix}${field.label ?? field.name}`;
    if (value === undefined || value === null || value === "") {
      return field.required ? [`${label} : champ obligatoire.`] : [];
    }
    if (field.list) {
      if (!Array.isArray(value)) return [`${label} : liste attendue.`];
      const bounds = typeof field.list === "object" ? field.list : {};
      const errors = [];
      if (bounds.min !== undefined && value.length < bounds.min) errors.push(`${label} : au moins ${bounds.min} éléments.`);
      if (bounds.max !== undefined && value.length > bounds.max) errors.push(`${label} : au plus ${bounds.max} éléments.`);
      return [...errors, ...value.flatMap((item, index) =>
        validateFields([{ ...field, list: false }], { [field.name]: item }, `${label} ${index + 1} > `))];
    }
    if (field.type === "object") return validateFields(field.fields ?? [], object(value), `${label} > `);
    if (field.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) return [`${label} : nombre valide attendu.`];
    if (field.type === "boolean" && typeof value !== "boolean") return [`${label} : oui ou non attendu.`];
    if (field.type !== "number" && field.type !== "boolean" && typeof value !== "string") return [`${label} : texte attendu.`];
    if (field.type === "select" && !field.options?.values?.some((option) => option.value === value)) return [`${label} : choix non autorisé.`];
    if (field.type === "rich-text" && typeof value === "string" && /<h1(?:\s|>)/.test(renderMarkdown(value, "/"))) {
      return [`${label} : utilisez des titres de niveau 2 (##) ou inférieur. Le titre principal de la page est déjà défini.`];
    }
    if (typeof value === "string" && (field.type === "image" || ["url", "file", "registrationUrl", "website", "phoneUrl"].includes(field.name))) {
      if (!safeUrl(value, "/") || (field.type === "image" && /^(mailto:|tel:)/i.test(value))) return [`${label} : adresse non autorisée. Utilisez une adresse interne ou HTTPS.`];
    }
    return [];
  });
}

export function initialValue(field: Field): unknown {
  if (field.default !== undefined) return structuredClone(field.default);
  if (field.list) return [];
  if (field.type === "object") return Object.fromEntries((field.fields ?? [])
    .filter((child) => child.required || child.default !== undefined)
    .map((child) => [child.name, initialValue(child)]));
  if (field.type === "boolean") return false;
  return "";
}

export function isDirty(initial: Draft, current: Draft): boolean {
  return JSON.stringify(initial) !== JSON.stringify(current);
}

export function cmsUrl(entry: SourceEntry, branch: string): string {
  const root = `https://app.pagescms.org/FederationChasseVendee/site-web-fdc85/${encodeURIComponent(branch)}`;
  return entry.collection === "home" || entry.collection === "site"
    ? `${root}/file/${encodeURIComponent(entry.collection)}`
    : `${root}/collection/${encodeURIComponent(entry.collection)}/edit/${encodeURIComponent(entry.path)}`;
}

export function errorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => `${issue.path.join(".")} : ${issue.message}`).join("\n");
  }
  return error instanceof Error ? error.message : String(error);
}

export const persistence = Object.freeze({
  available: false,
  message: "Mode brouillon local : aucune écriture dans GitHub ou Pages CMS. Exporter ne publie pas. Ouvrir Pages CMS ne lui transfère pas votre brouillon.",
});
