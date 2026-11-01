import { PRODUCTION_URL } from "./preview.mjs";

/** @param {Record<string, string | undefined>} env */
export function siteConfig(env) {
  const cloudflare = env.CF_PAGES === "1";
  return {
    site: env.ASTRO_SITE ?? (cloudflare ? PRODUCTION_URL : "https://federationchassevendee.github.io"),
    base: env.ASTRO_BASE_PATH ?? (cloudflare ? "/" : "/site-web"),
  };
}
