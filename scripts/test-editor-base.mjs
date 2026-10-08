import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { rebaseInternalUrl, rebaseStaticRedirect } from "../src/lib/base-links.mjs";
import { siteConfig } from "./site-config.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("internal links move from the historical base to the configured base", () => {
  assert.equal(rebaseInternalUrl("/actualites/ouverture/", "/preview/"), "/preview/actualites/ouverture/");
  assert.equal(rebaseInternalUrl("/site-web/actualites/ouverture/", "/preview/"), "/preview/actualites/ouverture/");
  assert.equal(rebaseInternalUrl("/preview/actualites/ouverture/", "/preview/"), "/preview/actualites/ouverture/");
  assert.equal(rebaseInternalUrl("/actualites/ouverture/", "/"), "/actualites/ouverture/");
  assert.equal(rebaseInternalUrl("https://example.test/photo.jpg", "/preview/"), "https://example.test/photo.jpg");
  assert.equal(rebaseInternalUrl("//cdn.example.test/photo.jpg", "/preview/"), "//cdn.example.test/photo.jpg");
});

test("static redirect output follows the configured deployment base", () => {
  const source = [
    '<link rel="canonical" href="https://federationchassevendee.github.io/site-web/">',
    '<meta http-equiv="refresh" content="0; url=/site-web/actualites/">',
    '<a href="/site-web/actualites/">Lire la suite</a>',
  ].join("");

  assert.equal(
    rebaseStaticRedirect(source, "https://fdc85.maury.app", "/"),
    [
      '<link rel="canonical" href="https://fdc85.maury.app/">',
      '<meta http-equiv="refresh" content="0; url=/actualites/">',
      '<a href="/actualites/">Lire la suite</a>',
    ].join(""),
  );
});

test("siteConfig preserves explicit paths and selects Cloudflare defaults", () => {
  assert.deepEqual(siteConfig({}), {
    site: "https://federationchassevendee.github.io",
    base: "/site-web",
  });
  assert.deepEqual(siteConfig({ CF_PAGES: "1" }), {
    site: "https://fdc85.maury.app",
    base: "/",
  });
  assert.deepEqual(siteConfig({ CF_PAGES_BRANCH: "preview", ASTRO_BASE_PATH: "/", ASTRO_SITE: "https://preview.example.test" }), {
    site: "https://preview.example.test",
    base: "/",
  });
});

test("browser drafts isolate analytics and use noindex/nofollow", () => {
  const layout = read("src/layouts/BaseLayout.astro");
  assert.match(layout, /const browserDraft = import\.meta\.env\.PUBLIC_BROWSER_DRAFT === "true";/);
  assert.match(layout, /const umami = browserDraft \? undefined : getUmamiConfig\(site\.analytics\);/);
  assert.match(layout, /<meta name="robots" content="noindex, nofollow" \/>/);
  assert.doesNotMatch(layout, /site\.analytics\s*=/);
});

test("browser draft route bridge validates and targets the configured parent origin", () => {
  const layout = read("src/layouts/BaseLayout.astro");
  assert.match(layout, /PUBLIC_EDITOR_PARENT_ORIGIN/);
  assert.match(layout, /\["http:", "https:"\]\.includes\(url\.protocol\)/);
  assert.match(layout, /const previewParentOrigin = browserDraft/);
  assert.match(layout, /type: "editor-preview-route"/);
  assert.match(layout, /pathname: location\.pathname/);
  assert.match(layout, /window\.parent\.postMessage/);
  assert.match(layout, /previewParentOrigin/);
  assert.doesNotMatch(layout, /postMessage\([\s\S]*["']\*["']/);
});

test("Astro config keeps base-aware Markdown and published editor headers", () => {
  const config = read("astro.config.mjs");
  assert.match(config, /satteri\(\{ hastPlugins: \[hastBaseLinks\(base\)\] \}\)/);
  assert.match(config, /staticRedirectBaseIntegration\(site, base\)/);
  assert.match(config, /editorHeadersIntegration\(\)/);
  assert.match(config, /PUBLIC_BROWSER_DRAFT === "true"/);
  assert.doesNotMatch(config, /browser-snapshot/);
});

test("generated-site checks keep editor exceptions narrow", () => {
  const checker = read("scripts/check-generated-site.mjs");
  assert.match(checker, /siteConfig\(\)/);
  assert.match(checker, /isEditorRoute/);
  assert.match(checker, /noindex, nofollow/);
  assert.match(checker, /data-website-id=/);
  assert.match(checker, /Fil d’Ariane/);
  assert.match(checker, /\/api\/"\)/);
});
