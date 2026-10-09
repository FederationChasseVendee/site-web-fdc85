import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { BrowserRuntime } from "../src/editor/runtime.ts";

const encode = (text) => new TextEncoder().encode(text);
const decode = (bytes) => new TextDecoder().decode(bytes);
const signal = () => new AbortController().signal;
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

function sources(overrides = {}) {
  const files = new Map(Object.entries({
    "package.json": JSON.stringify({ name: "editor-test", scripts: { dev: "astro dev", "check:generated": "node scripts/check-generated-site.mjs" } }),
    "package-lock.json": JSON.stringify({ lockfileVersion: 3, packages: {
      "node_modules/astro": { version: "7.3.3" },
      "node_modules/rolldown": { version: "1.2.9" },
      "node_modules/@astrojs/compiler-binding": { version: "0.4.1" },
      "node_modules/satteri": { version: "0.10.5" },
    } }),
    "astro.config.mjs": "export default {};",
    "scripts/editor-headers.mjs": "export const editorHeadersIntegration = () => ({});",
    "scripts/base-links.mjs": "export const staticRedirectBaseIntegration = () => ({});",
    "scripts/site-config.mjs": "export const siteConfig = () => ({});",
    "src/lib/base-links.mjs": "export const hastBaseLinks = () => {};",
    "src/pages/index.astro": "<h1>Accueil</h1>",
    "src/content/home.json": '{"title":"Vendée"}',
    "public/assets/photo.webp": new Uint8Array([0, 255, 128, 32, 0]),
    ...overrides,
  }).map(([path, content]) => [path, typeof content === "string" ? encode(content) : content]));
  for (const [path, bytes] of files) if (bytes === null) files.delete(path);
  return files;
}

class FakeProcess {
  killed = 0;
  finished = false;
  outputCancelled = false;
  outputFailed = false;
  leaveOutputOpen = false;
  completion = deferred();
  exit = this.completion.promise;
  output = new ReadableStream({
    start: (controller) => { this.stream = controller; },
    cancel: () => { this.outputCancelled = true; },
  });

  finish(code = 0) {
    if (this.finished) return;
    this.finished = true;
    if (!this.leaveOutputOpen && !this.outputCancelled && !this.outputFailed) this.stream.close();
    this.completion.resolve(code);
  }

  kill() {
    ++this.killed;
    this.finish(143);
  }

  failOutput(error) {
    this.outputFailed = true;
    this.stream.error(error);
  }
}

class FakeContainer {
  files = new Map();
  calls = [];
  mutations = [];
  mounts = [];
  listeners = new Map();
  teardownCount = 0;
  onSpawn = undefined;
  automaticReady = true;
  nodeVersion = "22.12.0";
  compilerProof = true;
  previewBase = "/";

  fs = {
    mkdir: async (path) => { this.mutations.push(["mkdir", path]); },
    writeFile: async (path, content) => {
      this.files.set(path, typeof content === "string" ? encode(content) : new Uint8Array(content));
      this.mutations.push(["write", path]);
    },
    readFile: async (path) => {
      const bytes = this.files.get(path);
      if (!bytes) throw new Error(`ENOENT: ${path}`);
      return decode(bytes);
    },
    rm: async (path, options) => {
      this.mutations.push(["rm", path]);
      this.files.delete(path);
      if (options.recursive) {
        for (const name of this.files.keys()) if (name.startsWith(`${path}/`)) this.files.delete(name);
      }
    },
  };

  async mount(tree) {
    this.mounts.push(tree);
    const walk = (entries, prefix = "") => {
      for (const [name, entry] of Object.entries(entries)) {
        const path = `${prefix}${name}`;
        if ("directory" in entry) walk(entry.directory, `${path}/`);
        else {
          assert.ok(entry.file.contents instanceof Uint8Array, `${path} must stay binary-safe`);
          this.files.set(path, new Uint8Array(entry.file.contents));
        }
      }
    };
    walk(tree);
  }

  on(event, listener) {
    const listeners = this.listeners.get(event) ?? new Set();
    listeners.add(listener);
    this.listeners.set(event, listeners);
    return () => listeners.delete(listener);
  }

  emit(event, ...args) {
    for (const listener of this.listeners.get(event) ?? []) listener(...args);
  }

  async spawn(command, args, options) {
    assert.equal(this.teardownCount, 0, "a torn-down container must not spawn");
    const process = new FakeProcess();
    const call = { command, args, options, process };
    this.calls.push(call);
    if (command === "npm" && args[0] === "run" && args[1] === "dev") {
      this.files.set(".editor/preview-settings.json", encode(JSON.stringify({ base: this.previewBase })));
    }
    const outcome = this.onSpawn?.(call, this);
    if (outcome === "hold") return process;
    queueMicrotask(() => {
      if (process.finished) return;
      if (command === "node" && args[0] === "-e") {
        this.files.set(".editor/node-proof.json", encode(JSON.stringify({ node: this.nodeVersion, webcontainer: "1.0.0" })));
      }
      if (command === "node" && args[0] === ".editor/diagnose.cjs") {
        this.files.set(".editor/compiler-proof.json", encode(JSON.stringify({ ready: this.compilerProof })));
      }
      if (command === "npm" && args[0] === "ci") this.files.set("node_modules/installation", encode(String(this.installs)));
      if (command === "npm" && args[0] === "run" && args[1] === "dev" && outcome === undefined) {
        if (this.automaticReady) this.emit("server-ready", 4321, "https://runtime.test");
      } else process.finish(outcome ?? 0);
    });
    return process;
  }

  teardown() {
    ++this.teardownCount;
    for (const { process } of this.calls) if (!process.finished) process.kill();
  }

  get installs() {
    return this.calls.filter(({ command, args }) => command === "npm" && args[0] === "ci").length;
  }

  get servers() {
    return this.calls.filter(({ args }) => args[0] === "run" && args[1] === "dev");
  }
}

