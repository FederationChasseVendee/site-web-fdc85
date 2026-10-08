import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { unicodeRedirects, rebaseStaticRedirect } from "../src/lib/base-links.mjs";

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
