import { rebaseStaticRedirect } from "../lib/base-links.mjs";

/**
 * @typedef {{ encoding: "utf8" | "base64", contents: string }} SnapshotFile
 * @typedef {{ name: string, label: string, format: string, files: string[], routeRoot: string | null }} EditorGroup
 * @typedef {{ version: number, sourceHash: string, files: Record<string, SnapshotFile>, assets: string[], editors: EditorGroup[] }} SiteSnapshot
 */

export const runtimeEnvironment = {
  ASTRO_BASE_PATH: "/",
  ASTRO_SITE: "https://browser-draft.invalid",
  PUBLIC_BROWSER_DRAFT: "true",
  ASTRO_TELEMETRY_DISABLED: "1",
  NAPI_RS_FORCE_WASI: "true",
};

/** @param {SiteSnapshot} snapshot */
export function wasmProjects(snapshot) {
  const lock = JSON.parse(snapshot.files["package-lock.json"].contents);
  return [
    ["rolldown", "@rolldown/binding-wasm32-wasi", "rolldown", "2.0.0-alpha.5"],
    ["@astrojs/compiler-binding", "@astrojs/compiler-binding-wasm32-wasi", "compiler", "1.11.1"],
    ["satteri", "@bruits/satteri-wasm32-wasi", "markdown", "1.11.1"],
  ].map(([original, wasm, directory, bridge]) => {
    const version = lock.packages[`node_modules/${original}`]?.version;
    if (typeof version !== "string" || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)) {
      throw new Error(`Version verrouillée du compilateur absente : ${original}`);
    }
    return { directory, package: wasm, manifest: JSON.stringify({
      name: `fdc85-browser-${directory}`, private: true,
      dependencies: { [wasm]: version, "@emnapi/core": bridge, "@emnapi/runtime": bridge,
        "@napi-rs/wasm-runtime": "1.2.4" },
      overrides: { "@emnapi/core": bridge, "@emnapi/runtime": bridge },
    }) };
  });
}