function setup(t, options = {}) {
  const container = options.container ?? new FakeContainer();
  const observed = { stages: [], logs: [], urls: [], errors: [], boots: 0 };
  const hooks = {
    stage: (value) => observed.stages.push(value),
    log: (value) => observed.logs.push(value),
    ready: (value) => observed.urls.push(value),
    error: (value) => observed.errors.push(value),
  };
  const boot = options.boot ?? (async () => container);
  const runtime = new BrowserRuntime(hooks, async () => { ++observed.boots; return boot(); }, options.timeout ?? 1_000);
  t.after(() => runtime.stop());
  return { runtime, container, observed };
}

async function until(predicate, timeoutMs = 5_000) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, Math.min(5, deadline - performance.now())));
  }
  assert.fail(`runtime did not reach the expected operation within ${timeoutMs} ms`);
}

test("until waits for asynchronous completion and fails at a bounded elapsed-time deadline", async () => {
  let completed = false;
  const timer = setTimeout(() => { completed = true; }, 25);
  try {
    await until(() => completed);
    assert.equal(completed, true);
  } finally {
    clearTimeout(timer);
  }
  await assert.rejects(until(() => false, 20), /within 20 ms/);
});

test("module imports without booting an SDK or requiring browser globals", (t) => {
  const { runtime, observed } = setup(t);
  assert.ok(runtime instanceof BrowserRuntime);
  assert.equal(observed.boots, 0);
});

test("mount preserves all local bytes and excludes credentials, generated files and editor/auth code", async (t) => {
  const denied = [
    ".env", ".env.production", ".npmrc", ".git/config", "node_modules/secret.js", "dist/index.html",
    ".astro/data-store.json", "src/editor/client.ts", "src/admin/runtime.mjs",
    "src/pages/edit.astro", "src/pages/admin.astro", "functions/api/editor.ts",
    ".github/workflows/deploy.yml", ".editor/credentials.json", "editor.browser.config.mjs",
    "../secret", "/absolute", "src\\bad.ts",
  ];
  const overrides = Object.fromEntries(denied.map((path) => [path, "must-not-mount"]));
  overrides["public/extra.dat"] = new Uint8Array([255, 254, 253, 0]);
  const files = sources(overrides);
  const { runtime, container, observed } = setup(t);
  await runtime.prepare(files, signal());
  assert.equal(observed.boots, 1);
  assert.equal(container.mounts.length, 1);
  assert.deepEqual(container.files.get("public/assets/photo.webp"), files.get("public/assets/photo.webp"));
  assert.deepEqual(container.files.get("public/extra.dat"), files.get("public/extra.dat"));
  for (const path of denied) {
    if (path === "editor.browser.config.mjs") assert.notEqual(decode(container.files.get(path)), "must-not-mount");
    else assert.equal(container.files.has(path), false, path);
  }
  for (const path of ["scripts/editor-headers.mjs", "scripts/site-config.mjs", "scripts/base-links.mjs", "src/lib/base-links.mjs"]) {
    assert.deepEqual(container.files.get(path), files.get(path));
  }
  assert.equal(container.servers.length, 0, "prepare installs but does not pretend to serve");
  assert.deepEqual(observed.urls, []);
});

test("preview mount excludes editor test modules and browser benchmark but keeps required production scripts", async (t) => {
  const excluded = [
    "scripts/test-editor-runtime.mjs",
    "scripts/test-editor-policy.mjs",
    "scripts/test-editor-backend.mjs",
    "scripts/test-editor-future-feature.mjs",
    "scripts/editor-browser-benchmark.mjs",
  ];
  const files = sources({
    ...Object.fromEntries(excluded.map((path) => [path, 'import "../src/editor/runtime.ts";'])),
    "scripts/check-generated-site.mjs": "export const check = true;",
    "scripts/test-umami.mjs": "export const analytics = true;",
  });
  const { runtime, container } = setup(t);
  await runtime.prepare(files, signal());
  for (const path of excluded) assert.equal(container.files.has(path), false, path);
  for (const path of [
    "scripts/editor-headers.mjs", "scripts/base-links.mjs", "scripts/site-config.mjs",
    "scripts/check-generated-site.mjs", "scripts/test-umami.mjs",
  ]) assert.deepEqual(container.files.get(path), files.get(path), path);
});

test("npm ci and three isolated official WASI projects use exact lock versions and matching bridges", async (t) => {
  const { runtime, container } = setup(t);
  await runtime.prepare(sources(), signal());
  const npm = container.calls.filter(({ command }) => command === "npm");
  assert.deepEqual(npm[0].args, ["ci", "--omit=dev", "--no-audit", "--no-fund"]);
  for (const [directory, name, version, bridge] of [
    ["rolldown", "@rolldown/binding-wasm32-wasi", "1.2.9", "2.0.0-alpha.5"],
    ["compiler", "@astrojs/compiler-binding-wasm32-wasi", "0.4.1", "1.11.1"],
    ["markdown", "@bruits/satteri-wasm32-wasi", "0.10.5", "1.11.1"],
  ]) {
    const manifest = JSON.parse(decode(container.files.get(`.editor/wasi/${directory}/package.json`)));
    assert.equal(manifest.dependencies[name], version);
    for (const packageName of ["@emnapi/core", "@emnapi/runtime"]) {
      assert.equal(manifest.dependencies[packageName], bridge);
      assert.equal(manifest.overrides[packageName], bridge);
    }
    assert.equal(manifest.dependencies["@napi-rs/wasm-runtime"], "1.2.4");
    assert.ok(npm.some(({ args }) => args.join(" ") === `install --prefix .editor/wasi/${directory} --ignore-scripts --force --no-audit --no-fund`));
  }
  assert.match(decode(container.files.get(".editor/link-wasi.cjs")), /fs\.symlinkSync\(target, link, "dir"\)/);
  assert.ok(container.calls.some(({ args }) => args[0] === ".editor/diagnose.cjs"));
  assert.equal(container.files.has("package-lock.json"), true);
});

