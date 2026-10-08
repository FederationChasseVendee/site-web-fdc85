import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

export function editorHeaders(base) {
  const prefix = base.replace(/\/$/, "");
  return [`${prefix}/edit`, `${prefix}/edit/`, `${prefix}/edit/index.html`]
    .map((path) => `${path}\n  Cross-Origin-Opener-Policy: same-origin\n  Cross-Origin-Embedder-Policy: require-corp\n  X-Robots-Tag: noindex, nofollow\n  Cache-Control: no-store`)
    .join("\n\n") + "\n";
}

export function editorHeadersIntegration() {
  return {
    name: "local-editor-isolation",
    hooks: {
      "astro:config:setup": async ({ config, command, updateConfig }) => {
        if (command === "sync") return;
        const publicDirectory = fileURLToPath(config.publicDir);
        await mkdir(publicDirectory, { recursive: true });
        await writeFile(join(publicDirectory, "_headers"), editorHeaders(config.base), "utf8");
        updateConfig({ vite: { plugins: [{
          name: "editor-dev-headers",
          configureServer(server) {
            server.middlewares.use((request, response, next) => {
              const path = (request.url ?? "").split("?")[0];
              const prefix = config.base.replace(/\/$/, "");
              if ([`${prefix}/edit`, `${prefix}/edit/`, `${prefix}/edit/index.html`].includes(path)) {
                response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
                response.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
              }
              next();
            });
          },
        }] } });
      },
    },
  };
}