/** @param {{ secure: boolean, isolated: boolean, sharedMemory: boolean, userAgent: string }} environment */
export function compatibility(environment) {
  if (!environment.secure) return "Ouvrez cette page en HTTPS (ou sur localhost). Node ne peut pas démarrer en HTTP.";
  if (!environment.isolated || !environment.sharedMemory) {
    return "Isolation du navigateur absente : COOP same-origin, COEP require-corp et SharedArrayBuffer sont indispensables. Ouvrez /admin/ dans un onglet complet, pas dans une iframe CMS.";
  }
  if (/Firefox\//.test(environment.userAgent) || (/Safari\//.test(environment.userAgent) && !/Chrome\/|Chromium\//.test(environment.userAgent))) {
    return "Firefox et Safari sont expérimentaux chez WebContainers. Cette preuve de concept nécessite Chrome ou Edge sur ordinateur ; aucun faux aperçu ne les remplace.";
  }
  if (!/Chrome\/|Chromium\//.test(environment.userAgent)) return "Ce prototype nécessite un navigateur Chromium sur ordinateur.";
  if (/Android|Mobile/.test(environment.userAgent)) return "Utilisez Chrome ou Edge sur ordinateur : la mémoire et le support mobile ne sont pas validés.";
  return null;
}

/** @param {SiteSnapshot} snapshot */
export function validateSnapshot(snapshot) {
  if (snapshot.version !== 1 || !/^[a-f0-9]{64}$/.test(snapshot.sourceHash)
    || !snapshot.files["package-lock.json"] || !snapshot.files["src/pages/index.astro"]) {
    throw new Error("Snapshot public invalide ou incomplet. Redéployez la branche.");
  }
  for (const [path, file] of Object.entries(snapshot.files)) {
    if (path.includes("\\") || path.split("/").some((part) => !part || part.startsWith("."))
      || !["utf8", "base64"].includes(file.encoding) || typeof file.contents !== "string") {
      throw new Error(`Fichier de snapshot interdit : ${path}`);
    }
  }
}

/** @param {SiteSnapshot} snapshot @returns {import("@webcontainer/api").FileSystemTree} */
export function mountTree(snapshot) {
  validateSnapshot(snapshot);
  /** @type {import("@webcontainer/api").FileSystemTree} */
  const tree = {};
  for (const [path, file] of Object.entries(snapshot.files)) {
    const parts = path.split("/");
    const name = parts.pop();
    if (!name) throw new Error("Nom de fichier vide.");
    let directory = tree;
    for (const part of parts) {
      directory[part] ??= { directory: {} };
      const node = directory[part];
      if (!("directory" in node)) throw new Error(`Collision de chemins : ${path}`);
      directory = node.directory;
    }
    const contents = file.encoding === "base64"
      ? Uint8Array.from(atob(file.contents), (character) => character.charCodeAt(0))
      : path.startsWith("public/") && path.endsWith(".html")
        ? rebaseStaticRedirect(file.contents, runtimeEnvironment.ASTRO_SITE, "/")
        : file.contents;
    directory[name] = { file: { contents } };
  }
  return tree;
}

/** @param {string} path @param {EditorGroup} group */
export function previewRoute(path, group) {
  if (path === "src/content/home.json" || path === "src/content/site.json") return "/";
  if (!group.routeRoot || ["documents", "faqs", "glossary", "directories"].includes(group.name)) return "/";
  const slug = path.slice(group.routeRoot.length + 1).replace(/\.(md|mdx)$/i, "").toLowerCase();
  return `/${slug.split("/").map(encodeURIComponent).join("/")}/`;
}

/** @param {SiteSnapshot} snapshot @param {string} publicBase */
export function browserConfig(snapshot, publicBase) {
  const base = new URL(publicBase);
  if (!["https:", "http:"].includes(base.protocol)) throw new Error("Origine publique invalide.");
  return `import original from "./astro.config.mjs";
import { watch, mkdirSync } from "node:fs";
const publicBase = ${JSON.stringify(base.href)};
const assets = new Set(${JSON.stringify(snapshot.assets)});
export default {
  ...original,
  base: "/",
  server: { host: "0.0.0.0", port: 4321 },
  devToolbar: { enabled: false },
  vite: {
    ...original.vite,
    server: { host: "0.0.0.0", port: 4321, strictPort: true, allowedHosts: true },
    plugins: [...(original.vite?.plugins ?? []), {
      name: "public-media-without-binary-download",
      configureServer(server) {
        const reloadContent = (file) => {
          const path = file.replaceAll(String.fromCharCode(92), "/");
          if (!path.endsWith("/.astro/data-store.json") && !path.endsWith("/data-store/manifest.json")) return;
          // The Vite 8 runner can retain Astro's immutable content-store singleton
          // in WebContainer. Invalidate after the store is written, not before the loader runs.
          for (const environment of Object.values(server.environments)) {
            environment.moduleGraph.invalidateAll();
            environment.runner?.clearCache();
          }
          console.log("[brouillon] Store Astro écrit, caches Vite invalidés.");
          server.environments.client.hot.send({ type: "full-reload", path: "*" });
        };
        // Chokidar ignores generated .astro files; observe atomic rename/write
        // events directly instead, after the real Astro loader has serialized data.
        mkdirSync(".astro", { recursive: true });
        const watcher = watch(".astro", (_event, name) => {
          if (name === "data-store.json") reloadContent(process.cwd() + "/.astro/" + name);
        });
        watcher.on("error", error => {
          console.error("[brouillon] Surveillance du store Astro impossible", error);
          server.environments.client.hot.send({ type: "error", err: { message: error.message, stack: error.stack } });
        });
        server.httpServer?.once("close", () => watcher.close());
        server.middlewares.use((req, res, next) => {
          const path = decodeURIComponent((req.url ?? "").split("?")[0]).replace(/^\\/+/, "");
          if (assets.has(path)) {
            res.writeHead(302, { Location: new URL(path, publicBase).href });
            res.end();
          } else next();
        });
      },
    }],
  },
};`;
}

/** @param {Record<string, string>} drafts @param {SiteSnapshot} snapshot */
export function changedDrafts(drafts, snapshot) {
  const editable = new Set(snapshot.editors.flatMap((group) => group.files));
  return Object.fromEntries(Object.entries(drafts).filter(([path, contents]) => editable.has(path)
    && contents !== snapshot.files[path]?.contents));
}
