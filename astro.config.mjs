import { defineConfig } from "astro/config";
import { satteri } from "@astrojs/markdown-satteri";
import { hastBaseLinks } from "./src/lib/base-links.mjs";
import { staticRedirectBaseIntegration } from "./scripts/base-links.mjs";
import { siteConfig } from "./scripts/site-config.mjs";

const { site, base } = siteConfig();
const integrations = process.env.PUBLIC_BROWSER_DRAFT === "true"
  ? []
  : [(await import("./scripts/browser-snapshot.mjs")).browserAdminIntegration()];

export default defineConfig({
  site,
  base,
  output: "static",
  trailingSlash: "always",
  markdown: { processor: satteri({ hastPlugins: [hastBaseLinks(base)] }) },
  integrations: [...integrations, staticRedirectBaseIntegration(site, base)],
});
