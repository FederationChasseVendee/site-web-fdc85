import type { FileSystemTree, SpawnOptions } from "@webcontainer/api";
import { errorMessage, isRecord } from "./contracts.ts";
import type { RuntimeAdapter, RuntimeHooks } from "./contracts.ts";
import { editablePath, fileHash, workspacePath } from "./policy.ts";

export interface RuntimeProcess {
  output: ReadableStream<string>;
  exit: Promise<number>;
  kill(): void;
}

export interface RuntimeContainer {
  fs: {
    readFile(path: string, encoding: "utf8"): Promise<string>;
    writeFile(path: string, bytes: string | Uint8Array): Promise<void>;
    mkdir(path: string, options: { recursive: true }): Promise<unknown>;
    rm(path: string, options: { recursive: boolean; force: boolean }): Promise<void>;
  };
  mount(tree: FileSystemTree): Promise<void>;
  spawn(command: string, args: string[], options?: SpawnOptions): Promise<RuntimeProcess>;
  on(event: "server-ready", listener: (port: number, url: string) => void): () => void;
  on(event: "error", listener: (error: { message: string }) => void): () => void;
  teardown(): void;
}

export type RuntimeBoot = () => Promise<RuntimeContainer>;

const configPath = "editor.browser.config.mjs";
const internalPath = ".editor";
const environment = {
  ASTRO_BASE_PATH: "/",
  ASTRO_SITE: "https://browser-draft.invalid",
  PUBLIC_BROWSER_DRAFT: "true",
  ASTRO_TELEMETRY_DISABLED: "1",
  NAPI_RS_FORCE_WASI: "true",
};
const terminal = { cols: 100, rows: 24 };
const decoder = new TextDecoder("utf-8", { fatal: true });

function runtimeEnvironment(): Record<string, string> {
  const values: Record<string, string> = { ...environment };
  if (typeof location !== "undefined") values.PUBLIC_EDITOR_PARENT_ORIGIN = location.origin;
  return values;
}

// A cancelled boot cannot be interrupted. Its late instance must be torn down
// before any other runtime is allowed to boot.
let bootBarrier: Promise<void> = Promise.resolve();
let bootOwner: BrowserRuntime | null = null;

async function browserBoot(): Promise<RuntimeContainer> {
  if (typeof window === "undefined" || !window.isSecureContext
    || !(window.location.protocol === "https:" || (window.location.protocol === "http:"
      && /^(?:localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)))) {
    throw new Error("Node dans le navigateur exige HTTPS (ou localhost).");
  }
  if (!window.crossOriginIsolated || typeof SharedArrayBuffer === "undefined") {
    throw new Error("Isolation absente : COOP same-origin, COEP require-corp et SharedArrayBuffer sont indispensables.");
  }
  const agent = window.navigator.userAgent;
  if (!/(?:Chrome|Edg)\//.test(agent) || /Android|Mobile|iPhone|iPad|Firefox\/|OPR\//.test(agent)) {
    throw new Error("Utilisez Chrome ou Edge sur ordinateur pour exécuter Node et Astro.");
  }
  const { WebContainer, configureAPIKey } = await import("@webcontainer/api");
  const key = import.meta.env?.PUBLIC_WEBCONTAINER_API_KEY;
  if (typeof key === "string" && key.trim()) configureAPIKey(key.trim());
  return WebContainer.boot({ coep: "require-corp", forwardPreviewErrors: "exceptions-only" });
}

function abortError(): DOMException {
  return new DOMException("Opération Node annulée.", "AbortError");
}

