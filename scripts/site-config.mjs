export function siteConfig(environment = process.env) {
  const cloudflare = environment.CF_PAGES === "1" || Boolean(environment.CF_PAGES_BRANCH);
  return {
    site: environment.ASTRO_SITE ?? (cloudflare ? "https://fdc85.maury.app" : "https://federationchassevendee.github.io"),
    base: environment.ASTRO_BASE_PATH ?? (cloudflare ? "/" : "/site-web"),
  };
}
