import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const isolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "X-Robots-Tag": "noindex, nofollow",
  "Cache-Control": "no-store",
};

function editorPathPrefix(base) {
  const normalized = base.replace(/^\/+|\/+$/g, "");
  return normalized ? `/${normalized}` : "";
}

export function editorDevPaths(base) {
  const prefix = editorPathPrefix(base);
  return [...new Set(["/edit", "/edit/", `${prefix}/edit`, `${prefix}/edit/`])];
}

export function isEditorDevPath(url, base) {
  return editorDevPaths(base).includes((url ?? "").split("?")[0]);
}

export function editorHeaders(base) {
  const prefix = editorPathPrefix(base);
  return [`${prefix}/edit`, `${prefix}/edit/`, `${prefix}/edit/index.html`]
    .map((path) => `${path}\n${Object.entries(isolationHeaders).map(([name, value]) => `  ${name}: ${value}`).join("\n")}`)
    .join("\n\n") + "\n";
}

export function editorDevHeadersPlugin(base) {
  return {
    name: "editor-dev-headers",
    configureServer(server) {
      const middleware = (request, response, next) => {
        if (isEditorDevPath(request.url, base)) {
          for (const [name, value] of Object.entries(isolationHeaders)) {
            response.setHeader(name, value);
          }
        }
        next();
      };
      if (Array.isArray(server.middlewares.stack)) {
        server.middlewares.stack.unshift({ route: "", handle: middleware });
      } else {
        server.middlewares.use(middleware);
      }
    },
  };
}

export function editorHeadersIntegration() {
  return {
    name: "local-editor-isolation",
    hooks: {
      "astro:config:setup": async ({ config, command }) => {
        if (command === "sync") return;
        const publicDirectory = fileURLToPath(config.publicDir);
        await mkdir(publicDirectory, { recursive: true });
        await writeFile(join(publicDirectory, "_headers"), editorHeaders(config.base), "utf8");
      },
    },
  };
}