test("Node version, missing lock entries and failed WASI proof cannot produce a successful preparation", async (t) => {
  for (const version of ["20.19.0", "22.11.9", "not-a-version"]) {
    const { runtime, container, observed } = setup(t);
    container.nodeVersion = version;
    await assert.rejects(runtime.prepare(sources(), signal()), /Node 22\.12/);
    assert.equal(container.installs, 0);
    assert.equal(observed.errors.length, 1);
    runtime.stop();
  }
  const { runtime, container, observed } = setup(t);
  await assert.rejects(runtime.prepare(sources({ "package-lock.json": '{"packages":{}}' }), signal()), /Version verrouillée/);
  assert.equal(observed.boots, 0);
  container.compilerProof = false;
  await assert.rejects(runtime.prepare(sources(), signal()), /WASI n’a pas été confirmé/);
  assert.deepEqual(observed.urls, []);
});

test("open returns only a real 4321 server-ready event, not other ports or an invented origin", async (t) => {
  const { runtime, container, observed } = setup(t);
  container.automaticReady = false;
  let completed = false;
  const opened = runtime.open(sources(), signal()).then((url) => { completed = true; return url; });
  await until(() => container.servers.length === 1);
  container.emit("server-ready", 3000, "https://wrong-port.test");
  container.emit("server-ready", 4321, "javascript:bad");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(completed, false);
  container.emit("server-ready", 4321, "https://actual-4321.test");
  assert.equal(await opened, "https://actual-4321.test");
  assert.deepEqual(observed.urls, ["https://actual-4321.test"]);
  assert.deepEqual(container.servers[0].args, ["run", "dev", "--", "--config", "editor.browser.config.mjs", "--host", "0.0.0.0", "--port", "4321"]);
  assert.equal(container.listeners.get("server-ready").size, 0);
});

test("branch changes restore original files, remove stale files and retain identical dependency installs", async (t) => {
  const { runtime, container, observed } = setup(t);
  const initial = sources({
    "src/content/obsolete/post.md": "old article",
    "public/assets/deleted.pdf": new Uint8Array([0, 200, 255]),
  });
  await runtime.open(initial, signal());
  await runtime.write("src/content/home.json", encode('{"title":"draft"}'));
  await runtime.write("src/pages/new.astro", encode("<h1>Draft route</h1>"));
  await runtime.write("public/assets/photo.webp", new Uint8Array([1, 128, 255]));
  const previous = container.servers[0].process;
  const next = sources({ "src/content/new/post.md": "branch article" });
  container.files.set(".astro/data-store.json", encode("stale generated data"));
  container.files.set("dist/obsolete/index.html", encode("old output"));
  await runtime.open(next, signal());
  assert.ok(previous.killed > 0);
  assert.equal(container.teardownCount, 0);
  assert.equal(observed.boots, 1);
  assert.equal(container.installs, 1);
  assert.equal(container.calls.filter(({ args }) => args[0] === "install").length, 3);
  assert.equal(decode(container.files.get("node_modules/installation")), "1");
  for (const path of ["src/pages/new.astro", "src/content/obsolete/post.md", "public/assets/deleted.pdf", ".astro/data-store.json", "dist/obsolete/index.html"]) {
    assert.equal(container.files.has(path), false, path);
  }
  for (const [path, bytes] of next) assert.deepEqual(container.files.get(path), bytes, path);
  assert.ok(container.mutations.some(([operation, path]) => operation === "rm" && path === "src/content/obsolete"));
});

test("manifest and lock changes each reinstall instead of sharing node_modules between different dependencies", async (t) => {
  const { runtime, container } = setup(t);
  const first = sources();
  await runtime.open(first, signal());
  const second = new Map(first);
  second.set("package.json", encode('{"name":"changed","scripts":{"dev":"astro dev"}}'));
  await runtime.open(second, signal());
  assert.equal(container.installs, 2);
  const lock = JSON.parse(decode(second.get("package-lock.json")));
  lock.packages["node_modules/rolldown"].version = "1.2.10";
  second.set("package-lock.json", encode(JSON.stringify(lock)));
  await runtime.open(second, signal());
  assert.equal(container.installs, 3);
  const rolldown = JSON.parse(decode(container.files.get(".editor/wasi/rolldown/package.json")));
  assert.equal(rolldown.dependencies["@rolldown/binding-wasm32-wasi"], "1.2.10");
});

test("write creates, changes and removes binary-safe editable files, never protected metadata", async (t) => {
  const { runtime, container, observed } = setup(t);
  await runtime.prepare(sources(), signal());
  for (const path of ["package.json", "package-lock.json", "astro.config.mjs", ".editor/state.json", ".env", "src/editor/ai.ts", "src/pages/edit.astro", "src/pages/admin.astro", "src/content/.hidden.json", "public/assets/../../secret.json"]) {
    await assert.rejects(runtime.write(path, encode("denied")), /non éditable/);
    await assert.rejects(runtime.write(path, null), /non éditable/);
  }
  const bytes = new Uint8Array([0, 128, 255, 10]);
  await runtime.write("public/assets/added.pdf", bytes);
  bytes[0] = 10;
  assert.deepEqual(container.files.get("public/assets/added.pdf"), new Uint8Array([0, 128, 255, 10]));
  await runtime.write("src/content/new/deep/page.md", encode("new text"));
  assert.equal(decode(container.files.get("src/content/new/deep/page.md")), "new text");
  await runtime.write("public/assets/added.pdf", null);
  await runtime.write("src/content/new/deep/page.md", null);
  await runtime.write("src/content/does-not-exist.md", null);
  assert.equal(container.files.has("public/assets/added.pdf"), false);
  assert.equal(container.files.has("src/content/new/deep/page.md"), false);
  assert.equal(observed.urls.length, 0);
});

