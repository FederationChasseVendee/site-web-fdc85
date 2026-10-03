import { browserConfig, mountTree, runtimeEnvironment, wasmProjects } from "./model.mjs";

/** @typedef {import("@webcontainer/api").WebContainer} Container */
/** @typedef {import("@webcontainer/api").WebContainerProcess} Process */
/** @typedef {import("./model.mjs").SiteSnapshot} SiteSnapshot */

export class BrowserRuntime {
  /**
   * @param {{
   * boot: () => Promise<Container>,
   * stage: (stage: string) => void,
   * log: (text: string) => void,
   * ready: (url: string) => void,
   * error: (message: string) => void,
   * timeout?: number
   * }} hooks
   */
  constructor(hooks) {
    this.hooks = hooks;
    /** @type {Container | null} */
    this.container = null;
    /** @type {Set<Process>} */
    this.processes = new Set();
    /** @type {Array<() => void>} */
    this.listeners = [];
    /** @type {AbortController | null} */
    this.abort = null;
    this.busy = false;
    this.needsReload = false;
    this.ready = false;
    this.generation = 0;
    /** @type {Set<string>} */
    this.editablePaths = new Set();
  }

  /** @template T @param {Promise<T>} work @param {string} label @returns {Promise<T>} */
  async wait(work, label) {
    const signal = this.abort?.signal;
    if (!signal || signal.aborted) throw new Error("Démarrage annulé.");
    let timer;
    /** @type {(() => void) | undefined} */
    let cancel;
    /** @type {Promise<never>} */
    const deadline = new Promise((_, reject) => {
      cancel = () => reject(new Error("Démarrage annulé."));
      signal.addEventListener("abort", cancel, { once: true });
      timer = setTimeout(() => reject(new Error(`${label} : délai dépassé. Consultez le journal, puis réessayez.`)),
        this.hooks.timeout ?? 180_000);
    });
    try { return await Promise.race([work, deadline]); }
    finally {
      clearTimeout(timer);
      if (cancel) signal.removeEventListener("abort", cancel);
    }
  }

  /** @param {Process} process */
  consume(process) {
    const generation = this.generation;
    this.processes.add(process);
    void process.output.pipeTo(new WritableStream({
      write: (text) => this.hooks.log(text),
    })).catch((error) => {
      if (generation === this.generation && this.abort && !this.abort.signal.aborted) {
        this.hooks.error(`Lecture du journal impossible : ${error.message}`);
      }
    });
    void process.exit.then(() => this.processes.delete(process), (error) => {
      this.processes.delete(process);
      if (generation === this.generation) this.hooks.log(`Erreur du processus : ${String(error)}\n`);
    });
  }

