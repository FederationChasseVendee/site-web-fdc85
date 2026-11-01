export function getSiteConfig(env = process.env) {
  const cloudflare = Boolean(env.CF_PAGES || env.CF_PAGES_BRANCH);
  return {
    site: env.ASTRO_SITE ?? (cloudflare ? "https://fdc85.maury.app" : "https://federationchassevendee.github.io"),
    base: env.ASTRO_BASE_PATH ?? (cloudflare ? "/" : "/site-web"),
  };
}
