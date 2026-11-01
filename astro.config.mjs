import { defineConfig } from "astro/config";
import { satteri } from "@astrojs/markdown-satteri";
import { rebaseMarkdown, rebasePublicRedirects } from "./src/lib/legacy-base.mjs";
import { siteConfig } from "./src/lib/site-config.mjs";

const { site, base } = siteConfig(process.env);

export default defineConfig({
  site,
  base,
  output: "static",
  trailingSlash: "always",
  markdown: { processor: satteri({ hastPlugins: [rebaseMarkdown({ base })] }) },
  integrations: [rebasePublicRedirects(site, base)],
});
