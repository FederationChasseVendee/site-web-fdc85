import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { cmsUrl, cmsFrameMessage, previewUrl, safeRoute, normalizeBase, deploymentFromCheck, validateDeployment, REPOSITORY } from "../src/lib/admin.ts";
import { rebaseInternalUrl, rebaseStaticRedirect, unicodeRedirects } from "./base-links.mjs";

test("Pages CMS routes preserve full nested file paths and encode branch as one segment", () => {
  const root = "https://app.pagescms.org/FederationChasseVendee/site-web-fdc85/feature%2F%C3%A9t%C3%A9";
  assert.equal(cmsUrl("feature/été"), root);
  assert.equal(cmsUrl("feature/été", { kind: "file", collection: "home" }), `${root}/file/home`);
  assert.equal(cmsUrl("feature/été", { kind: "collection", collection: "standardPages" }), `${root}/collection/standardPages`);
  assert.equal(cmsUrl("feature/été", { kind: "entry", collection: "standardPages", path: "src\\content\\standard-pages\\rubrique\\été #1.md" }), `${root}/collection/standardPages/edit/src%2Fcontent%2Fstandard-pages%2Frubrique%2F%C3%A9t%C3%A9%20%231.md`);
  assert.equal(cmsUrl("main", { kind: "media", collection: "default" }), "https://app.pagescms.org/FederationChasseVendee/site-web-fdc85/main/media/default");
  assert.throws(() => cmsUrl(" "));
  assert.throws(() => cmsUrl("main", { kind: "entry", collection: "articles", path: "../secret" }));
});

test("Preview URLs support root and fallback base, Unicode and prevent admin recursion", () => {
  assert.equal(normalizeBase("/"), "/");
  assert.equal(normalizeBase("site-web"), "/site-web/");
  assert.equal(previewUrl("https://build.fdc85.pages.dev", "/", "contact/"), "https://build.fdc85.pages.dev/contact/?admin-preview=1");
  assert.equal(previewUrl("http://localhost:4321", "/site-web/", ""), "http://localhost:4321/site-web/?admin-preview=1");
  assert.equal(safeRoute("dossier/été/"), "dossier/%C3%A9t%C3%A9/");
  assert.equal(safeRoute("dossier/%C3%A9t%C3%A9/"), "dossier/%C3%A9t%C3%A9/");
  for (const route of ["admin/", "/ADMIN/", "dossier/admin/", "%61dmin/", "../contact", "https://x.test/", "contact?admin", "\\admin\\"]) {
    assert.throws(() => safeRoute(route), route);
  }
});

