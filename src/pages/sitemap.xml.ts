import type { APIRoute } from "astro";
import { getTemplateEntries } from "../lib/content";
import { getArticlesByStatus, pageCount } from "../lib/news";

const escapeXml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

export const GET: APIRoute = async ({ site }) => {
  if (!site) throw new Error("L’URL de production Astro est requise pour générer le sitemap.");
  const root = new URL(import.meta.env.BASE_URL, site);
  const entries = (await getTemplateEntries()).filter((entry) => entry.template !== "redirect");
  const activeArticles = await getArticlesByStatus(false);
  const archivedArticles = await getArticlesByStatus(true);
  const routes = new Set<string>(["", "mes-demarches/", "mes-demarches/se-former/"]);

  entries.forEach((entry) => routes.add(`${entry.slug}/`));
  routes.add("actualites/");
  routes.add("actualites/archives/");
  for (let page = 2; page <= pageCount(activeArticles); page += 1) {
    routes.add(`actualites/page/${page}/`);
  }
  for (let page = 2; page <= pageCount(archivedArticles); page += 1) {
    routes.add(`actualites/archives/page/${page}/`);
  }

  const urls = [...routes]
    .sort((a, b) => a.localeCompare(b, "fr"))
    .map((route) => `  <url><loc>${escapeXml(new URL(route, root).href)}</loc></url>`)
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