test("snapshot bytes cannot be mutated by callers while preparing", async (t) => {
  const { runtime, container } = setup(t);
  const files = sources();
  const expected = new Uint8Array(files.get("public/assets/photo.webp"));
  const prepared = runtime.prepare(files, signal());
  files.get("public/assets/photo.webp").fill(12);
  files.set("src/content/home.json", encode("corrupt caller mutation"));
  await prepared;
  assert.deepEqual(container.files.get("public/assets/photo.webp"), expected);
  assert.equal(decode(container.files.get("src/content/home.json")), '{"title":"Vendée"}');
});

test("wrapper preserves the site's base and content-store watcher while fencing preview indexing and remote scripts", async (t) => {
  const { runtime, container } = setup(t);
  await runtime.prepare(sources(), signal());
  const wrapper = decode(container.files.get("editor.browser.config.mjs"));
  assert.doesNotMatch(wrapper, /publicBase|Location:|federationchassevendee\.github/);
  let watchCallback;
  let errorCallback;
  let closeCallback;
  let closed = 0;
  let invalidations = 0;
  let cleared = 0;
  const sent = [];
  let previewHeaders;
  const context = {
    process: { env: { ASTRO_SITE: "https://test-draft.invalid" }, cwd: () => "/project" },
    console: { log() {}, error() {} },
    mkdirSync: (path, options) => { assert.equal(path, ".astro"); assert.equal(options.recursive, true); },
    writeFileSync: (path, value) => {
      assert.equal(path, ".editor/preview-settings.json");
      assert.equal(JSON.parse(value).base, "/site-web");
    },
    watch: (path, options, callback) => {
      assert.equal(path, ".astro");
      assert.equal(options.persistent, false);
      watchCallback = callback;
      return {
        on: (event, listener) => { assert.equal(event, "error"); errorCallback = listener; },
        close: () => { ++closed; },
      };
    },
  };
  const executable = wrapper
    .replace('import original from "./astro.config.mjs";', 'const original = { base: "/site-web", vite: { plugins: [{ name: "kept" }] } };')
    .replace('import { watch, mkdirSync, writeFileSync } from "node:fs";', "")
    .replace("export default", "globalThis.config =");
  runInNewContext(executable, context);
  assert.equal(context.config.base, "/site-web");
  assert.equal(context.config.site, "https://test-draft.invalid");
  assert.equal(context.config.devToolbar.enabled, false);
  assert.equal(context.config.server.host, "0.0.0.0");
  assert.equal(context.config.vite.server.strictPort, true);
  assert.equal(context.config.vite.server.allowedHosts, true);
  assert.equal(context.config.vite.plugins[0].name, "kept");
  let middlewareEntry;
  context.config.integrations[0].hooks["astro:config:setup"]({ addMiddleware: entry => { middlewareEntry = entry; } });
  assert.equal(middlewareEntry.entrypoint, "/project/.editor/preview-middleware.mjs");
  assert.equal(middlewareEntry.order, "post");
  context.config.vite.plugins[1].configureServer({
    middlewares: { use: callback => { previewHeaders = callback; } },
    environments: {
      client: { moduleGraph: { invalidateAll: () => { ++invalidations; } }, hot: { send: (event) => sent.push(event) } },
      ssr: { moduleGraph: { invalidateAll: () => { ++invalidations; } }, runner: { clearCache: () => { ++cleared; } } },
    },
    httpServer: { once: (event, callback) => { assert.equal(event, "close"); closeCallback = callback; } },
  });
  const headers = new Map();
  let next = false;
  previewHeaders({}, { setHeader: (key, value) => headers.set(key, value) }, () => { next = true; });
  assert.equal(headers.get("X-Robots-Tag"), "noindex, nofollow");
  assert.equal(headers.get("Content-Security-Policy"), "script-src 'self' 'unsafe-inline'");
  assert.equal(next, true);
  watchCallback("change", "unrelated.json");
  assert.equal(invalidations, 0);
  watchCallback("rename", "data-store.json");
  assert.equal(invalidations, 2);
  assert.equal(cleared, 1);
  assert.equal(sent[0].type, "full-reload");
  errorCallback(new Error("watch failed"));
  assert.equal(sent[1].type, "error");
  assert.equal(sent[1].err.message, "watch failed");
  closeCallback();
  assert.equal(closed, 1);
});

test("validate actually invokes Astro check, wrapper build and generated-site checks with draft environment", async (t) => {
  const { runtime, container } = setup(t);
  await runtime.open(sources(), signal());
  const start = container.calls.length;
  await runtime.validate(signal());
  const validation = container.calls.slice(start);
  assert.deepEqual(validation.map(({ command }) => command), ["node", "node", "npm", "npm"]);
  assert.deepEqual(validation.map(({ args }) => args), [
    [".editor/validate.mjs", "check"],
    [".editor/validate.mjs", "build"],
    ["run", "check:generated"],
    ["run", "dev", "--", "--config", "editor.browser.config.mjs", "--host", "0.0.0.0", "--port", "4321"],
  ]);
  for (const { options } of validation) {
    assert.equal(options.env.ASTRO_SITE, "https://browser-draft.invalid");
    assert.equal(Object.hasOwn(options.env, "ASTRO_BASE_PATH"), false);
    assert.equal(options.env.PUBLIC_BROWSER_DRAFT, "true");
    assert.equal(options.env.NAPI_RS_FORCE_WASI, "true");
    assert.equal(Object.hasOwn(options.env, "PUBLIC_EDITOR_PARENT_ORIGIN"), false);
  }
  assert.equal(container.installs, 1);
});

