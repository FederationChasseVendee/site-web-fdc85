import { defineConfig } from "astro/config";
import { satteri } from "@astrojs/markdown-satteri";
import { hastBaseLinks } from "./src/lib/base-links.mjs";
import { staticRedirectBaseIntegration } from "./scripts/base-links.mjs";
import { editorDevHeadersPlugin, editorHeadersIntegration } from "./scripts/editor-headers.mjs";
import { siteConfig } from "./scripts/site-config.mjs";

const { site, base } = siteConfig();
const editorHeadersEnabled = process.env.PUBLIC_BROWSER_DRAFT !== "true";
const integrations = editorHeadersEnabled ? [editorHeadersIntegration()] : [];

export default defineConfig({
  site,
  base,
  output: "static",
  trailingSlash: "always",
  markdown: { processor: satteri({ hastPlugins: [hastBaseLinks(base)] }) },
  integrations: [...integrations, staticRedirectBaseIntegration(site, base)],
  vite: { plugins: editorHeadersEnabled ? [editorDevHeadersPlugin(base)] : [] },
});
