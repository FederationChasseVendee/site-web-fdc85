import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { cmsUrl, parseIdentity } from "../src/lib/preview.mjs";

const manifest = JSON.parse(readFileSync("dist/admin/preview.json", "utf8"));
const identity = parseIdentity(manifest);
const config = parse(readFileSync(".pages.yml", "utf8"));
const admin = readFileSync("dist/admin/index.html", "utf8");
assert.ok(admin.includes('content="noindex, nofollow"'));
assert.ok(!admin.includes("cloud.umami.is") && !admin.includes("data-website-id"));
assert.ok(!readFileSync("dist/sitemap.xml", "utf8").includes("/admin/"));
assert.equal(manifest.collections.length, config.content.length);
assert.ok(!config.actions, "L’ancienne action CMS ne doit pas être remplacée.");
assert.ok(!existsSync(".github/workflows/pages-cms-preview.yml"));
assert.ok(!/^\/admin(?:\/|\s)/m.test(readFileSync("dist/_redirects", "utf8")),
  "Une redirection Cloudflare ne doit pas intercepter le nouvel espace.");
assert.ok(readFileSync("dist/_headers", "utf8").includes("X-Robots-Tag: noindex, nofollow"));
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((item) => {
    const path = join(directory, item.name);
    return item.isDirectory() ? files(path) : [path];
  });
}
for (const collection of config.content) {
  const entries = manifest.contents.filter((item) => item.collection === collection.name);
  assert.ok(entries.length > 0, `Collection manquante : ${collection.name}`);
  if (collection.type === "collection") {
    const sources = files(collection.path).filter((path) => path.endsWith(".md")).map((path) => path.replace(/\\/g, "/"));
    assert.deepEqual(entries.map((item) => item.file).sort(), sources.sort(), `Couverture incomplète : ${collection.name}`);
  }
  for (const item of entries) {
    assert.ok(existsSync(item.file), `Chemin source absent : ${item.file}`);
    assert.equal(item.editorUrl, identity.branch ? cmsUrl(identity.branch, collection,
      collection.type === "file" ? undefined : item.file) : null);
    for (const page of item.pages) {
      assert.ok(page.path.startsWith(identity.base), `Base incorrecte : ${page.path}`);
      assert.ok(existsSync(join("dist", page.path.slice(identity.base.length), "index.html")),
        `L’aperçu doit être une page réellement compilée : ${page.path}`);
    }
    if (manifest.build.preview) {
      for (const file of files("dist").filter((path) => path.endsWith(".html"))) {
        const html = readFileSync(file, "utf8");
        assert.ok(html.includes('name="robots" content="noindex,'), `Aperçu indexable : ${file}`);
        assert.ok(!html.includes("cloud.umami.is"), `Suivi présent dans un aperçu : ${file}`);
      }
    }
  }
}
assert.ok(readFileSync("dist/robots.txt", "utf8").includes(
  manifest.build.preview ? "Disallow: /" : `Disallow: ${identity.base}admin/`,
));
console.log(`Espace de prévisualisation : ${manifest.contents.length} contenus, chemins CMS, routes réelles, identité et exclusion du suivi vérifiés.`);