test("Imported Markdown and static Unicode redirects respect root and historical base", () => {
  assert.equal(rebaseInternalUrl("/site-web/contact/", "/"), "/contact/");
  assert.equal(rebaseInternalUrl("/site-web/contact/", "/site-web"), "/site-web/contact/");
  assert.equal(rebaseInternalUrl("/assets/photo.jpg", "/site-web"), "/site-web/assets/photo.jpg");
  assert.equal(rebaseInternalUrl("https://external.test/file", "/"), "https://external.test/file");
  assert.equal(rebaseInternalUrl("//external.test/file", "/"), "//external.test/file");
  for (const route of unicodeRedirects) {
    const source = readFileSync(join("public", route, "index.html"), "utf8");
    const root = rebaseStaticRedirect(source, "https://fdc85.maury.app", "/");
    assert.doesNotMatch(root, /\/site-web\//);
    assert.match(root, /rel="canonical" href="https:\/\/fdc85\.maury\.app\//);
    const fallback = rebaseStaticRedirect(source, "https://federationchassevendee.github.io", "/site-web");
    assert.equal(fallback, source);
  }
});

test("Cross-origin load status never claims authenticated editing; fallback remains explicit", () => {
  assert.match(cmsFrameMessage("unverified"), /ne confirme ni la connexion/);
  assert.match(cmsFrameMessage("timeout"), /nouvel onglet/);
  assert.match(cmsFrameMessage("error"), /nouvel onglet/);
  const script = readFileSync("src/scripts/admin.ts", "utf8");
  const html = readFileSync("src/pages/admin/index.astro", "utf8");
  assert.match(script, /12000/);
  assert.match(script, /window.self !== window.top/);
  assert.match(html, /id="cms-own-tab"[^>]*target="_blank"/);
  assert.match(html, /cookies tiers/);
  assert.match(html, /allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads/);
  assert.doesNotMatch(html, /allow-top-navigation/);
  assert.doesNotMatch(script, /localStorage|sessionStorage/);
});

test("Latest preview selects actual successful immutable Cloudflare deployment, not guessed alias", () => {
  assert.equal(deploymentFromCheck("<a href='https://a1b2c3d4.fdc85.pages.dev'>Preview</a>"), "https://a1b2c3d4.fdc85.pages.dev");
  assert.throws(() => deploymentFromCheck("https://feature.fdc85.pages.dev"));
  const manifest = { repository: REPOSITORY, branch: "feature/edit", commit: "abc", routes: [], base: "/" };
  assert.doesNotThrow(() => validateDeployment(manifest, "feature/edit", "abc"));
  assert.throws(() => validateDeployment(manifest, "main", "abc"));
  assert.throws(() => validateDeployment(manifest, "feature/edit", "def"));
  assert.throws(() => validateDeployment({ ...manifest, repository: "wrong/repo" }, "feature/edit", "abc"));
});

test("Generated manifest covers all collections, source files, impacted data indexes and public routes", () => {
  const manifest = JSON.parse(readFileSync("dist/admin/manifest.json", "utf8"));
  const cmsConfig = readFileSync(".pages.yml", "utf8");
  const collectionNames = [...cmsConfig.matchAll(/^  - name: (.+)$/gm)].map((match) => match[1]);
  for (const name of collectionNames) {
    assert.ok(manifest.contents.some((content) => content.collection === name), name);
  }
  for (const content of manifest.contents) {
    if (content.path) assert.ok(existsSync(join(...content.path.split("/"))), content.path);
    if (content.kind === "entry") assert.ok(cmsUrl(manifest.branch, content).includes(encodeURIComponent(content.path)));
    for (const route of content.routes) assert.ok(manifest.routes.some((item) => item.path === route), route);
  }
  for (const route of manifest.routes) {
    assert.doesNotThrow(() => safeRoute(route.path));
    assert.ok(existsSync(join("dist", ...decodeURIComponent(route.path).split("/"), "index.html")), route.path);
    assert.ok(manifest.contents.some((content) => content.id === route.contentId), route.contentId);
  }
  for (const collection of ["documents", "faqs", "glossary", "directories"]) {
    const resources = manifest.contents.filter((content) => content.collection === collection && content.kind === "entry");
    assert.ok(resources.length > 0);
    assert.ok(resources.some((resource) => resource.routes.length > 0), `${collection} impact missing`);
  }
  assert.ok(manifest.contents.some((content) => content.path?.match(/standard-pages\/.+\/.+\.md$/)));
  const html = readFileSync("dist/admin/index.html", "utf8");
  assert.match(html, /noindex, nofollow/);
  assert.doesNotMatch(html, /cloud\.umami\.is/);
  assert.doesNotMatch(readFileSync("dist/sitemap.xml", "utf8"), /\/admin\//);
  assert.doesNotMatch(cmsConfig, /open-preview/);
  assert.equal(existsSync(".github/workflows/pages-cms-preview.yml"), false);
  assert.doesNotMatch(readFileSync("public/_redirects", "utf8"), /^\/admin(?:\/|\s)/m);
  assert.doesNotMatch(readFileSync("dist/_redirects", "utf8"), /^\/admin(?:\/|\s)/m);
});
