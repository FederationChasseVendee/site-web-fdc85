import { defineConfig } from "astro/config";
import { satteri } from "@astrojs/markdown-satteri";
import { hastBaseLinks, staticRedirectBaseIntegration } from "./scripts/base-links.mjs";
import { getSiteConfig } from "./scripts/site-config.mjs";

const { site, base } = getSiteConfig();

export default defineConfig({
  site,
  base,
  output: "static",
  trailingSlash: "always",
  markdown: { processor: satteri({ hastPlugins: [hastBaseLinks(base)] }) },
  integrations: [staticRedirectBaseIntegration(site, base)],
});
