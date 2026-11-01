import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildSnapshot, allowedSource, allowedAsset, adminHeaders } from "./browser-snapshot.mjs";
import { mountTree, previewRoute, changedDrafts, compatibility, browserConfig, runtimeEnvironment, wasmProjects } from "../src/admin/model.mjs";
import { BrowserRuntime } from "../src/admin/runtime.mjs";
import { rebaseInternalUrl, rebaseStaticRedirect, unicodeRedirects } from "../src/lib/base-links.mjs";
import { siteConfig } from "./site-config.mjs";

const snapshot = await buildSnapshot(process.cwd());
test("snapshot is allowlisted and contains original templates and lockfile, not credentials/admin/dependencies", () => {
  for (const path of [".env", ".git/config", "node_modules/astro/package.json", "src/pages/admin.astro", "src/admin/client.ts",
    "src/content/.env", "src/content/../../secrets.json", "src\\content\\site.json", "docs/private.json"]) {
    assert.equal(allowedSource(path), false, path);
    assert.equal(path in snapshot.files, false, path);
  }
  for (const path of ["src/templates/ArticlePage.astro", "src/lib/content.ts", "src/content/home.json", "package-lock.json"]) {
    assert.equal(allowedSource(path), true, path);
    assert.ok(snapshot.files[path], path);
  }
  assert.equal(allowedAsset("public/assets/photo.webp"), true);
  assert.equal(allowedAsset("public/assets/.env"), false);
  assert.equal(allowedAsset("public/assets/../secret.pdf"), false);
  assert.equal(allowedAsset("public/assets/code.js"), false);
  assert.equal(Object.keys(snapshot.files).some((path) => path.startsWith("public/assets/")), false);
  assert.ok(snapshot.assets.length > 200);
  assert.ok(snapshot.editors.some((group) => group.name === "articles" && group.files.length === 85));
});
test("binary favicon is mounted byte-for-byte, text UTF-8 survives", async () => {
  const tree = mountTree(snapshot);
  assert.deepEqual(Buffer.from(tree.public.directory["favicon.png"].file.contents), await readFile("public/favicon.png"));
  assert.equal(tree.src.directory.content.directory["home.json"].file.contents, snapshot.files["src/content/home.json"].contents);
});
test("preview routes follow original normalization, drafts keep actual allowlisted filenames", () => {
  const group = snapshot.editors.find((item) => item.name === "standardPages");
  assert.equal(previewRoute("src/content/standard-pages/Contact.md", group), "/contact/");
  assert.equal(previewRoute("src/content/home.json", snapshot.editors[0]), "/");
  assert.equal(previewRoute("src/content/documents/file.md", { name: "documents" }), "/");
  assert.deepEqual(changedDrafts({
    "src/content/home.json": "{}",
    "src/content/site.json": snapshot.files["src/content/site.json"].contents,
    "package.json": "no",
    ".env": "no",
  }, snapshot), { "src/content/home.json": "{}" });
});
test("headers isolate only admin; public assets get CORP without isolating public site", () => {
  for (const base of ["/", "/site-web/"]) {
    const headers = adminHeaders(base);
    assert.equal((headers.match(/Cross-Origin-Opener-Policy/g) ?? []).length, 3);
    assert.ok(!headers.startsWith("/*"));
    const prefix = base === "/" ? "" : "/site-web";
    assert.ok(headers.includes(`${prefix}/admin/\n`));
    assert.ok(headers.includes(`${prefix}/assets/*\n  Cross-Origin-Resource-Policy: cross-origin`));
  }
});
test("admin is not redirected to CMS, and hosting/local defaults retain explicit override precedence", async () => {
  assert.doesNotMatch(await readFile("public/_redirects", "utf8"), /^\/admin\/?\s/m);
  assert.deepEqual(siteConfig({}), { site: "https://federationchassevendee.github.io", base: "/site-web" });
  assert.deepEqual(siteConfig({ CF_PAGES: "1" }), { site: "https://fdc85.maury.app", base: "/" });
  assert.equal(siteConfig({ CF_PAGES_BRANCH: "test" }).base, "/");
  assert.equal(siteConfig({ CF_PAGES: "1", ASTRO_BASE_PATH: "/custom", ASTRO_SITE: "https://example.org" }).base, "/custom");
});
test("WASI artifacts match the lockfile and incompatible bridge generations remain scoped", () => {
  const projects = wasmProjects(snapshot);
  assert.equal(projects.length, 3);
  assert.equal(JSON.parse(projects[0].manifest).dependencies["@emnapi/core"], "2.0.0-alpha.5");
  assert.equal(JSON.parse(projects[1].manifest).dependencies["@emnapi/core"], "1.11.1");
  assert.equal(JSON.parse(projects[2].manifest).dependencies["@emnapi/runtime"], "1.11.1");
  for (const project of projects) {
    const manifest = JSON.parse(project.manifest);
    assert.equal(manifest.dependencies["@emnapi/core"], manifest.dependencies["@emnapi/runtime"]);
    assert.ok(/^\d+\.\d+\.\d+$/.test(manifest.dependencies[project.package]));
  }
});
test("explicit compatibility failures and isolated runtime environment/base/media", () => {
  const env = { secure: true, isolated: true, sharedMemory: true, userAgent: "Chrome/150.0 Safari/537.36" };
  assert.equal(compatibility(env), null);
  assert.match(compatibility({ ...env, isolated: false }), /COOP/);
  assert.match(compatibility({ ...env, secure: false }), /HTTPS/);
  assert.match(compatibility({ ...env, userAgent: "Firefox/140" }), /Firefox/);
  assert.match(compatibility({ ...env, userAgent: "Version/17.1 Safari/605.1" }), /Safari/);
  assert.equal(runtimeEnvironment.ASTRO_BASE_PATH, "/");
  assert.equal(runtimeEnvironment.PUBLIC_BROWSER_DRAFT, "true");
  const config = browserConfig(snapshot, "https://example.org/site-web/");
  assert.ok(config.includes("https://example.org/site-web/"));
  assert.ok(config.includes('base: "/"'));
  assert.ok(config.includes('host: "0.0.0.0"'));
});
test("Markdown and static redirects resolve under Cloudflare root and legacy base", () => {
  for (const base of ["/", "/site-web/"]) {
    assert.equal(rebaseInternalUrl("/site-web/contact/?q=1#test", base), `${base}contact/?q=1#test`);
    assert.equal(rebaseInternalUrl(`${base}contact/`, base), `${base}contact/`);
    assert.equal(rebaseInternalUrl("https://example.org/file", base), "https://example.org/file");
    assert.equal(rebaseInternalUrl("//example.org/file", base), "//example.org/file");
    const html = rebaseStaticRedirect('<link href="https://federationchassevendee.github.io/site-web/actualites/"><meta content="0; url=/site-web/actualites/"><a href="/site-web/actualites/">', "https://example.org", base);
    assert.ok(html.includes(`href="https://example.org${base}actualites/"`));
    assert.ok(html.includes(`content="0; url=${base}actualites/"`));
  }
  const tree = mountTree(snapshot);
  for (const path of unicodeRedirects) {
    const html = tree.public.directory[path].directory["index.html"].file.contents;
    assert.ok(!html.includes("/site-web/"));
    assert.ok(html.includes("https://browser-draft.invalid/"));
  }
});

