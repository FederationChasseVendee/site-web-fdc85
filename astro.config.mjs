import { defineConfig } from "astro/config";
import { satteri } from "@astrojs/markdown-satteri";
import { hastBaseLinks, staticRedirectBaseIntegration } from "./scripts/base-links.mjs";

const site = process.env.ASTRO_SITE ?? "https://federationchassevendee.github.io";
const base = process.env.ASTRO_BASE_PATH ?? "/site-web";

export default defineConfig({
  site,
  base,
  output: "static",
  trailingSlash: "always",
  markdown: { processor: satteri({ hastPlugins: [hastBaseLinks(base)] }) },
  integrations: [staticRedirectBaseIntegration(site, base)],
});
