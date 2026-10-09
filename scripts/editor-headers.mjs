import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const isolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "X-Robots-Tag": "noindex, nofollow",
  "Cache-Control": "no-store",
};

const workerHeaders = {
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Resource-Policy": "same-origin",
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

export function isEditorWorkerPath(url, base) {
  const path = (url ?? "").split("?")[0];
  const prefix = editorPathPrefix(base);
  return ["/src/editor/ai-worker.ts", `${prefix}/src/editor/ai-worker.ts`].includes(path)
    || [...new Set(["", prefix])].some(value => new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/_astro/ai-worker-[^/]+\\.js$`).test(path));
}

export function editorHeaders(base) {
  const prefix = editorPathPrefix(base);
  const rules = [...[`${prefix}/edit`, `${prefix}/edit/`, `${prefix}/edit/index.html`]
    .map(path => [path, isolationHeaders]), [`${prefix}/_astro/ai-worker-*`, workerHeaders]];
  return rules
    .map(([path, headers]) => `${path}\n${Object.entries(headers).map(([name, value]) => `  ${name}: ${value}`).join("\n")}`)
    .join("\n\n") + "\n";
}

export function editorDevHeadersPlugin(base) {
  return {
    name: "editor-dev-headers",
    configureServer(server) {
      const middleware = (request, response, next) => {
        const headers = isEditorDevPath(request.url, base) ? isolationHeaders
          : isEditorWorkerPath(request.url, base) ? workerHeaders : null;
        if (headers) {
          for (const [name, value] of Object.entries(headers)) {
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
