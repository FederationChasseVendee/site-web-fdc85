import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { contentSchemas } from "./lib/content-schemas";

export const collections = {
  standardPages: defineCollection({ loader: glob({ pattern: "**/*.md", base: "./src/content/standard-pages" }), schema: contentSchemas.standardPages }),
  crossroads: defineCollection({ loader: glob({ pattern: "**/*.md", base: "./src/content/crossroads" }), schema: contentSchemas.crossroads }),
  articles: defineCollection({ loader: glob({ pattern: "**/*.md", base: "./src/content/articles" }), schema: contentSchemas.articles }),
  species: defineCollection({ loader: glob({ pattern: "**/*.md", base: "./src/content/species" }), schema: contentSchemas.species }),
  trainings: defineCollection({ loader: glob({ pattern: "**/*.md", base: "./src/content/trainings" }), schema: contentSchemas.trainings }),
  indexes: defineCollection({ loader: glob({ pattern: "**/*.md", base: "./src/content/indexes" }), schema: contentSchemas.indexes }),
  documents: defineCollection({ loader: glob({ pattern: "**/*.md", base: "./src/content/documents" }), schema: contentSchemas.documents }),
  faqs: defineCollection({ loader: glob({ pattern: "**/*.md", base: "./src/content/faqs" }), schema: contentSchemas.faqs }),
  glossary: defineCollection({ loader: glob({ pattern: "**/*.md", base: "./src/content/glossary" }), schema: contentSchemas.glossary }),
  directories: defineCollection({ loader: glob({ pattern: "**/*.md", base: "./src/content/directories" }), schema: contentSchemas.directories }),
  redirects: defineCollection({ loader: glob({ pattern: "**/*.md", base: "./src/content/redirects" }), schema: contentSchemas.redirects }),
};
