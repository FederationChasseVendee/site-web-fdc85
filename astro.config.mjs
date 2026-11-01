import { defineConfig } from "astro/config";
import { remarkLocalLinks } from "./src/lib/markdown-links.mjs";

const site = process.env.ASTRO_SITE ?? "https://federationchassevendee.github.io";
const base = process.env.ASTRO_BASE_PATH ?? "/site-web";

export default defineConfig({
  site,
  base,
  output: "static",
  trailingSlash: "always",
  markdown: {
    remarkPlugins: [[remarkLocalLinks, { base }]],
  },
});