test("identical mounted sources reuse the healthy Astro process without reinstalling or clearing generated caches", async t => {
  const { runtime, container, observed } = setup(t);
  container.previewBase = "/site-web";
  const files = sources();
  const url = await runtime.open(files, signal());
  const calls = container.calls.length, mutations = container.mutations.length;
  const server = container.servers[0].process;
  container.files.set(".astro/data-store.json", encode("keep generated cache"));
  files.set(".editor/requests/new-pr.json", encode('{"title":"Technical request"}'));
  files.set("src/editor/client.ts", encode("protected editor code is not mounted"));
  assert.equal(await runtime.open(files, signal()), url);
  assert.equal(container.calls.length, calls);
  assert.equal(container.mutations.length, mutations);
  assert.equal(container.servers.length, 1);
  assert.equal(server.killed, 0);
  assert.equal(decode(container.files.get(".astro/data-store.json")), "keep generated cache");
  assert.equal(container.installs, 1);
  assert.equal(observed.boots, 1);
  assert.deepEqual(observed.urls, [url, url]);
  assert.match(observed.logs.join(""), /serveur Astro actif réutilisé/);
});

test("every mounted content, binary, addition and deletion change restarts Astro while keeping locked dependencies", async t => {
  const { runtime, container } = setup(t);
  let files = sources();
  await runtime.open(files, signal());
  const variants = [
    { "src/content/home.json": '{"title":"Changed"}' },
    { "public/assets/photo.webp": new Uint8Array([0, 255, 129, 32, 0]) },
    { "src/pages/new.astro": "<h1>New</h1>" },
    { "src/pages/new.astro": null },
  ];
  for (const change of variants) {
    files = new Map(files);
    for (const [path, content] of Object.entries(change)) {
      if (content === null) files.delete(path);
      else files.set(path, typeof content === "string" ? encode(content) : content);
    }
    const previous = container.servers.at(-1).process;
    const servers = container.servers.length;
    await runtime.open(files, signal());
    assert.ok(previous.killed > 0);
    assert.equal(container.servers.length, servers + 1);
    assert.equal(container.installs, 1);
  }
});

test("direct runtime writes and rollback cannot bypass a fresh Astro process even if tracked bytes match", async t => {
  const { runtime, container } = setup(t);
  const files = sources(), path = "src/content/home.json";
  await runtime.open(files, signal());
  const edited = encode('{"title":"Live edit"}');
  await runtime.write(path, edited);
  files.set(path, edited);
  await runtime.open(files, signal());
  assert.equal(container.servers.length, 2);
  assert.ok(container.servers[0].process.killed > 0);
  await runtime.write(path, encode('{"title":"Temporary"}'));
  await runtime.write(path, edited);
  await runtime.open(files, signal());
  assert.equal(container.servers.length, 3);
  assert.ok(container.servers[1].process.killed > 0);
});

test("cancelled reopen does not advertise readiness or mutate an unchanged live server", async t => {
  const { runtime, container, observed } = setup(t);
  const files = sources();
  await runtime.open(files, signal());
  const calls = container.calls.length, urls = observed.urls.length;
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(runtime.open(files, abort.signal), { name: "AbortError" });
  assert.equal(container.calls.length, calls);
  assert.equal(observed.urls.length, urls);
  assert.equal(container.servers[0].process.killed, 0);
});

test("an exited or torn-down server can never be reused from matching source bytes", async t => {
  const first = new FakeContainer(), second = new FakeContainer();
  let boots = 0;
  const { runtime, observed } = setup(t, { boot: async () => ++boots === 1 ? first : second });
  await runtime.open(sources(), signal());
  first.servers[0].process.finish(7);
  await until(() => first.teardownCount === 1);
  await runtime.open(sources(), signal());
  assert.equal(boots, 2);
  assert.equal(second.servers.length, 1);
  assert.equal(second.installs, 1);
  assert.match(observed.errors.join(""), /inattendue.*code 7/);
});

test("preview opens the repository's actual prefix instead of breaking its existing local links", async (t) => {
  const { runtime, container, observed } = setup(t);
  container.previewBase = "/site-web";
  assert.equal(await runtime.open(sources(), signal()), "https://runtime.test/site-web/");
  assert.equal(observed.urls.at(-1), "https://runtime.test/site-web/");
});

test("invalid preview base evidence fails explicitly before exposing an iframe", async (t) => {
  const { runtime, container, observed } = setup(t);
  container.previewBase = "//foreign.test";
  await assert.rejects(runtime.open(sources(), signal()), /base de l’aperçu Astro est invalide/);
  assert.deepEqual(observed.urls, []);
});

test("browser validators exit only after official SDK results and diagnostics, never after printed success", async (t) => {
  const { runtime, container } = setup(t);
  await runtime.prepare(sources(), signal());
  const script = decode(container.files.get(".editor/validate.mjs"))
    .replace('import { build, sync } from "astro";', "")
    .replace('import { check } from "@astrojs/check";', "");
  for (const [mode, failed, expected] of [["check", false, 0], ["check", true, 1], ["check", undefined, 1], ["build", false, 0], ["build", true, 1]]) {
    const trace = [], errors = [];
    let finish;
    const pending = new Promise(resolve => { finish = resolve; });
    const config = value => assert.equal(value.configFile, "editor.browser.config.mjs");
    const context = {
      sync: async value => { config(value); trace.push("sync"); },
      check: async value => { assert.equal(value.watch, false); trace.push("check"); await pending; return failed; },
      build: async value => { config(value); trace.push("build"); await pending; if (failed) throw new Error("Invalid site"); },
      console: { error: error => errors.push(error.message) },
      process: {
        argv: ["node", ".editor/validate.mjs", mode], env: {},
        stdout: { write: (text, callback) => { assert.equal(text, ""); trace.push("stdout"); callback(); } },
        stderr: { write: (text, callback) => { assert.equal(text, ""); trace.push("stderr"); callback(); } },
        exit: code => trace.push(`exit:${code}`),
      },
    };
    const result = runInNewContext(`(async () => { ${script} })()`, context);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(trace.some(value => value.startsWith("exit:")), false);
    finish();
    await result;
    assert.deepEqual(trace, [...(mode === "check" ? ["sync", "check"] : ["build"]), "stdout", "stderr", `exit:${expected}`]);
    assert.equal(context.process.env.NODE_ENV, "production");
    assert.equal(errors.length, mode === "check" && failed === undefined || mode === "build" && failed ? 1 : 0);
  }
});