function fakeRuntime({ installCode = 0, serverCode, noReady = false, bootFailure = false } = {}) {
  const events = new Map();
  const calls = [];
  const errors = [];
  let tornDown = 0;
  const container = {
    fs: { writeFile: async (path, content) => calls.push(["write", path, content]),
      readFile: async (path) => path === "compiler-proof.json" ? '{"ready":true}' : '{"node":"22.20.0","webcontainer":"1"}',
      mkdir: async () => {} },
    mount: async (tree) => calls.push(["mount", tree]),
    teardown: () => ++tornDown,
    on: (event, listener) => { events.set(event, listener); return () => events.delete(event); },
    spawn: async (command, args, options) => {
      calls.push([command, args, options]);
      const isServer = command === "npm" && args[0] === "run";
      if (isServer && !noReady && serverCode === undefined) setTimeout(() => events.get("server-ready")?.(4321, "https://local.webcontainer.io"), 1);
      return {
        output: new ReadableStream({ start(controller) { controller.enqueue("real logs"); controller.close(); } }),
        exit: isServer && serverCode === undefined ? new Promise(() => {})
          : Promise.resolve(isServer ? serverCode : command === "node" ? 0 : installCode),
        kill: () => calls.push(["kill"]),
      };
    },
  };
  const runtime = new BrowserRuntime({
    boot: async () => { if (bootFailure) throw new Error("vendor unreachable"); return container; },
    stage: (stage) => calls.push(["stage", stage]),
    log: (text) => calls.push(["log", text]),
    ready: (url) => calls.push(["ready", url]),
    error: (message) => errors.push(message),
    timeout: 30,
  });
  return { runtime, events, calls, errors, tornDown: () => tornDown };
}
test("lifecycle installs before serving, captures logs, readiness and write/stop", async () => {
  const { runtime, calls, errors, tornDown, events } = fakeRuntime();
  await runtime.start(snapshot, "https://example.org/", { "src/content/home.json": "{}" });
  assert.equal(runtime.ready, true);
  assert.deepEqual(errors, []);
  const installIndex = calls.findIndex(([cmd, args]) => cmd === "npm" && args[0] === "install");
  const serverIndex = calls.findIndex(([cmd, args]) => cmd === "npm" && args[0] === "run");
  assert.ok(installIndex < serverIndex);
  assert.ok(calls.some(([cmd]) => cmd === "log"));
  await runtime.write("src/content/home.json", '{"hero":{}}');
  await assert.rejects(runtime.write("package.json", "{}"), /non éditable/);
  runtime.stop();
  assert.equal(tornDown(), 1);
  assert.equal(runtime.ready, false);
  assert.equal(events.size, 0);
  await assert.rejects(runtime.write("file", "draft"), /pas prêt/);
});
test("npm, boot, premature server exit and timeout failures never become ready", async () => {
  for (const options of [{ installCode: 1 }, { bootFailure: true }, { serverCode: 2 }, { noReady: true }]) {
    const { runtime, calls, errors } = fakeRuntime(options);
    await runtime.start(snapshot, "https://example.org/", {});
    assert.equal(runtime.ready, false);
    assert.equal(runtime.busy, false);
    assert.equal(runtime.container, null);
    assert.equal(calls.some(([cmd]) => cmd === "ready"), false);
    assert.ok(errors.length);
  }
});
test("late boot after cancellation is torn down and concurrent startup is guarded", async () => {
  const fake = fakeRuntime();
  const boot = fake.runtime.hooks.boot;
  let resolveBoot;
  fake.runtime.hooks.boot = () => new Promise((resolve) => { resolveBoot = resolve; });
  const startup = fake.runtime.start(snapshot, "https://example.org/", {});
  await assert.rejects(fake.runtime.start(snapshot, "https://example.org/", {}), /déjà actif/);
  fake.runtime.stop();
  resolveBoot(await boot());
  await startup;
  assert.equal(fake.tornDown(), 1);
  assert.equal(fake.runtime.ready, false);
});
test("an old Node runtime or missing WASI proof cannot produce a success state", async () => {
  for (const proof of ['{"node":"20.0.0","webcontainer":"1"}', '{"node":"22.20.0"}']) {
    const fake = fakeRuntime();
    const boot = fake.runtime.hooks.boot;
    fake.runtime.hooks.boot = async () => {
      const container = await boot();
      container.fs.readFile = async () => proof;
      return container;
    };
    await fake.runtime.start(snapshot, "https://example.org/", {});
    assert.equal(fake.runtime.ready, false);
    assert.match(fake.errors[0], /Node 22.12/);
  }
  const fake = fakeRuntime();
  const boot = fake.runtime.hooks.boot;
  fake.runtime.hooks.boot = async () => {
    const container = await boot();
    container.fs.readFile = async (path) => path === "compiler-proof.json"
      ? '{"ready":false}' : '{"node":"22.20.0","webcontainer":"1"}';
    return container;
  };
  await fake.runtime.start(snapshot, "https://example.org/", {});
  assert.equal(fake.runtime.ready, false);
  assert.match(fake.errors[0], /WASI n’a pas été confirmé/);
});
