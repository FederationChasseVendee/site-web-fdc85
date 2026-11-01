import { readFile, writeFile } from "node:fs/promises";

const redirects = [
  "📢-securite-et-chasse-une-convention-renforcee-avec-la-gendarmerie",
  "🟢-ouverture-des-validations-du-permis-de-chasser-2026-2027-🟢",
  "🕊️-tourterelle-des-bois-ouverture-dimanche-30-aout",
];

export function staticRedirectBase(site, base) {
  const normalizedBase = `/${base.replace(/^\/+|\/+$/g, "")}/`.replace(/\/{2,}/g, "/");
  return {
    name: "fdc85-static-redirect-base",
    hooks: {
      "astro:build:done": async ({ dir }) => {
        const root = new URL(normalizedBase, site).href;
        for (const slug of redirects) {
          const path = new URL(`${slug}/index.html`, dir);
          const html = await readFile(path, "utf8");
          await writeFile(path, html
            .replaceAll("https://federationchassevendee.github.io/site-web/", root)
            .replaceAll('href="/site-web/', `href="${normalizedBase}`)
            .replaceAll("url=/site-web/", `url=${normalizedBase}`));
        }
      },
    },
  };
}
