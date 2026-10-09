import assert from "node:assert/strict";
import { test } from "node:test";
import { zipSync } from "fflate";
import { EditorController } from "../src/editor/controller.ts";
import { BrowserStorage } from "../src/editor/workspace.ts";
import { EditorApiError } from "../src/editor/github.ts";

const bytes = value => new TextEncoder().encode(value);
const sha = "a".repeat(40), head = "b".repeat(40), saved = "c".repeat(40);
const path = "src/content/home.json";
const files = () => new Map([["package.json", bytes("{}")], ["package-lock.json", bytes("{}")], ["src/pages/index.astro", bytes("<h1>Accueil</h1>")], [path, bytes('{"title":"Accueil"}')]]);
const pull = () => ({ number: 1, title: "[Editor][test] Titre", url: "https://github.com/FederationChasseVendee/site-web-fdc85/pull/1", headRef: "editor/test", headSha: head, author: "test", updatedAt: "2026-01-01T00:00:00Z", draft: true });

class MemoryStorage extends BrowserStorage {
  snapshots = new Map();
  drafts = new Map();
  constructor() { super("test"); }
  async cached(sha) { return this.snapshots.get(sha) ?? null; }
  async cache(sha, files) { this.snapshots.set(sha, new Map(files)); }
  async draftRecord(ref, record) {
    if (record === null) this.drafts.delete(ref);
    else if (record !== undefined) this.drafts.set(ref, structuredClone(record));
    return structuredClone(this.drafts.get(ref));
  }
}

function fixture(enabled = true) {
  const storage = new MemoryStorage();
  storage.snapshots.set(sha, files());
  const calls = [];
  const notices = [];
  let remote = pull();
  const repository = {
    status: async () => ({ configured: true, authenticated: true, canWrite: true, user: { login: "test", avatarUrl: "" }, repository: { fullName: "FederationChasseVendee/site-web-fdc85", defaultBranch: "main", defaultSha: sha } }),
    listPulls: async () => [remote], getPull: async () => remote,
    createPull: async (title, id) => { calls.push(["create", title, id]); return remote; },
    archive: async () => { calls.push(["archive"]); return new Response(zipSync(Object.fromEntries([...files()].map(([path, content]) => [`repo/${path}`, content])))); },
    changes: async (from, selected) => { calls.push(["changes", from, selected.headSha]); return []; },
    save: async (selected, changes, id) => { calls.push(["save", selected.headSha, changes, id]); remote = { ...remote, headSha: saved }; return { ...remote, savedSha: saved }; },
    close: async () => { calls.push(["close"]); },
    checks: async () => ({ sha: remote.headSha, state: "success", message: "Contrôles réussis", mergeable: true }),
    merge: async () => { calls.push(["merge"]); return { merged: true, sha: saved, message: "Fusionnée" }; },
    deployment: async () => ({ state: "pending", message: "En attente" }),
    logout: async () => { calls.push(["logout"]); },
  };
  const runtime = {
    prepare: async () => { calls.push(["prepare"]); },
    open: async () => { calls.push(["open"]); return "https://preview.test/"; },
    write: async (path, content) => { calls.push(["write", path, content]); },
    validate: async () => { calls.push(["validate"]); },
    stop() { calls.push(["stop"]); },
  };
  const controller = new EditorController(repository, runtime, { change() {}, progress() {}, error: message => notices.push(message), notice: message => notices.push(message) }, enabled, () => storage);
  return { controller, repository, runtime, storage, calls, notices };
}

async function open(f) { await f.controller.initialize(); await f.controller.select(pull()); }
async function edit(f, title = "Nouveau") {
  const actions = [{ action: "read", path }, { action: "edit", target: "/title", text: title }, { action: "done", text: "Titre modifié." }];
  await f.controller.chat("Modifie le titre", async () => JSON.stringify(actions.shift()));
}

