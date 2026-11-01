import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const linkSchema = z.object({
  label: z.string().min(1),
  url: z.string().min(1),
});

const imageSchema = z.object({
  src: z.string().min(1),
  alt: z.string().default(""),
  decorative: z.boolean().default(false),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
}).refine((image) => image.decorative || image.alt.trim().length > 0, {
  message: "Renseignez le texte alternatif ou indiquez que l’image est décorative.",
  path: ["alt"],
});

const heroSchema = imageSchema.optional();

const documentSchema = linkSchema.extend({
  type: z.string().default("Document"),
  size: z.string().optional(),
});

const ctaSchema = z.object({
  title: z.string().min(1),
  text: z.string().optional(),
  action: linkSchema,
});

const navigationSchema = z.object({
  show: z.boolean().default(false),
  label: z.string().optional(),
  order: z.number().int().min(1).max(999).default(100),
});

const pageBaseSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  intro: z.string().min(1),
  hero: heroSchema,
  navigation: navigationSchema.default({ show: false, order: 100 }),
});

const standardPages = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/standard-pages" }),
  schema: pageBaseSchema.extend({
    documents: z.array(documentSchema).default([]),
    links: z.array(linkSchema).default([]),
    cta: ctaSchema.optional(),
  }),
});

const crossroads = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/crossroads" }),
  schema: pageBaseSchema.extend({
    cards: z.array(z.object({
      title: z.string().min(1),
      text: z.string().min(1),
      url: z.string().min(1),
    })).default([]),
    childrenFrom: z.enum(["articles", "species", "trainings", "indexes"]).optional(),
  }).refine((page) => page.cards.length > 0 || page.childrenFrom, {
    message: "Ajoutez au moins une carte ou choisissez une collection enfant.",
    path: ["cards"],
  }),
});

const articles = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/articles" }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    date: z.coerce.date(),
    category: z.enum(["Chasse", "Environnement", "Fédération", "Alertes"]),
    summary: z.string().min(1),
    image: imageSchema.optional(),
    documents: z.array(documentSchema).default([]),
    expiresAt: z.coerce.date().optional(),
    archived: z.boolean().default(false),
  }),
});

const species = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/species" }),
  schema: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    category: z.string().min(1),
    image: imageSchema,
    identification: z.string().min(1),
    habitat: z.string().min(1),
    diet: z.string().min(1),
    reproduction: z.string().min(1),
    distribution: z.string().min(1),
    statusAndThreats: z.string().min(1),
    gallery: z.array(imageSchema).default([]),
  }),
});

const trainings = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/trainings" }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    summary: z.string().min(1),
    objectives: z.array(z.string().min(1)).min(1),
    audience: z.string().min(1),
    prerequisites: z.string().default("Aucun prérequis"),
    program: z.array(z.string().min(1)).min(1),
    duration: z.string().min(1),
    location: z.string().min(1),
    price: z.string().min(1),
    dates: z.array(z.object({
      date: z.coerce.date(),
      endDate: z.coerce.date().optional(),
      note: z.string().optional(),
    })).default([]),
    documents: z.array(documentSchema).default([]),
    registrationUrl: z.string().min(1),
  }),
});

const indexes = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/indexes" }),
  schema: pageBaseSchema.extend({
    source: z.enum(["articles", "species", "trainings", "documents", "faqs", "glossary", "directories"]),
    display: z.enum(["list", "cards"]).default("cards"),
    category: z.string().optional(),
    emptyMessage: z.string().default("Aucun contenu n’est disponible pour le moment."),
    links: z.array(linkSchema).default([]),
  }),
});

const documents = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/documents" }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    category: z.string().min(1),
    file: z.string().min(1),
    fileType: z.string().default("Document"),
    fileSize: z.string().optional(),
    updatedAt: z.coerce.date().optional(),
  }),
});

const faqs = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/faqs" }),
  schema: z.object({
    question: z.string().min(1),
    answer: z.string().min(1),
    category: z.string().default("Général"),
    order: z.number().int().default(100),
  }),
});

const glossary = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/glossary" }),
  schema: z.object({
    term: z.string().min(1),
    definition: z.string().min(1),
  }),
});

const directories = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/directories" }),
  schema: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    category: z.string().min(1),
    role: z.string().optional(),
    order: z.number().int().default(100),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.email().optional(),
    website: z.string().optional(),
  }),
});

const redirects = defineCollection({
  loader: glob({
    pattern: "**/*.md",
    base: "./src/content/redirects",
    generateId: ({ entry }) => entry.replace(/\.md$/, ""),
  }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    destination: z.string().min(1),
  }),
});

export const collections = {
  standardPages,
  crossroads,
  articles,
  species,
  trainings,
  indexes,
  documents,
  faqs,
  glossary,
  directories,
  redirects,
};