function cancelled(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function previewPath(path: string): boolean {
  return workspacePath(path) && path !== configPath
    && path !== "src/pages/edit.astro" && path !== "src/pages/admin.astro"
    && !/^scripts\/test-editor-[^/]*\.mjs$/.test(path)
    && path !== "scripts/editor-browser-benchmark.mjs"
    && !["src/editor/", "src/admin/", "functions/", ".github/", ".editor/"].some((prefix) => path.startsWith(prefix))
    && !["src/editor", "src/admin", "functions", ".github", internalPath].includes(path);
}

function snapshot(files: Map<string, Uint8Array>): Map<string, Uint8Array> {
  return new Map([...files].filter(([path]) => previewPath(path))
    .map(([path, bytes]) => [path, new Uint8Array(bytes)]));
}

function sameBytes(left: Uint8Array | undefined, right: Uint8Array): boolean {
  return left !== undefined && left.length === right.length
    && left.every((byte, index) => byte === right[index]);
}

function directories(files: Map<string, Uint8Array>): Set<string> {
  const result = new Set<string>();
  for (const path of files.keys()) {
    const parts = path.split("/");
    parts.pop();
    while (parts.length) {
      result.add(parts.join("/"));
      parts.pop();
    }
  }
  return result;
}

function mountTree(files: Map<string, Uint8Array>): FileSystemTree {
  const tree: FileSystemTree = Object.create(null);
  for (const [path, bytes] of files) {
    const parts = path.split("/");
    const name = parts.pop();
    if (!name) throw new Error(`Nom de fichier invalide : ${path}`);
    let directory = tree;
    for (const part of parts) {
      let entry = directory[part];
      if (!entry) {
        entry = { directory: Object.create(null) };
        directory[part] = entry;
      }
      if (!("directory" in entry)) throw new Error(`Collision de chemins : ${path}`);
      directory = entry.directory;
    }
    if (directory[name]) throw new Error(`Collision de chemins : ${path}`);
    directory[name] = { file: { contents: new Uint8Array(bytes) } };
  }
  return tree;
}

function wasiProjects(files: Map<string, Uint8Array>) {
  const bytes = files.get("package-lock.json");
  if (!bytes || !files.has("package.json")) throw new Error("package.json et package-lock.json sont indispensables à npm ci.");
  const lock: unknown = JSON.parse(decoder.decode(bytes));
  if (!isRecord(lock) || !isRecord(lock.packages)) throw new Error("Le verrou npm ne contient pas les versions des compilateurs.");
  const packages = lock.packages;
  const bindings = [
    ["rolldown", "@rolldown/binding-wasm32-wasi", "rolldown", "2.0.0-alpha.5"],
    ["@astrojs/compiler-binding", "@astrojs/compiler-binding-wasm32-wasi", "compiler", "1.11.1"],
    ["satteri", "@bruits/satteri-wasm32-wasi", "markdown", "1.11.1"],
  ] as const;
  return bindings.map(([original, name, directory, bridge]) => {
    const entry = packages[`node_modules/${original}`];
    if (!isRecord(entry) || typeof entry.version !== "string" || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(entry.version)) {
      throw new Error(`Version verrouillée du compilateur absente : ${original}`);
    }
    return {
      name, directory,
      manifest: JSON.stringify({
        name: `editor-browser-${directory}`, private: true,
        dependencies: {
          [name]: entry.version, "@emnapi/core": bridge, "@emnapi/runtime": bridge,
          "@napi-rs/wasm-runtime": "1.2.4",
        },
        overrides: { "@emnapi/core": bridge, "@emnapi/runtime": bridge },
      }),
    };
  });
}

async function dependencyFingerprint(files: Map<string, Uint8Array>): Promise<string> {
  const manifests = [...files].filter(([path]) => /(?:^|\/)(?:package(?:-lock)?\.json|npm-shrinkwrap\.json)$/.test(path))
    .sort(([left], [right]) => left.localeCompare(right));
  const hashes = await Promise.all(manifests.map(async ([path, bytes]) => [path, await fileHash(bytes)]));
  return fileHash(new TextEncoder().encode(JSON.stringify(hashes)));
}

function browserConfig(): string {
  return `import original from "./astro.config.mjs";
import { watch, mkdirSync } from "node:fs";
export default {
  ...original,
  base: "/",
  site: process.env.ASTRO_SITE ?? "https://browser-draft.invalid",
  server: { ...original.server, host: "0.0.0.0", port: 4321 },
  devToolbar: { enabled: false },
  vite: {
    ...original.vite,
    server: { ...original.vite?.server, host: "0.0.0.0", port: 4321, strictPort: true, allowedHosts: true },
    plugins: [...(original.vite?.plugins ?? []), {
      name: "editor-astro-content-store",
      configureServer(server) {
        const reloadContent = (file) => {
          const path = file.replaceAll(String.fromCharCode(92), "/");
          if (!path.endsWith("/.astro/data-store.json") && !path.endsWith("/data-store/manifest.json")) return;
          // Invalidate the Vite 8 immutable store only after Astro writes it.
          for (const environment of Object.values(server.environments)) {
            environment.moduleGraph.invalidateAll();
            environment.runner?.clearCache();
          }
          console.log("[brouillon] Store Astro écrit, caches Vite invalidés.");
          server.environments.client.hot.send({ type: "full-reload", path: "*" });
        };
        mkdirSync(".astro", { recursive: true });
        const watcher = watch(".astro", (_event, name) => {
          if (name === "data-store.json") reloadContent(process.cwd() + "/.astro/" + name);
        });
        watcher.on("error", error => {
          console.error("[brouillon] Surveillance du store Astro impossible", error);
          server.environments.client.hot.send({ type: "error", err: { message: error.message, stack: error.stack } });
        });
        server.httpServer?.once("close", () => watcher.close());
      },
    }],
  },
};
`;
}

interface Job {
  controller: AbortController;
  generation: number;
}

interface ProcessRecord {
  process: RuntimeProcess;
  exit: Promise<number>;
  logs: Promise<void>;
  cancelLogs: AbortController;
  outputError?: Error;
  expectedExit: boolean;
  ready: boolean;
  generation: number;
  exited: boolean;
  exitCode?: number;
  exitError?: Error;
}

export class BrowserRuntime implements RuntimeAdapter {
  private container: RuntimeContainer | null = null;
  private sources = new Map<string, Uint8Array>();
  private installedFingerprint: string | null = null;
  private nodeChecked = false;
  private mounted = false;
  private generation = 0;
  private queue: Promise<void> = Promise.resolve();
  private active: Job | null = null;
  private processes = new Set<ProcessRecord>();
  private server: ProcessRecord | null = null;
  private unsubscribeError: (() => void) | null = null;
  private requiresReload = false;
  private readonly hooks: RuntimeHooks;
  private readonly boot: RuntimeBoot;
  private readonly timeoutMs: number;

  constructor(
    hooks: RuntimeHooks,
    boot: RuntimeBoot = browserBoot,
    timeoutMs = 180_000,
  ) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("Délai Node invalide.");
    this.hooks = hooks;
    this.boot = boot;
    this.timeoutMs = timeoutMs;
  }

  prepare(files: Map<string, Uint8Array>, signal: AbortSignal): Promise<void> {
    const filesCopy = snapshot(files);
    return this.enqueue(signal, (job) => this.prepareFiles(filesCopy, job));
  }

  open(files: Map<string, Uint8Array>, signal: AbortSignal): Promise<string> {
    const filesCopy = snapshot(files);
    return this.enqueue(signal, async (job) => {
      await this.prepareFiles(filesCopy, job);
      return this.startServer(job);
    });
  }

  write(path: string, content: Uint8Array | null): Promise<void> {
    if (!editablePath(path) || !previewPath(path)) {
      const error = new Error(`Fichier non éditable : ${path}`);
      this.hooks.error(error.message);
      return Promise.reject(error);
    }
    const bytes = content === null ? null : new Uint8Array(content);
    return this.enqueue(new AbortController().signal, async (job) => {
      const container = this.requireContainer();
      if (!this.installedFingerprint) throw new Error("Préparez Node avant de modifier les sources.");
      if (bytes === null) {
        await this.io(job, () => container.fs.rm(path, { recursive: false, force: true }), "Suppression du fichier");
        this.sources.delete(path);
      } else {
        await this.writeFile(path, bytes, job);
        this.sources.set(path, bytes);
      }
    });
  }

  validate(signal: AbortSignal): Promise<void> {
    return this.enqueue(signal, async (job) => {
      this.requireContainer();
      if (!this.installedFingerprint) throw new Error("Préparez Node avant de vérifier le site.");
      const restart = this.server !== null;
      await this.stopServer(job);
      this.hooks.stage("Vérification Astro");
      await this.run("npm", ["exec", "--no", "--", "astro", "check", "--config", configPath], job, "astro check");
      this.hooks.stage("Construction Astro");
      await this.run("npm", ["exec", "--no", "--", "astro", "build", "--config", configPath], job, "astro build");
      await this.run("npm", ["run", "check:generated"], job, "Vérification du site généré");
      if (restart) await this.startServer(job);
      this.hooks.stage("Vérification terminée");
    });
  }

  stop(): void {
    this.dispose();
  }

  private enqueue<T>(signal: AbortSignal, work: (job: Job) => Promise<T>): Promise<T> {
    const generation = this.generation;
    const operation = this.queue.then(async () => {
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
      const job = { controller, generation };
      this.active = job;
      try {
        this.guard(job);
        return await work(job);
      } catch (error) {
        if (!cancelled(error)) this.hooks.error(errorMessage(error));
        throw error;
      } finally {
        signal.removeEventListener("abort", abort);
        if (this.active === job) this.active = null;
      }
    });
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  private guard(job: Job): void {
    if (job.controller.signal.aborted || job.generation !== this.generation) throw abortError();
  }

  private async wait<T>(work: Promise<T>, label: string, job: Job, timeout = this.timeoutMs): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abort: (() => void) | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
      abort = () => reject(abortError());
      if (job.controller.signal.aborted || job.generation !== this.generation) abort();
      else job.controller.signal.addEventListener("abort", abort, { once: true });
      timer = setTimeout(() => reject(new Error(`${label} : délai dépassé. Consultez le journal puis réessayez.`)), timeout);
    });
    try {
      const result = await Promise.race([work, deadline]);
      this.guard(job);
      return result;
    } finally {
      clearTimeout(timer);
      if (abort) job.controller.signal.removeEventListener("abort", abort);
    }
  }

  private async io<T>(job: Job, work: () => Promise<T>, label: string): Promise<T> {
    this.guard(job);
    try {
      return await this.wait(work(), label, job);
    } catch (error) {
      // Filesystem requests cannot be cancelled. Never reuse their container
      // after cancellation/error, so a late write cannot reach another branch.
      if (job.generation === this.generation) this.dispose();
      throw error;
    }
  }

  private requireContainer(): RuntimeContainer {
    if (!this.container) throw new Error("L’environnement Node n’est pas prêt.");
    return this.container;
  }

  private async getContainer(job: Job): Promise<RuntimeContainer> {
    this.guard(job);
    if (this.requiresReload) throw new Error("Rechargez la page : l’environnement Node n’a pas pu être arrêté.");
    if (this.container) return this.container;
    await this.wait(bootBarrier, "Arrêt de l’environnement précédent", job);
    if (bootOwner) throw new Error("Un autre environnement WebContainer est déjà actif.");
    bootOwner = this;
    this.hooks.stage("Initialisation de Node");
    const pending = Promise.resolve().then(() => {
      this.guard(job);
      return this.boot();
    }).then((container) => {
      if (job.controller.signal.aborted || job.generation !== this.generation) {
        try { container.teardown(); }
        catch (error) {
          this.requiresReload = true;
          this.hooks.error(`Arrêt WebContainer impossible : ${errorMessage(error)}. Rechargez la page.`);
          throw error;
        }
        if (bootOwner === this) bootOwner = null;
        throw abortError();
      }
      this.container = container;
      this.unsubscribeError = container.on("error", (error) => {
        if (this.container !== container) return;
        this.dispose();
        this.hooks.error(`WebContainer : ${error.message}. Vérifiez le réseau et les permissions de stockage StackBlitz.`);
      });
      return container;
    });
    bootBarrier = pending.then(() => undefined, () => {
      if (!this.container && bootOwner === this && !this.requiresReload) bootOwner = null;
    });
    try {
      return await this.wait(pending, "Initialisation de Node", job);
    } catch (error) {
      job.controller.abort();
      if (job.generation === this.generation) this.dispose();
      throw error;
    }
  }

  private async writeFile(path: string, bytes: string | Uint8Array, job: Job): Promise<void> {
    const container = this.requireContainer();
    const parent = path.slice(0, path.lastIndexOf("/"));
    if (path.includes("/")) await this.io(job, () => container.fs.mkdir(parent, { recursive: true }), "Création du dossier");
    await this.io(job, () => container.fs.writeFile(path, typeof bytes === "string" ? bytes : new Uint8Array(bytes)), `Écriture de ${path}`);
  }

  private async sync(files: Map<string, Uint8Array>, job: Job): Promise<void> {
    const container = this.requireContainer();
    if (!this.mounted) {
      const tree = mountTree(files);
      await this.io(job, () => container.mount(tree), "Chargement des sources");
      this.sources = new Map(files);
      this.mounted = true;
    } else {
      const oldDirectories = directories(this.sources);
      const newDirectories = directories(files);
      for (const path of [...this.sources.keys()]) {
        if (files.has(path)) continue;
        await this.io(job, () => container.fs.rm(path, { recursive: false, force: true }), `Suppression de ${path}`);
        this.sources.delete(path);
      }
      for (const path of [...oldDirectories].filter((path) => !newDirectories.has(path)).sort((a, b) => b.length - a.length)) {
        await this.io(job, () => container.fs.rm(path, { recursive: true, force: true }), `Suppression de ${path}`);
      }
      for (const [path, bytes] of files) {
        if (sameBytes(this.sources.get(path), bytes)) continue;
        await this.writeFile(path, bytes, job);
        this.sources.set(path, bytes);
      }
    }
    for (const path of [".astro", "dist"]) {
      await this.io(job, () => container.fs.rm(path, { recursive: true, force: true }), `Nettoyage de ${path}`);
    }
    await this.writeFile(configPath, browserConfig(), job);
  }

  private async prepareFiles(files: Map<string, Uint8Array>, job: Job): Promise<void> {
    this.guard(job);
    const projects = wasiProjects(files);
    const fingerprint = await this.wait(dependencyFingerprint(files), "Empreinte des dépendances", job);
    await this.getContainer(job);
    await this.stopServer(job);
    this.hooks.stage("Chargement des sources de la branche");
    await this.sync(files, job);
    if (!this.nodeChecked) {
      await this.writeFile(`${internalPath}/node-proof.json`, "", job);
      await this.run("node", ["-e", `require("node:fs").writeFileSync("${internalPath}/node-proof.json", JSON.stringify(process.versions)); console.log(process.versions);`], job, "Version Node");
      const proof = await this.io(job, () => this.requireContainer().fs.readFile(`${internalPath}/node-proof.json`, "utf8"), "Preuve Node");
      const versions: unknown = JSON.parse(proof);
      if (!isRecord(versions) || typeof versions.node !== "string"
        || typeof versions.webcontainer !== "string" || !versions.webcontainer) {
        throw new Error("L’exécution réelle de Node dans WebContainer n’a pas été confirmée.");
      }
      const [major = 0, minor = 0] = versions.node.split(".").map(Number);
      if (!/^\d+\.\d+\.\d+$/.test(versions.node)
        || !(major > 22 || (major === 22 && minor >= 12))) throw new Error("Astro 7 exige Node 22.12 ou plus dans WebContainer.");
      this.nodeChecked = true;
    }
    if (this.installedFingerprint === fingerprint) {
      this.hooks.stage("Dépendances verrouillées réutilisées");
      return;
    }
    this.installedFingerprint = null;
    const container = this.requireContainer();
    for (const path of ["node_modules", `${internalPath}/wasi`]) {
      await this.io(job, () => container.fs.rm(path, { recursive: true, force: true }), `Nettoyage de ${path}`);
    }
    this.hooks.stage("Installation npm du verrou de la branche");
    await this.run("npm", ["ci", "--omit=dev", "--no-audit", "--no-fund"], job, "npm ci");
    this.hooks.stage("Installation des compilateurs WASI officiels");
    for (const project of projects) {
      const directory = `${internalPath}/wasi/${project.directory}`;
      await this.writeFile(`${directory}/package.json`, project.manifest, job);
      await this.run("npm", ["install", "--prefix", directory, "--ignore-scripts", "--force", "--no-audit", "--no-fund"], job, `WASI ${project.name}`);
    }
    const linkScript = `const fs = require("node:fs");
const path = require("node:path");
for (const project of ${JSON.stringify(projects.map(({ name, directory }) => ({ name, directory })))}) {
  const target = path.resolve("${internalPath}/wasi", project.directory, "node_modules", project.name);
  if (!fs.existsSync(target)) throw new Error("Paquet WASI absent : " + project.name);
  const link = path.resolve("node_modules", project.name);
  fs.rmSync(link, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(link), { recursive: true });
  fs.symlinkSync(target, link, "dir");
}
`;
    await this.writeFile(`${internalPath}/link-wasi.cjs`, linkScript, job);
    await this.run("node", [`${internalPath}/link-wasi.cjs`], job, "Liaison WASI");
    await this.writeFile(`${internalPath}/compiler-proof.json`, "", job);
    await this.writeFile(`${internalPath}/diagnose.cjs`, `const fs = require("node:fs");
for (const name of ${JSON.stringify(projects.map(({ name }) => name))}) {
  console.log("Chargement WASI", name, require.resolve(name));
  require(name);
}
fs.writeFileSync("${internalPath}/compiler-proof.json", JSON.stringify({ ready: true }));
`, job);
    await this.run("node", [`${internalPath}/diagnose.cjs`], job, "Chargement des compilateurs WASI");
    const proof = await this.io(job, () => container.fs.readFile(`${internalPath}/compiler-proof.json`, "utf8"), "Preuve WASI");
    const compiler: unknown = JSON.parse(proof);
    if (!isRecord(compiler) || compiler.ready !== true) throw new Error("Le chargement WASI n’a pas été confirmé.");
    this.guard(job);
    this.installedFingerprint = fingerprint;
    this.hooks.stage("Node et compilateurs prêts");
  }

  private track(process: RuntimeProcess, job: Job): ProcessRecord {
    const container = this.container;
    const cancelLogs = new AbortController();
    const record: ProcessRecord = {
      process, cancelLogs, expectedExit: false, ready: false, generation: job.generation, exited: false,
      exit: process.exit.then((code) => {
        record.exited = true;
        record.exitCode = code;
        return code;
      }, (error: unknown) => {
        record.exited = true;
        record.exitError = new Error(`Processus Node : ${errorMessage(error)}`);
        throw record.exitError;
      }),
      logs: Promise.resolve(),
    };
    this.processes.add(record);
    record.logs = process.output.pipeTo(new WritableStream<string>({
      write: (text) => {
        if (this.container === container && !cancelLogs.signal.aborted && !job.controller.signal.aborted) this.hooks.log(text);
      },
    }), { signal: cancelLogs.signal }).catch((error: unknown) => {
      if (cancelLogs.signal.aborted) return;
      record.outputError = new Error(`Lecture du journal impossible : ${errorMessage(error)}`);
      try { process.kill(); }
      catch (killError) {
        if (job.generation === this.generation) this.dispose();
        this.hooks.error(`${record.outputError.message}. Arrêt impossible : ${errorMessage(killError)}`);
      }
    });
    return record;
  }

  private async spawn(command: string, args: string[], job: Job, label: string): Promise<ProcessRecord> {
    this.guard(job);
    const container = this.requireContainer();
    this.hooks.log(`$ ${command} ${args.join(" ")}\n`);
    this.guard(job);
    const pending = container.spawn(command, args, { env: runtimeEnvironment(), terminal }).then((process) => {
      if (this.container !== container || job.controller.signal.aborted || job.generation !== this.generation) {
        process.kill();
        throw abortError();
      }
      return this.track(process, job);
    });
    try {
      return await this.wait(pending, label, job);
    } catch (error) {
      if (job.generation === this.generation) this.dispose();
      throw error;
    }
  }

  private async terminate(record: ProcessRecord): Promise<void> {
    record.expectedExit = true;
    record.cancelLogs.abort();
    const cleanupJob = { controller: new AbortController(), generation: this.generation };
    try {
      if (!record.exited) record.process.kill();
      await this.wait(record.exit, "Arrêt du processus Node", cleanupJob, Math.min(this.timeoutMs, 5_000));
      await record.logs;
    } catch (error) {
      if (record.generation === this.generation) {
        this.dispose();
        if (!cancelled(error)) this.hooks.error(errorMessage(error));
      }
    } finally {
      this.processes.delete(record);
    }
  }

  private async run(command: string, args: string[], job: Job, label: string): Promise<void> {
    const record = await this.spawn(command, args, job, label);
    let complete = false;
    try {
      const code = await this.wait(Promise.race([record.exit, record.logs.then(() => {
        if (record.outputError) throw record.outputError;
        return record.exit;
      })]), label, job);
      await this.wait(record.logs, `Journal ${label}`, job);
      complete = true;
      if (record.outputError) throw record.outputError;
      if (code !== 0) throw new Error(`${label} a échoué (code ${code}). Consultez le journal ; rien n’a été publié.`);
    } finally {
      if (!complete) await this.terminate(record);
      this.processes.delete(record);
    }
  }

  private async stopServer(job: Job): Promise<void> {
    const server = this.server;
    if (!server) return;
    this.server = null;
    await this.terminate(server);
    this.guard(job);
    this.requireContainer();
  }

  private async startServer(job: Job): Promise<string> {
    this.guard(job);
    this.hooks.stage("Démarrage du véritable serveur Astro");
    const container = this.requireContainer();
    let resolveReady: ((url: string) => void) | undefined;
    const ready = new Promise<string>((resolve) => { resolveReady = resolve; });
    const unsubscribe = container.on("server-ready", (port, url) => {
      if (port !== 4321 || this.container !== container || job.controller.signal.aborted || job.generation !== this.generation) return;
      if (/^https?:\/\//.test(url)) resolveReady?.(url);
    });
    let record: ProcessRecord | undefined;
    try {
      record = await this.spawn("npm", ["run", "dev", "--", "--config", configPath, "--host", "0.0.0.0", "--port", "4321"], job, "Démarrage Astro");
      this.server = record;
      const server = record;
      const unexpectedExit = server.exit.then(() => {
        throw this.serverFailure(server);
      });
      const failure = Promise.race([unexpectedExit, server.logs.then(() => {
        if (server.outputError) throw server.outputError;
        return unexpectedExit;
      })]);
      void failure.catch((error: unknown) => {
        if (this.server !== server || server.expectedExit || !server.ready) return;
        this.dispose();
        this.hooks.error(errorMessage(error));
      });
      const url = await this.wait(Promise.race([ready, failure]), "Disponibilité du port 4321", job);
      this.guard(job);
      if (server.exited || server.outputError) throw this.serverFailure(server);
      server.ready = true;
      this.hooks.ready(url);
      this.hooks.stage("Aperçu prêt");
      return url;
    } catch (error) {
      if (record && this.server === record) {
        this.server = null;
        await this.terminate(record);
      }
      throw error;
    } finally {
      unsubscribe();
    }
  }

  private serverFailure(server: ProcessRecord): Error {
    return server.outputError ?? server.exitError
      ?? new Error(`Astro s’est arrêté de façon inattendue (code ${server.exitCode}). Consultez le journal.`);
  }

  private dispose(): void {
    ++this.generation;
    this.active?.controller.abort();
    this.unsubscribeError?.();
    this.unsubscribeError = null;
    this.server = null;
    for (const record of this.processes) {
      record.expectedExit = true;
      record.cancelLogs.abort();
      try { record.process.kill(); }
      catch (error) { this.hooks.error(`Arrêt Node impossible : ${errorMessage(error)}`); }
    }
    this.processes.clear();
    const container = this.container;
    this.container = null;
    this.sources.clear();
    this.mounted = false;
    this.nodeChecked = false;
    this.installedFingerprint = null;
    if (container) {
      try {
        container.teardown();
        if (bootOwner === this) bootOwner = null;
      } catch (error) {
        this.requiresReload = true;
        this.hooks.error(`Arrêt WebContainer impossible : ${errorMessage(error)}. Rechargez la page.`);
      }
    }
  }
}