test("authenticated startup preloads main and PR selection uses exact-SHA delta", async t => {
  const f = fixture(); t.after(() => f.controller.dispose());
  await open(f);
  assert.deepEqual(f.calls.slice(0, 3).map(call => call[0]), ["prepare", "changes", "open"]);
  assert.equal(f.calls.find(call => call[0] === "changes")[2], head);
  assert.equal(f.controller.runtimeReady, true);
});
test("preview initializes its actual base route and preserves navigation only within that base", async t => {
  const f = fixture(); t.after(() => f.controller.dispose());
  f.runtime.open = async () => "https://preview.test/site-web/";
  await open(f);
  assert.equal(f.controller.route, "/site-web/");
  assert.equal(new URL(f.controller.route, f.controller.previewUrl).href, "https://preview.test/site-web/");
  f.controller.route = "/site-web/contact/";
  f.controller.preview("https://preview.test/site-web/");
  assert.equal(f.controller.route, "/site-web/contact/");
  f.controller.preview("https://preview.test/another-base/");
  assert.equal(f.controller.route, "/another-base/");
});
test("no write permission performs no checkout or runtime preparation", async t => {
  const f = fixture(); t.after(() => f.controller.dispose());
  f.repository.status = async () => ({ configured: true, authenticated: true, canWrite: false, user: { login: "test" }, repository: { defaultSha: sha } });
  await f.controller.initialize();
  assert.equal(f.calls.length, 0);
  await assert.rejects(f.controller.select(pull()), /écriture/);
});
test("only explicit delta conflicts/size failures fall back to an archive", async t => {
  const f = fixture(); t.after(() => f.controller.dispose());
  f.repository.changes = async () => { throw new EditorApiError("Divergence", 409); };
  await open(f);
  assert.ok(f.calls.some(call => call[0] === "archive"));
  f.storage.snapshots.delete(head);
  f.repository.changes = async () => { throw new EditorApiError("Session expirée", 401); };
  const downloads = f.calls.filter(call => call[0] === "archive").length;
  await assert.rejects(f.controller.select(pull()), /expirée/);
  assert.equal(f.calls.filter(call => call[0] === "archive").length, downloads);
});
test("local edits require validation and save commits to the selected SHA only", async t => {
  const f = fixture(); t.after(() => f.controller.dispose()); await open(f); await edit(f);
  assert.equal(f.controller.canPublish, false);
  assert.equal(f.calls.some(call => call[0] === "save" || call[0] === "merge"), false);
  await f.controller.save();
  const call = f.calls.find(call => call[0] === "save");
  assert.equal(call[1], head); assert.equal(call[2][0].path, path);
  assert.equal(f.controller.workspace.sha, saved); assert.equal(f.controller.workspace.dirty, false);
  assert.equal(f.controller.canPublish, true);
  await f.controller.undo();
  assert.equal(f.controller.workspace.dirty, true);
  assert.equal(f.controller.canPublish, false);
});
test("an ambiguous save retries with the same idempotency identifier", async t => {
  const f = fixture(); t.after(() => f.controller.dispose()); await open(f); await edit(f);
  const ids = [];
  const actualSave = f.repository.save;
  f.repository.save = async (...args) => { ids.push(args[2]); if (ids.length === 1) throw new Error("Réseau interrompu"); return actualSave(...args); };
  await assert.rejects(f.controller.save(), /interrompu/);
  await f.controller.save();
  assert.equal(ids.length, 2); assert.equal(ids[0], ids[1]);
});
test("merge is explicit, rechecks the SHA, and deployment is not reported as success", async t => {
  const f = fixture(); t.after(() => f.controller.dispose()); await open(f);
  assert.equal(f.calls.some(call => call[0] === "merge"), false);
  f.repository.checks = async () => ({ sha: saved, state: "success", message: "Autre SHA", mergeable: true });
  await assert.rejects(f.controller.publish(), /plus prête/);
  assert.equal(f.calls.some(call => call[0] === "merge"), false);
  await f.controller.select(pull());
  f.repository.checks = async () => ({ sha: head, state: "success", message: "Réussi", mergeable: true });
  await f.controller.refreshChecks(); f.controller.remoteChanged = false;
  await f.controller.publish();
  assert.equal(f.controller.published, true); assert.equal(f.controller.deployment.state, "pending");
  assert.equal(f.controller.canPublish, false);
});
test("license gate never boots a runtime or presents a ready preview", async t => {
  const f = fixture(false); t.after(() => f.controller.dispose());
  await assert.rejects(open(f), /licence/);
  assert.equal(f.controller.runtimeReady, false);
  assert.equal(f.calls.some(call => ["prepare", "open"].includes(call[0])), false);
});
test("abandon preserves the draft, closes the PR, and never merges", async t => {
  const f = fixture(); t.after(() => f.controller.dispose()); await open(f); await edit(f);
  await f.controller.abandon(f.controller.pull);
  assert.equal(f.controller.pull, null);
  assert.equal((await f.storage.exportDraft("editor/test")).changes.length, 1);
  assert.equal(f.calls.some(call => call[0] === "close"), true);
  assert.equal(f.calls.some(call => call[0] === "merge"), false);
});
test("draft restoration rebases only files whose baseline did not change remotely", async t => {
  const f = fixture(); t.after(() => f.controller.dispose()); await open(f); await edit(f);
  f.repository.getPull = async () => ({ ...pull(), headSha: saved });
  f.storage.snapshots.set(saved, files());
  await f.controller.select(pull());
  assert.equal(f.controller.conflicted, false);
  assert.equal(f.controller.workspace.text(path), '{"title":"Nouveau"}');
  assert.equal(f.controller.workspace.dirty, true);
});
test("same-file conflicts are preserved, exportable, and require explicit discard", async t => {
  const f = fixture(); t.after(() => f.controller.dispose()); await open(f); await edit(f);
  const remote = files(); remote.set(path, bytes('{"title":"Distant"}'));
  f.repository.getPull = async () => ({ ...pull(), headSha: saved });
  f.storage.snapshots.set(saved, remote);
  await f.controller.select(pull());
  assert.equal(f.controller.conflicted, true);
  assert.equal(f.controller.workspace.text(path), '{"title":"Distant"}');
  const backup = await f.controller.exportDraft();
  assert.equal(backup.changes[0].content, '{"title":"Nouveau"}');
  await assert.rejects(f.controller.save(), /conflit/);
  await f.controller.discardConflict();
  assert.equal(f.controller.conflicted, false);
  assert.equal((await f.storage.exportDraft("editor/test")).changes.length, 0);
});
test("a committed ambiguous save is recognized without repeating the changes", async t => {
  const f = fixture(); t.after(() => f.controller.dispose()); await open(f); await edit(f);
  const remote = files(); remote.set(path, bytes('{"title":"Nouveau"}'));
  f.repository.getPull = async () => ({ ...pull(), headSha: saved });
  f.storage.snapshots.set(saved, remote);
  await f.controller.select(pull());
  assert.equal(f.controller.conflicted, false);
  assert.equal(f.controller.workspace.dirty, false);
});
test("actions are serialized while an edit is running", async t => {
  const f = fixture(); t.after(() => f.controller.dispose()); await open(f);
  let release, calls = 0;
  const pending = f.controller.chat("Question", async () => {
    if (calls++ === 0) {
      await new Promise(resolve => { release = resolve; });
      return JSON.stringify({action:"read",path});
    }
    return '{"action":"done","text":"Sans changement."}';
  });
  await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(f.controller.leave(), /opération/);
  release(); await pending; assert.equal(f.controller.busy, false);
});
test("recovered saves never label stale bytes with a newer author's head SHA", async t => {
  const f = fixture(); t.after(() => f.controller.dispose()); await open(f); await edit(f);
  const newer = "d".repeat(40);
  const remote = files(); remote.set(path, bytes('{"title":"Après notre sauvegarde"}'));
  f.storage.snapshots.set(newer, remote);
  f.repository.save = async () => ({ ...pull(), headSha: newer, savedSha: saved });
  f.repository.getPull = async () => ({ ...pull(), headSha: newer });
  f.repository.checks = async () => ({ sha: newer, state: "success", message: "Réussi", mergeable: true });
  await f.controller.save();
  assert.equal(f.controller.workspace.sha, newer);
  assert.equal(f.controller.workspace.text(path), '{"title":"Après notre sauvegarde"}');
  assert.equal(new TextDecoder().decode((await f.storage.cached(newer)).get(path)), '{"title":"Après notre sauvegarde"}');
  assert.equal(new TextDecoder().decode((await f.storage.cached(saved)).get(path)), '{"title":"Nouveau"}');
});
test("late deployment results cannot overwrite another selected workspace", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture(); t.after(() => f.controller.dispose()); await open(f);
  let release, requests = 0;
  f.repository.deployment = async () => {
    if (++requests === 1) return { state: "pending", message: "En attente" };
    return new Promise(resolve => { release = resolve; });
  };
  await f.controller.publish();
  t.mock.timers.tick(20000);
  await f.controller.leave(); await f.controller.select(pull());
  release({ state: "success", message: "Ancienne PR déployée" });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.controller.deployment, null);
  assert.equal(f.controller.published, false);
});
