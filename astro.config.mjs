import { defineConfig } from "astro/config";
import preact from "@astrojs/preact";
import { staticRedirectBase } from "./scripts/static-redirect-base.mjs";

const cloudflare = process.env.CF_PAGES === "1" || Boolean(process.env.CF_PAGES_BRANCH);
const site = process.env.ASTRO_SITE ?? (cloudflare ? "https://fdc85.maury.app" : "https://federationchassevendee.github.io");
const base = process.env.ASTRO_BASE_PATH ?? (cloudflare ? "/" : "/site-web");

export default defineConfig({
  site,
  base,
  output: "static",
  trailingSlash: "always",
  integrations: [preact(), staticRedirectBase(site, base)],
});