test("an exited browser command can leave output open without stalling or hiding a nonzero exit", async (t) => {
  for (const code of [0, 9]) {
    const { runtime, container, observed } = setup(t, { timeoutMs: 3_000 });
    await runtime.open(sources(), signal());
    let command;
    container.onSpawn = ({ args, process }) => {
      if (args[0] !== ".editor/validate.mjs" || args[1] !== "check") return;
      command = process;
      process.leaveOutputOpen = true;
      process.stream.enqueue("Real diagnostics\n");
      return code;
    };
    if (code === 0) {
      await runtime.validate(signal());
      assert.equal(observed.stages.at(-1), "Vérification terminée");
      assert.ok(container.calls.some(({ args }) => args.includes("check:generated")));
    } else {
      await assert.rejects(runtime.validate(signal()), /a échoué \(code 9\)/);
      assert.notEqual(observed.stages.at(-1), "Vérification terminée");
      assert.equal(container.calls.some(({ args }) => args.includes("check:generated")), false);
    }
    assert.equal(command.outputCancelled, true);
    assert.equal(command.killed, 0);
    assert.match(observed.logs.join(""), /Real diagnostics/);
    assert.match(observed.logs.join(""), /fermeture du flux encore ouvert/);
    runtime.stop();
  }
});

test("browser process environment uses only the current exact parent origin when location exists", async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "location");
  Object.defineProperty(globalThis, "location", { value: { origin: "https://editor.example:8443" }, configurable: true });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "location", previous);
    else delete globalThis.location;
  });
  const { runtime, container } = setup(t);
  await runtime.prepare(sources(), signal());
  for (const { options } of container.calls) assert.equal(options.env.PUBLIC_EDITOR_PARENT_ORIGIN, "https://editor.example:8443");
  const middleware = decode(container.files.get(".editor/preview-middleware.mjs"))
    .replace('import { defineMiddleware } from "astro:middleware";', "")
    .replace("export const onRequest", "globalThis.onRequest");
  const listeners = new Map(), sent = [];
  const context = {
    defineMiddleware: handler => handler,
    process: { env: { PUBLIC_EDITOR_PARENT_ORIGIN: "https://editor.example:8443" } },
    Headers, Response, URL,
    location: { pathname: "/site-web/contact/" },
    window: {
      addEventListener: (event, listener) => listeners.set(event, listener),
      parent: { postMessage: (value, origin) => sent.push({ value, origin }) },
    },
    document: { addEventListener: (event, listener) => listeners.set(event, listener) },
  };
  runInNewContext(middleware, context);
  const originalHtml = "<!doctype html><html><head><title>Old branch</title></head><body><h1>Contact</h1></body></html>";
  const response = await context.onRequest({}, async () => new Response(originalHtml, {
    headers: { "content-type": "text/html", "content-length": "999", "x-preserved": "yes" },
  }));
  assert.equal(response.headers.get("content-length"), null);
  assert.equal(response.headers.get("x-preserved"), "yes");
  const html = await response.text();
  assert.equal(html.replace(/<script type="module">[\s\S]*?<\/script>/, ""), originalHtml);
  const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  runInNewContext(script, context);
  for (const event of ["load", "popstate", "astro:page-load"]) listeners.get(event)();
  assert.equal(sent.length, 3);
  for (const { value, origin } of sent) {
    assert.equal(origin, "https://editor.example:8443");
    assert.equal(value.type, "editor-preview-route");
    assert.equal(value.pathname, "/site-web/contact/");
  }
  const asset = new Response("not HTML", { headers: { "content-type": "text/css" } });
  assert.equal(await context.onRequest({}, async () => asset), asset);
  await assert.rejects(context.onRequest({}, async () => new Response("<html>", { headers: { "content-type": "text/html" } })), /fermeture head/);
});

test("installer and validation errors reject, are reported and do not claim ready or successful validation", async (t) => {
  const { runtime, container, observed } = setup(t);
  container.onSpawn = ({ args }) => args[0] === "ci" ? 2 : undefined;
  await assert.rejects(runtime.open(sources(), signal()), /npm ci a échoué \(code 2\)/);
  assert.deepEqual(observed.urls, []);
  assert.match(observed.errors[0], /npm ci/);
  container.onSpawn = undefined;
  await runtime.prepare(sources(), signal());
  assert.equal(container.installs, 2, "a failed installation is never cached");
  for (const failed of ["check", "build", "check:generated"]) {
    const start = container.calls.length;
    container.onSpawn = ({ args }) => args.includes(failed) ? 9 : undefined;
    await assert.rejects(runtime.validate(signal()), /a échoué \(code 9\)/);
    const checks = container.calls.slice(start).map(({ args }) => args.join(" "));
    assert.equal(checks.at(-1).includes(failed), true);
    assert.notEqual(observed.stages.at(-1), "Vérification terminée");
  }
});

test("real failed command diagnostics are bounded and passed to callers for source correction", async (t) => {
  const { runtime, container } = setup(t);
  await runtime.open(sources(), signal());
  container.onSpawn = ({ args, process }) => {
    if (!args.includes("build")) return;
    process.stream.enqueue("noise ".repeat(1200) + "\nCSS Invalid qualified rule: src/styles/global.css line 17");
    return 1;
  };
  await assert.rejects(runtime.validate(signal()), error => {
    assert.match(error.message, /CSS Invalid qualified rule: src\/styles\/global.css line 17/);
    assert.ok(error.message.length < 5200);
    return true;
  });
});

