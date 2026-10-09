import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as fflate from "fflate";
import * as contracts from "../src/editor/contracts.ts";
import * as policy from "../src/editor/policy.ts";
import { EditorController } from "../src/editor/controller.ts";

const source = readFileSync(new URL("../src/editor/client.ts", import.meta.url), "utf8");
const script = ts.transpileModule(source.replaceAll("import.meta.env.BASE_URL", '"/"'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

async function fixture(t) {
  const nodes = new Map();
  const navigations = [];
  let controller, hooks, runtimeHooks;
  class Element {
    hidden = true;
    disabled = false;
    textContent = "";
    value = "auto";
    dataset = {};
    classList = { toggle() {} };
    addEventListener() {}
    setAttribute() {}
    append() {}
    replaceChildren() {}
  }
  class Frame extends Element {
    value = "";
    contentWindow = {};
    get src() { return this.value; }
    set src(url) { this.value = new URL(url).href; navigations.push(this.value); }
  }
  const frame = new Frame();
  nodes.set("preview", frame);
  const document = {
    body: new Element(),
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, new Element());
      return nodes.get(id);
    },
    createElement: () => new Element(),
    addEventListener() {},
  };
  class Controller extends EditorController {
    constructor(...args) {
      super(...args);
      controller = this;
      hooks = args[2];
    }
  }
  class Repository {
    async status() { return { configured: true, authenticated: false, canWrite: false }; }
  }
  class Runtime {
    constructor(value) { runtimeHooks = value; }
    stop() {}
  }
  class Model {
    ready = true;
    gpuFailed = false;
    async load() {}
    stop() {}
  }
  const modules = {
    fflate,
    "./contracts.ts": contracts,
    "./policy.ts": policy,
    "./config.ts": { editorConfig: { runtimeEnabled: true } },
    "./controller.ts": { EditorController: Controller },
    "./github.ts": { GitHubRepository: Repository },
    "./runtime.ts": { BrowserRuntime: Runtime },
    "./model.ts": { CodeModel: Model },
  };
  runInNewContext(script, {
    exports: {},
    require(name) {
      assert.ok(Object.hasOwn(modules, name), `Unexpected client dependency: ${name}`);
      return modules[name];
    },
    document,
    window: { addEventListener() {} },
    HTMLElement: Element,
    HTMLButtonElement: Element,
    HTMLIFrameElement: Frame,
    HTMLTextAreaElement: Element,
    HTMLSelectElement: Element,
    HTMLDialogElement: Element,
    HTMLAnchorElement: Element,
    HTMLInputElement: Element,
    HTMLFormElement: Element,
    URL,
  }, { filename: "editor-client.js" });
  await new Promise(resolve => setImmediate(resolve));
  t.after(() => controller.dispose());
  controller.pull = {
    number: 1, title: "[Editor][test] Preview",
    url: "https://github.com/FederationChasseVendee/site-web-fdc85/pull/1",
  };
  controller.workspace = { messages: [], dirty: false, history: [] };
  return { controller, hooks, runtimeHooks, frame, navigations };
}

test("each actual server-ready reconnects the same iframe URL exactly once", async t => {
  const f = await fixture(t);
  const url = "https://preview.test/site-web/";
  f.runtimeHooks.ready(url);
  assert.deepEqual(f.navigations, [url]);
  f.controller.preview(url);
  f.hooks.change();
  f.controller.checks = { message: "Checks refreshed" };
  f.hooks.change();
  assert.deepEqual(f.navigations, [url], "open confirmation and renders must not reconnect");

  f.runtimeHooks.ready(url);
  f.controller.preview(url);
  f.hooks.change();
  assert.deepEqual(f.navigations, [url, url], "a real restart must reconnect despite an unchanged URL");
});

test("a server restart preserves the current route and deduplicates the open confirmation", async t => {
  const f = await fixture(t);
  const base = "https://preview.test/site-web/";
  f.runtimeHooks.ready(base);
  f.controller.route = "/site-web/contact/";
  f.hooks.change();
  const route = "https://preview.test/site-web/contact/";
  assert.equal(f.frame.src, route);

  f.runtimeHooks.ready(base);
  f.controller.preview(base);
  f.hooks.change();
  assert.equal(f.controller.route, "/site-web/contact/");
  assert.deepEqual(f.navigations, [base, route, route]);
});

test("a new preview origin consumes its server-ready revision without a second navigation", async t => {
  const f = await fixture(t);
  f.runtimeHooks.ready("https://first.test/site-web/");
  f.runtimeHooks.ready("https://second.test/site-web/");
  f.controller.preview("https://second.test/site-web/");
  f.hooks.change();
  assert.deepEqual(f.navigations, ["https://first.test/site-web/", "https://second.test/site-web/"]);
});
