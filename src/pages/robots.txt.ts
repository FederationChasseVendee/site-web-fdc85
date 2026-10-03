import type { APIRoute } from "astro";

export const GET: APIRoute = ({ site }) => {
  if (!site) throw new Error("L’URL de production Astro est requise pour générer robots.txt.");
  const root = new URL(import.meta.env.BASE_URL, site);
  const sitemap = new URL("sitemap.xml", root);
  return new Response(`User-agent: *
Allow: ${root.pathname}
Disallow: ${root.pathname}editeur/

Sitemap: ${sitemap.href}
`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