test("early and later unexpected server exits are failures, with readers and listeners cleaned up", async (t) => {
  const { runtime, container, observed } = setup(t);
  container.onSpawn = ({ args }) => args[0] === "run" && args[1] === "dev" ? 1 : undefined;
  await assert.rejects(runtime.open(sources(), signal()), /Astro s’est arrêté.*code 1/);
  assert.deepEqual(observed.urls, []);
  assert.equal(container.listeners.get("server-ready").size, 0);
  container.onSpawn = undefined;
  await runtime.open(sources(), signal());
  container.servers.at(-1).process.finish(3);
  await until(() => container.teardownCount === 1);
  assert.match(observed.errors.at(-1), /Astro s’est arrêté.*code 3/);
  assert.equal(container.listeners.get("error").size, 0);
});

test("a server-ready event followed by an immediate exit never yields a dead preview URL", async (t) => {
  const { runtime, container, observed } = setup(t);
  container.onSpawn = ({ args, process }) => {
    if (args[0] !== "run" || args[1] !== "dev") return;
    queueMicrotask(() => {
      container.emit("server-ready", 4321, "https://already-dead.test");
      process.finish(0);
    });
    return "hold";
  };
  await assert.rejects(runtime.open(sources(), signal()), /Astro s’est arrêté.*code 0/);
  assert.deepEqual(observed.urls, []);
});

test("output reader errors are not mistaken for successful commands", async (t) => {
  const { runtime, container, observed } = setup(t);
  container.onSpawn = ({ args, process }) => {
    if (args[0] !== "ci") return;
    queueMicrotask(() => process.failOutput(new Error("stream failed")));
    return "hold";
  };
  await assert.rejects(runtime.prepare(sources(), signal()), /Lecture du journal impossible.*stream failed/);
  assert.match(observed.errors.at(-1), /stream failed/);
  assert.ok(container.calls.find(({ args }) => args[0] === "ci").process.killed > 0);
});

test("server-ready timeouts reject and kill the server instead of inventing a URL", async (t) => {
  const { runtime, container, observed } = setup(t, { timeout: 100 });
  container.automaticReady = false;
  await assert.rejects(runtime.open(sources(), signal()), /port 4321 : délai dépassé/);
  assert.deepEqual(observed.urls, []);
  assert.ok(container.servers[0].process.killed > 0);
  assert.equal(container.listeners.get("server-ready").size, 0);
  assert.match(observed.errors.at(-1), /délai dépassé/);
});

test("stalled installers time out, are killed and never enter the dependency cache", async (t) => {
  const { runtime, container, observed } = setup(t, { timeout: 100 });
  container.onSpawn = ({ args }) => args[0] === "ci" ? "hold" : undefined;
  await assert.rejects(runtime.prepare(sources(), signal()), /npm ci : délai dépassé/);
  assert.ok(container.calls.find(({ args }) => args[0] === "ci").process.killed > 0);
  assert.match(observed.errors.at(-1), /npm ci : délai dépassé/);
  container.onSpawn = undefined;
  await runtime.prepare(sources(), signal());
  assert.equal(container.installs, 2);
});

test("aborted installers are killed; a later branch reinstalls and receives no old readiness events", async (t) => {
  const { runtime, container, observed } = setup(t);
  container.onSpawn = ({ args }) => args[0] === "ci" ? "hold" : undefined;
  const controller = new AbortController();
  const rejection = assert.rejects(runtime.open(sources(), controller.signal), { name: "AbortError" });
  await until(() => container.installs === 1);
  controller.abort();
  await rejection;
  assert.ok(container.calls.find(({ args }) => args[0] === "ci").process.killed > 0);
  assert.equal(container.teardownCount, 0, "a fully killed bounded command does not discard the container");
  assert.deepEqual(observed.urls, []);
  container.onSpawn = undefined;
  await runtime.open(sources({ "src/content/home.json": '{"title":"new branch"}' }), signal());
  assert.equal(container.installs, 2);
  assert.equal(decode(container.files.get("src/content/home.json")), '{"title":"new branch"}');
  assert.equal(observed.errors.length, 0, "normal cancellation is not a runtime failure");
});

