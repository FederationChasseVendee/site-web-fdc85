import { z } from "zod";

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

export const standardPagesSchema = pageBaseSchema.extend({
    documents: z.array(documentSchema).default([]),
    links: z.array(linkSchema).default([]),
    cta: ctaSchema.optional(),
});

export const crossroadsSchema = pageBaseSchema.extend({
    cards: z.array(z.object({
      title: z.string().min(1),
      text: z.string().min(1),
      url: z.string().min(1),
    })).default([]),
    childrenFrom: z.enum(["articles", "species", "trainings", "indexes"]).optional(),
  }).refine((page) => page.cards.length > 0 || page.childrenFrom, {
    message: "Ajoutez au moins une carte ou choisissez une collection enfant.",
    path: ["cards"],
  });

export const articlesSchema = z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    date: z.coerce.date(),
    category: z.enum(["Chasse", "Environnement", "Fédération", "Alertes"]),
    summary: z.string().min(1),
    image: imageSchema.optional(),
    documents: z.array(documentSchema).default([]),
    expiresAt: z.coerce.date().optional(),
    archived: z.boolean().default(false),
});

export const speciesSchema = z.object({
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
});

export const trainingsSchema = z.object({
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
});

export const indexesSchema = pageBaseSchema.extend({
    source: z.enum(["articles", "species", "trainings", "documents", "faqs", "glossary", "directories"]),
    display: z.enum(["list", "cards"]).default("cards"),
    category: z.string().optional(),
    emptyMessage: z.string().default("Aucun contenu n’est disponible pour le moment."),
    links: z.array(linkSchema).default([]),
});

export const documentsSchema = z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    category: z.string().min(1),
    file: z.string().min(1),
    fileType: z.string().default("Document"),
    fileSize: z.string().optional(),
    updatedAt: z.coerce.date().optional(),
});

export const faqsSchema = z.object({
    question: z.string().min(1),
    answer: z.string().min(1),
    category: z.string().default("Général"),
    order: z.number().int().default(100),
});

export const glossarySchema = z.object({
    term: z.string().min(1),
    definition: z.string().min(1),
});

export const directoriesSchema = z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    category: z.string().min(1),
    role: z.string().optional(),
    order: z.number().int().default(100),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.email().optional(),
    website: z.string().optional(),
});

export const redirectsSchema = z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    destination: z.string().min(1),
});

export const contentSchemas = {
  standardPages: standardPagesSchema,
  crossroads: crossroadsSchema,
  articles: articlesSchema,
  species: speciesSchema,
  trainings: trainingsSchema,
  indexes: indexesSchema,
  documents: documentsSchema,
  faqs: faqsSchema,
  glossary: glossarySchema,
  directories: directoriesSchema,
  redirects: redirectsSchema,
};
