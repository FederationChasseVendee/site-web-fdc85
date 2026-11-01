import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeBase } from "./preview.mjs";

/** @param {string} value @param {string} base */
export function rebaseLegacyUrl(value, base) {
  return value.startsWith("/site-web/") ? `${normalizeBase(base)}${value.slice("/site-web/".length)}` : value;
}

/** @param {{base: string}} options */
export function rebaseMarkdown(options) {
  return {
    name: "rebase-legacy-markdown-urls",
    element: {
      filter: ["a", "img"],
      visit(node, ctx) {
        for (const attribute of ["href", "src"]) {
          const value = node.properties?.[attribute];
          if (typeof value === "string" && value.startsWith("/site-web/")) {
            ctx.setProperty(node, attribute, rebaseLegacyUrl(value, options.base));
          }
        }
      },
    },
  };
}

function htmlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? htmlFiles(path) : entry.name.endsWith(".html") ? [path] : [];
  });
}

/** Public legacy redirects bypass Markdown and Astro layouts. */
export function rebasePublicRedirects(site, base) {
  return {
    name: "rebase-public-legacy-redirects",
    hooks: {
      "astro:build:done": ({ dir }) => {
        const root = new URL(normalizeBase(base), site).href;
        for (const source of htmlFiles("public")) {
          const html = readFileSync(source, "utf8");
          if (!html.includes('http-equiv="refresh"')) continue;
          const output = join(fileURLToPath(dir), relative("public", source));
          const rebased = html
            .replaceAll("https://federationchassevendee.github.io/site-web/", root)
            .replaceAll('href="/site-web/', `href="${normalizeBase(base)}`)
            .replaceAll("url=/site-web/", `url=${normalizeBase(base)}`);
          writeFileSync(output, rebased, "utf8");
        }
      },
    },
  };
}