test("cancellation during spawn still handles the late process promise without unhandled rejection", async (t) => {
  const { runtime, container, observed } = setup(t);
  const controller = new AbortController();
  container.onSpawn = ({ args }) => {
    if (args[0] === "ci") controller.abort();
  };
  await assert.rejects(runtime.open(sources(), controller.signal), { name: "AbortError" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(container.teardownCount, 1);
  assert.deepEqual(observed.urls, []);
  assert.deepEqual(observed.errors, []);
});

test("aborted boot is fenced: its late container is torn down before another boot", async (t) => {
  const first = new FakeContainer();
  const second = new FakeContainer();
  const pending = deferred();
  let boots = 0;
  const { runtime, observed } = setup(t, { boot: async () => ++boots === 1 ? pending.promise : second });
  const controller = new AbortController();
  const rejection = assert.rejects(runtime.open(sources(), controller.signal), { name: "AbortError" });
  await until(() => boots === 1);
  controller.abort();
  await rejection;
  const opened = runtime.open(sources(), signal());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(boots, 1);
  pending.resolve(first);
  assert.equal(await opened, "https://runtime.test");
  assert.equal(first.teardownCount, 1);
  assert.equal(first.calls.length, 0);
  assert.equal(boots, 2);
  assert.deepEqual(observed.urls, ["https://runtime.test"]);
});

test("stop followed immediately by open does not let old boot cleanup cancel the new request", async (t) => {
  const first = new FakeContainer();
  const second = new FakeContainer();
  const pending = deferred();
  let boots = 0;
  const { runtime } = setup(t, { boot: async () => ++boots === 1 ? pending.promise : second });
  const rejected = assert.rejects(runtime.open(sources(), signal()), { name: "AbortError" });
  await until(() => boots === 1);
  runtime.stop();
  const reopened = runtime.open(sources(), signal());
  pending.resolve(first);
  await rejected;
  assert.equal(await reopened, "https://runtime.test");
  assert.equal(first.teardownCount, 1);
  assert.equal(second.teardownCount, 0);
});

test("late process spawn after cancellation is killed in its old container, never adopted by the next branch", async (t) => {
  const first = new FakeContainer();
  const second = new FakeContainer();
  const pending = deferred();
  const spawn = first.spawn.bind(first);
  let waiting = false;
  first.spawn = async (command, args, options) => {
    if (args[0] === "ci") { waiting = true; return pending.promise; }
    return spawn(command, args, options);
  };
  let boots = 0;
  const { runtime, observed } = setup(t, { boot: async () => ++boots === 1 ? first : second });
  const controller = new AbortController();
  const rejected = assert.rejects(runtime.open(sources(), controller.signal), { name: "AbortError" });
  await until(() => waiting);
  controller.abort();
  await rejected;
  assert.equal(first.teardownCount, 1);
  await runtime.open(sources({ "src/content/home.json": "next branch" }), signal());
  const late = new FakeProcess();
  pending.resolve(late);
  await until(() => late.killed > 0);
  assert.deepEqual(observed.urls, ["https://runtime.test"]);
  assert.equal(decode(second.files.get("src/content/home.json")), "next branch");
});

test("non-cancellable filesystem work cannot write late into a different branch container", async (t) => {
  const first = new FakeContainer();
  const second = new FakeContainer();
  const pending = deferred();
  const mount = first.mount.bind(first);
  let mountStarted = false;
  let mountFinished = false;
  first.mount = async (tree) => {
    mountStarted = true;
    await pending.promise;
    await mount(tree);
    mountFinished = true;
  };
  let boots = 0;
  const { runtime } = setup(t, { boot: async () => ++boots === 1 ? first : second });
  const controller = new AbortController();
  const rejection = assert.rejects(runtime.open(sources({ "src/content/home.json": "old branch" }), controller.signal), { name: "AbortError" });
  await until(() => mountStarted);
  controller.abort();
  await rejection;
  assert.equal(first.teardownCount, 1);
  await runtime.open(sources({ "src/content/home.json": "new branch" }), signal());
  pending.resolve();
  await until(() => mountFinished);
  assert.equal(decode(first.files.get("src/content/home.json")), "old branch");
  assert.equal(decode(second.files.get("src/content/home.json")), "new branch");
  assert.equal(second.teardownCount, 0);
});

test("stop invalidates queued work and cleans process readers and all listeners", async (t) => {
  const { runtime, container, observed } = setup(t);
  container.onSpawn = ({ args }) => args[0] === "ci" ? "hold" : undefined;
  const first = assert.rejects(runtime.open(sources(), signal()), { name: "AbortError" });
  await until(() => container.installs === 1);
  const second = assert.rejects(runtime.open(sources({ "src/content/home.json": "queued branch" }), signal()), { name: "AbortError" });
  runtime.stop();
  await Promise.all([first, second]);
  assert.equal(container.teardownCount, 1);
  assert.equal(observed.boots, 1);
  assert.deepEqual(observed.urls, []);
  for (const { process } of container.calls) {
    assert.equal(process.output.locked, false, "all output readers must be released");
  }
  for (const listeners of container.listeners.values()) assert.equal(listeners.size, 0);
});

test("aborting validation kills the check and never proceeds to build or generated checks", async (t) => {
  const { runtime, container, observed } = setup(t);
  await runtime.prepare(sources(), signal());
  container.onSpawn = ({ args }) => args.includes("check") ? "hold" : undefined;
  const start = container.calls.length;
  const controller = new AbortController();
  const rejected = assert.rejects(runtime.validate(controller.signal), { name: "AbortError" });
  await until(() => container.calls.length > start);
  controller.abort();
  await rejected;
  assert.equal(container.calls.length, start + 1);
  assert.ok(container.calls.at(-1).process.killed > 0);
  assert.notEqual(observed.stages.at(-1), "Vérification terminée");
  assert.equal(container.teardownCount, 0);
});

test("only one WebContainer is owned at a time, including across runtime instances", async (t) => {
  const first = setup(t);
  const second = setup(t);
  await first.runtime.prepare(sources(), signal());
  await assert.rejects(second.runtime.prepare(sources(), signal()), /Un autre environnement/);
  assert.equal(second.observed.boots, 0);
  first.runtime.stop();
  await second.runtime.prepare(sources(), signal());
  assert.equal(second.observed.boots, 1);
});

test("default boot rejects incompatible browser prerequisites before importing or booting the SDK", async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else delete globalThis.window;
  });
  for (const [override, message] of [
    [{ isSecureContext: false }, /HTTPS/],
    [{ location: { protocol: "file:", hostname: "" } }, /HTTPS/],
    [{ crossOriginIsolated: false }, /Isolation absente/],
    [{ navigator: { userAgent: "Mozilla/5.0 Safari/605.1" } }, /Chrome ou Edge sur ordinateur/],
    [{ navigator: { userAgent: "Mozilla/5.0 Firefox/142.0" } }, /Chrome ou Edge sur ordinateur/],
    [{ navigator: { userAgent: "Mozilla/5.0 Android Chrome/142.0 Mobile" } }, /Chrome ou Edge sur ordinateur/],
  ]) {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        isSecureContext: true, crossOriginIsolated: true,
        location: { protocol: "https:", hostname: "editor.test" },
        navigator: { userAgent: "Mozilla/5.0 Chrome/142.0" }, ...override,
      },
    });
    const errors = [];
    const runtime = new BrowserRuntime({ stage() {}, log() {}, ready() {}, error: (message) => errors.push(message) });
    await assert.rejects(runtime.prepare(sources(), signal()), message);
    assert.equal(errors.length, 1);
    runtime.stop();
  }
});

test("internal WebContainer errors tear down the unusable instance and are surfaced", async (t) => {
  const { runtime, container, observed } = setup(t);
  await runtime.open(sources(), signal());
  container.emit("error", { message: "storage disconnected" });
  assert.equal(container.teardownCount, 1);
  assert.match(observed.errors.at(-1), /WebContainer.*storage disconnected/);
  for (const listeners of container.listeners.values()) assert.equal(listeners.size, 0);
});
