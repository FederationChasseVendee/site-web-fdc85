import { readdir, readFile, mkdir, writeFile, lstat } from "node:fs/promises";
import { join, resolve, relative } from "node:path";
import { createHash } from "node:crypto";
import { parse } from "yaml";
import { unicodeRedirects } from "../src/lib/base-links.mjs";

const rootFiles = new Set(["package.json", "package-lock.json", "tsconfig.json", "astro.config.mjs",
  "scripts/base-links.mjs", "scripts/site-config.mjs"]);
const redirectFiles = new Set(unicodeRedirects.map((route) => `public/${route}/index.html`));
const sourceRoots = ["components", "content", "layouts", "lib", "pages", "styles", "templates"];
const assetExtensions = /\.(png|jpe?g|webp|gif|svg|ico|avif|pdf|woff2?)$/i;

export function allowedSource(path) {
  if (path.includes("\\") || path.split("/").some((part) => !part || part.startsWith("."))) return false;
  if (rootFiles.has(path) || redirectFiles.has(path) || ["src/content.config.ts", "src/env.d.ts"].includes(path)) return true;
  return sourceRoots.some((directory) => path.startsWith(`src/${directory}/`))
    && path !== "src/pages/admin.astro"
    && /\.(astro|ts|mjs|css|md|json)$/.test(path);
}

export function allowedAsset(path) {
  return path.startsWith("public/assets/") && assetExtensions.test(path)
    && !path.includes("\\") && !path.split("/").some((part) => !part || part.startsWith("."));
}

async function filesIn(directory, root) {
  if (!(await lstat(directory)).isDirectory()) throw new Error(`Répertoire public non régulier : ${relative(root, directory)}`);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Lien symbolique interdit dans le snapshot : ${relative(root, path)}`);
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) files.push(...await filesIn(path, root));
    else if (entry.isFile()) files.push(relative(root, path).replaceAll("\\", "/"));
  }
  return files.sort();
}

export async function buildSnapshot(root) {
  root = resolve(root);
  const candidates = [...rootFiles, ...redirectFiles, "src/content.config.ts", "src/env.d.ts"];
  for (const directory of sourceRoots) {
    candidates.push(...await filesIn(join(root, "src", directory), root));
  }
  const files = {};
  for (const path of candidates.filter(allowedSource)) {
    const diskPath = join(root, ...path.split("/"));
    if (!(await lstat(diskPath)).isFile()) throw new Error(`Source non régulière : ${path}`);
    files[path] = { encoding: "utf8", contents: await readFile(diskPath, "utf8") };
  }
  // These small binary files are mounted as bytes, never decoded as UTF-8.
  for (const path of ["public/favicon.png", "public/favicon.svg"]) {
    if (!(await lstat(join(root, path))).isFile()) throw new Error(`Média non régulier : ${path}`);
    files[path] = { encoding: "base64", contents: (await readFile(join(root, path))).toString("base64") };
  }
  const assets = (await filesIn(join(root, "public", "assets"), root))
    .filter(allowedAsset).map((path) => path.slice("public/".length));
  const cms = parse(await readFile(join(root, ".pages.yml"), "utf8"));
  const editors = cms.content.map((collection) => ({
    name: collection.name,
    label: collection.label,
    format: collection.format,
    files: Object.keys(files).filter((path) => collection.type === "file"
      ? path === collection.path : path.startsWith(`${collection.path}/`)),
    routeRoot: collection.type === "collection" ? collection.path : null,
  }));
  if (editors.some((editor) => editor.files.length === 0)) throw new Error("Collection CMS absente du snapshot.");
  const sourceHash = createHash("sha256").update(JSON.stringify(files)).digest("hex");
  return { version: 1, sourceHash, files, assets, editors };
}

export function adminHeaders(base) {
  const prefix = `/${base.replace(/^\/+|\/+$/g, "")}`.replace(/\/$/, "");
  const isolated = ["Cross-Origin-Opener-Policy: same-origin", "Cross-Origin-Embedder-Policy: require-corp",
    "X-Robots-Tag: noindex, nofollow", "Cache-Control: no-store"];
  return [
    [`${prefix}/admin`, ...isolated],
    [`${prefix}/admin/`, ...isolated],
    [`${prefix}/admin/index.html`, ...isolated],
    [`${prefix}/admin-runtime/*`, "Cross-Origin-Resource-Policy: same-origin", "X-Robots-Tag: noindex, nofollow"],
    [`${prefix}/assets/*`, "Cross-Origin-Resource-Policy: cross-origin"],
  ].map(([path, ...headers]) => `${path}\n${headers.map((header) => `  ${header}`).join("\n")}`).join("\n\n") + "\n";
}

export function browserAdminIntegration() {
  return {
    name: "browser-admin-snapshot",
    hooks: {
      "astro:config:setup": async ({ config, updateConfig, command }) => {
        if (command === "sync") return;
        // fileURLToPath handles Windows drive letters and encoded paths.
        const { fileURLToPath } = await import("node:url");
        const directory = fileURLToPath(config.publicDir);
        const snapshot = await buildSnapshot(fileURLToPath(config.root));
        await mkdir(join(directory, "admin-runtime"), { recursive: true });
        await writeFile(join(directory, "admin-runtime", "site.json"), JSON.stringify(snapshot));
        await writeFile(join(directory, "_headers"), adminHeaders(config.base));
        if (command === "dev" || command === "preview") {
          updateConfig({
            vite: { plugins: [{
              name: "browser-admin-isolation",
              configureServer(server) {
                server.middlewares.use((req, res, next) => {
                  const path = (req.url ?? "").split("?")[0];
                  const admin = `${config.base.replace(/\/$/, "")}/admin`;
                  if ([admin, `${admin}/`, `${admin}/index.html`].includes(path)) {
                    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
                    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
                  }
                  if (path.includes("/assets/")) res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
                  next();
                });
              },
            }] },
          });
        }
      },
    },
  };
}
