import type { APIRoute } from "astro";
import { buildIdentity } from "../lib/preview-identity.mjs";

export const GET: APIRoute = ({ site }) => {
  if (!site) throw new Error("L’URL de production Astro est requise pour générer robots.txt.");
  const root = new URL(import.meta.env.BASE_URL, site);
  const sitemap = new URL("sitemap.xml", root);
  if (buildIdentity.preview) {
    return new Response("User-agent: *\nDisallow: /\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  return new Response(`User-agent: *
Allow: ${root.pathname}
Disallow: ${new URL("admin/", root).pathname}

Sitemap: ${sitemap.href}
`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