  /** @param {SiteSnapshot} snapshot @param {string} publicBase @param {Record<string, string>} drafts */
  async start(snapshot, publicBase, drafts) {
    if (this.busy || this.container) throw new Error("Un environnement est déjà actif.");
    if (this.needsReload) throw new Error("Rechargez la page avant de relancer Node.");
    this.busy = true;
    this.abort = new AbortController();
    const generation = ++this.generation;
    try {
      this.editablePaths = new Set(snapshot.editors.flatMap((group) => group.files));
      this.hooks.stage("boot");
      this.needsReload = true;
      const boot = this.hooks.boot().then((container) => {
        if (generation !== this.generation) {
          container.teardown();
          throw new Error("Démarrage annulé.");
        }
        this.container = container;
        this.needsReload = false;
        return container;
      });
      const container = await this.wait(boot, "Initialisation de Node");
      this.listeners.push(container.on("error", (error) => {
        if (generation !== this.generation) return;
        this.stop();
        this.hooks.error(`WebContainer : ${error.message}. Vérifiez le réseau et les permissions de stockage des domaines StackBlitz.`);
      }));
      this.hooks.stage("mount");
      await this.wait(container.mount(mountTree(snapshot)), "Chargement des sources");
      await this.wait(container.fs.writeFile("browser.config.mjs", browserConfig(snapshot, publicBase)), "Configuration Astro");
      for (const [path, contents] of Object.entries(drafts)) {
        if (!snapshot.editors.some((group) => group.files.includes(path))) throw new Error(`Brouillon interdit : ${path}`);
        await this.wait(container.fs.writeFile(path, contents), "Restauration du brouillon");
      }
      this.hooks.log("$ node : vérification de l’exécution dans le navigateur\n");
      const version = await this.wait(container.spawn("node", ["-e",
        "const proof = JSON.stringify(process.versions); console.log(proof); require('node:fs').writeFileSync('runtime-proof.json', proof);",
      ], { terminal: { cols: 100, rows: 24 } }), "Version Node");
      this.consume(version);
      if (await this.wait(version.exit, "Version Node") !== 0) throw new Error("Node ne fonctionne pas dans cet onglet.");
      const proof = await this.wait(container.fs.readFile("runtime-proof.json", "utf8"), "Preuve d’exécution Node");
      const versions = JSON.parse(proof);
      const [major, minor] = typeof versions.node === "string" ? versions.node.split(".").map(Number) : [];
      if (typeof versions.webcontainer !== "string" || !versions.webcontainer
        || !(major > 22 || (major === 22 && minor >= 12))) {
        throw new Error("Astro 7 exige Node 22.12 ou plus dans WebContainer. Ce runtime n’est pas compatible.");
      }
      this.hooks.log(`Node exécuté : ${proof}\n`);
      this.hooks.stage("install");
      this.hooks.log("$ npm install --omit=dev --no-audit --no-fund\n");
      const install = await this.wait(container.spawn("npm", ["install", "--omit=dev", "--no-audit", "--no-fund"], {
        env: runtimeEnvironment,
        terminal: { cols: 100, rows: 24 },
      }), "Téléchargement npm");
      this.consume(install);
      const code = await this.wait(install.exit, "Installation npm");
      if (code !== 0) throw new Error(`npm install a échoué (code ${code}). Rien n’a été publié. Consultez le journal.`);
      this.hooks.stage("wasm");
      // Keep each official WASI artifact with its matching emnapi bridge.
      // Rolldown requires emnapi 2, while Astro/Markdown require emnapi 1.
      const projects = wasmProjects(snapshot);
      for (const project of projects) {
        const directory = `.browser-wasi/${project.directory}`;
        await this.wait(container.fs.mkdir(directory, { recursive: true }), "Préparation WASI");
        await this.wait(container.fs.writeFile(`${directory}/package.json`, project.manifest), "Versions WASI");
        const wasmArgs = ["install", "--prefix", directory, "--ignore-scripts", "--force", "--no-audit", "--no-fund"];
        this.hooks.log(`$ npm ${wasmArgs.join(" ")} (${project.package})\n`);
        const wasm = await this.wait(container.spawn("npm", wasmArgs, {
          env: runtimeEnvironment, terminal: { cols: 100, rows: 24 },
        }), "Téléchargement des compilateurs WASI");
        this.consume(wasm);
        if (await this.wait(wasm.exit, "Installation WASI") !== 0) throw new Error(`Installation WASI impossible : ${project.package}. Consultez le journal.`);
      }
      await this.wait(container.fs.writeFile("link-wasi.cjs", `const fs = require("node:fs");
const path = require("node:path");
for (const project of ${JSON.stringify(projects.map(({ directory, package: name }) => ({ directory, name })))}) {
  const target = path.resolve(".browser-wasi", project.directory, "node_modules", project.name);
  const link = path.resolve("node_modules", project.name);
  fs.rmSync(link, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(link), { recursive: true });
  fs.symlinkSync(target, link, "dir");
}
`), "Liaison des compilateurs WASI");
      const link = await this.wait(container.spawn("node", ["link-wasi.cjs"]), "Liaison WASI");
      this.consume(link);
      if (await this.wait(link.exit, "Liaison WASI") !== 0) throw new Error("Les compilateurs WASI ne peuvent pas être reliés au site.");
      const diagnostics = `const fs = require("node:fs");
let step = "initialisation";
process.on("exit", code => console.log("Diagnostic compilateurs : sortie", code, "à", step));
console.log("NAPI_RS_FORCE_WASI =", process.env.NAPI_RS_FORCE_WASI);
for (const name of ["@rolldown/binding-wasm32-wasi", "@astrojs/compiler-binding-wasm32-wasi", "@bruits/satteri-wasm32-wasi"]) {
  step = name;
  try {
    console.log("Chargement", name, require.resolve(name));
    require(name);
    console.log("Chargé", name);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
    break;
  }
}
if (!process.exitCode) fs.writeFileSync("compiler-proof.json", JSON.stringify({ ready: true }));
`;
      await this.wait(container.fs.writeFile("diagnose.cjs", diagnostics), "Diagnostic WASI");
      const diagnostic = await this.wait(container.spawn("node", ["diagnose.cjs"], {
        env: runtimeEnvironment, terminal: { cols: 100, rows: 24 },
      }), "Diagnostic WASI");
      this.consume(diagnostic);
      if (await this.wait(diagnostic.exit, "Diagnostic WASI") !== 0) throw new Error("Le chargement des compilateurs WASI est incompatible avec ce runtime. Le journal contient la cause précise ; aucun aperçu de remplacement n’est généré.");
      const compilerProof = await this.wait(container.fs.readFile("compiler-proof.json", "utf8"), "Preuve de chargement WASI");
      if (JSON.parse(compilerProof).ready !== true) throw new Error("Le chargement WASI n’a pas été confirmé.");
      this.hooks.stage("server");
      this.hooks.log("$ npm run dev -- --config browser.config.mjs --host 0.0.0.0 --port 4321\n");
      /** @type {Promise<string>} */
      const serverReady = new Promise((resolve) => {
        this.listeners.push(container.on("server-ready", (port, url) => {
          if (port === 4321 && generation === this.generation) resolve(url);
        }));
      });
      const server = await this.wait(container.spawn("npm", [
        "run", "dev", "--", "--config", "browser.config.mjs", "--host", "0.0.0.0", "--port", "4321",
      ], { env: runtimeEnvironment, terminal: { cols: 100, rows: 24 } }), "Lancement Astro");
      this.consume(server);
      const unexpectedExit = server.exit.then((exitCode) => {
        throw new Error(`Astro s’est arrêté (code ${exitCode}). Les modules natifs ou la version Node peuvent être incompatibles ; consultez le journal.`);
      });
      const url = await this.wait(Promise.race([serverReady, unexpectedExit]), "Disponibilité du serveur Astro");
      if (generation !== this.generation) return;
      this.ready = true;
      this.hooks.ready(url);
      this.hooks.stage("ready");
      void unexpectedExit.catch((error) => {
        if (generation !== this.generation) return;
        this.stop();
        this.hooks.error(error.message);
      });
    } catch (error) {
      const cancelled = generation !== this.generation;
      this.stop();
      if (!cancelled) this.hooks.error(error instanceof Error ? error.message : String(error));
    } finally { this.busy = false; }
  }

  /** @param {string} path @param {string} contents */
  async write(path, contents) {
    if (!this.container || !this.ready) throw new Error("Le serveur Astro n’est pas prêt.");
    if (!this.editablePaths.has(path)) throw new Error(`Fichier non éditable : ${path}`);
    await this.container.fs.writeFile(path, contents);
  }

  stop() {
    ++this.generation;
    this.abort?.abort();
    for (const unsubscribe of this.listeners.splice(0)) unsubscribe();
    for (const process of this.processes) process.kill();
    this.processes.clear();
    this.container?.teardown();
    this.container = null;
    this.ready = false;
  }
}
