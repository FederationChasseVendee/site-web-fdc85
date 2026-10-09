import assert from "node:assert/strict";
import { test } from "node:test";
import { zipSync } from "fflate";
import { LocalWorkspace, applyChanges, readArchive } from "../src/editor/workspace.ts";
import { fileHash } from "../src/editor/policy.ts";

const text = value => new TextEncoder().encode(value);
const sha = "a".repeat(40);
const original = () => new Map([["src/content/home.json", text('{"title":"Accueil"}')], ["public/assets/image.webp", new Uint8Array([0, 255, 128])]]);
const archive = (additional = {}) => zipSync({
  "repo/package.json": text("{}"),
  "repo/package-lock.json": text("{}"),
  "repo/src/pages/index.astro": text("<h1>Accueil</h1>"),
  ...additional,
});

test("workspace modifications preserve binary bytes and undo after saving is dirty", async () => {
  const workspace = new LocalWorkspace(sha, original());
  const checkpoint = workspace.checkpoint();
  const hash = await fileHash(workspace.files.get("src/content/home.json"));
  await workspace.writeText("src/content/home.json", '{"title":"Nouveau"}', hash);
  workspace.finish(checkpoint);
  assert.equal(workspace.dirty, true);
  assert.deepEqual(workspace.files.get("public/assets/image.webp"), original().get("public/assets/image.webp"));
  workspace.markSaved("b".repeat(40));
  assert.equal(workspace.dirty, false);
  workspace.undo();
  assert.equal(workspace.dirty, true);
  assert.equal(workspace.text("src/content/home.json"), '{"title":"Accueil"}');
});

test("preconditions and protected paths cannot be bypassed", async () => {
  const workspace = new LocalWorkspace(sha, original());
  await assert.rejects(workspace.writeText("src/content/home.json", "x", null), /changé/);
  await assert.rejects(workspace.writeText("src/editor/client.ts", "x", null), /modifiable/);
  assert.throws(() => workspace.text(".env"), /accessible/);
  assert.throws(() => applyChanges(original(), [{ path: "../escape", content: "x", encoding: "utf8" }]), /interdit/);
});

test("new files, deletion and rollback are transactional", async () => {
  const workspace = new LocalWorkspace(sha, original());
  const checkpoint = workspace.checkpoint();
  await workspace.writeText("src/content/new.md", "Titre", null);
  await workspace.writeText("src/content/home.json", null, await fileHash(workspace.files.get("src/content/home.json")));
  assert.equal(workspace.changes().length, 2);
  workspace.restore(checkpoint);
  assert.equal(workspace.dirty, false);
});

test("a real ZIP is extracted byte-for-byte, excluding secrets", async () => {
  const bytes = archive({ "repo/public/assets/image.webp": new Uint8Array([0, 255, 128]), "repo/.env": text("secret fixture") });
  const files = await readArchive(new Response(bytes), new AbortController().signal, () => {});
  assert.equal(files.has(".env"), false);
  assert.deepEqual(files.get("public/assets/image.webp"), new Uint8Array([0, 255, 128]));
});

test("ZIP path traversal, symlinks, LFS and corruption are rejected", async () => {
  for (const bytes of [
    archive({ "repo/../escape": text("x") }),
    archive({ "repo/link": [text("target"), { os: 3, attrs: 0xa1ff << 16 }] }),
    archive({ "repo/public/assets/lfs.png": text("version https://git-lfs.github.com/spec/v1\n") }),
    archive().slice(0, -3),
  ]) await assert.rejects(readArchive(new Response(bytes), new AbortController().signal, () => {}));
});

test("an aborted download never returns a workspace", async () => {
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(readArchive(new Response(archive()), abort.signal, () => {}), { name: "AbortError" });
});
