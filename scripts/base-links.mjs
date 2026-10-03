import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const unicodeRedirects = [
  "📢-securite-et-chasse-une-convention-renforcee-avec-la-gendarmerie",
  "🟢-ouverture-des-validations-du-permis-de-chasser-2026-2027-🟢",
  "🕊️-tourterelle-des-bois-ouverture-dimanche-30-aout",
];

export function rebaseInternalUrl(value, base) {
  if (!value.startsWith("/") || value.startsWith("//")) return value;
  const root = `/${base.replace(/^\/+|\/+$/g, "")}/`.replace(/\/+/g, "/");
  const relative = value.replace(/^\/site-web(?:\/|$)/, "/");
  if (root !== "/" && relative.startsWith(root)) return relative;
  return `${root}${relative.replace(/^\/+/, "")}`;
}

export function hastBaseLinks(base) {
  return {
    name: "fdc85-base-links",
    element: {
      filter: ["a", "img"],
      visit(node, context) {
        for (const attribute of ["href", "src"]) {
          const value = node.properties?.[attribute];
          if (typeof value === "string") context.setProperty(node, attribute, rebaseInternalUrl(value, base));
        }
      },
    },
  };
}

export function rebaseStaticRedirect(html, site, base) {
  const root = new URL(`${base.replace(/\/+$/, "")}/`, site).href;
  return html
    .replaceAll("https://federationchassevendee.github.io/site-web/", root)
    .replace(/((?:href|content)="(?:0; url=)?)\/site-web\//g, `$1${new URL(root).pathname}`);
}

export function staticRedirectBaseIntegration(site, base) {
  return {
    name: "fdc85-static-redirect-base",
    hooks: {
      "astro:build:done": ({ dir }) => {
        for (const route of unicodeRedirects) {
          const file = fileURLToPath(new URL(`${encodeURIComponent(route)}/index.html`, dir));
          writeFileSync(file, rebaseStaticRedirect(readFileSync(file, "utf8"), site, base), "utf8");
        }
      },
    },
  };
}
