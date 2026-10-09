import assert from "node:assert/strict";
import { test } from "node:test";
import { editablePath, readablePath, workspacePath, validPath, requestTitle, encodeFile, decodeFile, fileHash } from "../src/editor/policy.ts";

test("editor paths protect runtime, credentials and deployment", () => {
  for (const path of ["src/editor/client.ts", "src/pages/edit.astro", "functions/api/editor.ts", ".github/workflows/build.yml", ".env", "package.json", "public/assets/../secret.ts", "public/assets\\secret.svg"]) {
    assert.equal(editablePath(path), false, path);
  }
  for (const path of ["src/content/home.json", "src/pages/nouvelle-page.astro", "src/styles/global.css", "public/assets/photo.webp"]) {
    assert.equal(editablePath(path), true, path);
  }
  assert.equal(readablePath("src/content.config.ts"), true);
  assert.equal(workspacePath("src/content/home.json"), true);
  assert.equal(workspacePath(".env.production"), false);
  assert.equal(validPath("src/../secret"), false);
  assert.equal(validPath("C:/secret"), false);
});

test("names cannot be empty, oversized or multiline", () => {
  assert.equal(requestTitle("  Modifier le titre  "), "Modifier le titre");
  for (const value of [" ", "a".repeat(101), "test\nfoo", null]) assert.throws(() => requestTitle(value));
});

test("binary and text round trips preserve bytes", async () => {
  for (const bytes of [new TextEncoder().encode("Vendée\n"), new Uint8Array([0, 255, 128, 32])]) {
    assert.deepEqual(decodeFile(encodeFile(bytes)), bytes);
    assert.match(await fileHash(bytes), /^[a-f0-9]{64}$/);
  }
});
