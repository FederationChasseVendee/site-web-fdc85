import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeSlug } from "../src/lib/slug.mjs";
import {
  cmsUrl, cloudflareCheck, comparisonState, deploymentUrl, freshnessState, indexContains,
  normalizeBase, parseIdentity, sitePath,
} from "../src/lib/preview.mjs";
import { createIdentity } from "../src/lib/preview-identity.mjs";
import { rebaseLegacyUrl, rebaseMarkdown } from "../src/lib/legacy-base.mjs";
import { createSatteriMarkdownProcessor } from "@astrojs/markdown-satteri";
import { siteConfig } from "../src/lib/site-config.mjs";

const sha = "a".repeat(40);
const other = "b".repeat(40);
const fixture = (commit = sha) => ({
  schemaVersion: 1, base: "/site-web/", productionUrl: "https://fdc85.maury.app",
  build: { branch: "relecture/été", commit, environment: "preview", builtAt: new Date().toISOString() },
});

test("native Astro Markdown processor renders historical links under each configured base", async () => {
  for (const base of ["/", "/site-web/", "/sous/dossier/"]) {
    const renderer = await createSatteriMarkdownProcessor({ hastPlugins: [rebaseMarkdown({ base })] });
    const result = await renderer.render("[Contact](/site-web/contact/?a=1#titre)");
    assert.ok(result.code.includes(`href="${base}contact/?a=1#titre"`), result.code);
  }
});

test("Astro route IDs retain nested paths and normalize Markdown filenames", () => {
  assert.equal(normalizeSlug("Rubrique\\Page.MD"), "rubrique/page");
  assert.equal(normalizeSlug("/Rubrique/Page.mdx/"), "rubrique/page.mdx");
  assert.equal(sitePath("/site-web/", `${normalizeSlug("Rubrique/Page.md")}/`), "/site-web/rubrique/page/");
  assert.equal(sitePath("/", "contact/"), "/contact/");
  assert.equal(normalizeBase("sous/dossier"), "/sous/dossier/");
  assert.equal(rebaseLegacyUrl("/site-web/contact/?a=1#titre", "/"), "/contact/?a=1#titre");
  assert.equal(rebaseLegacyUrl("/site-web/contact/", "/sous/dossier/"), "/sous/dossier/contact/");
  assert.equal(rebaseLegacyUrl("https://example.org/site-web/contact/", "/"), "https://example.org/site-web/contact/");
});

test("hosted Pages CMS uses branch and full repository file path as encoded segments", () => {
  const file = "src/content/standard-pages/Rubrique/Été.md";
  assert.equal(cmsUrl("relecture/été", { name: "standardPages", type: "collection" }, file),
    "https://app.pagescms.org/FederationChasseVendee/site-web-fdc85/relecture%2F%C3%A9t%C3%A9/collection/standardPages/edit/src%2Fcontent%2Fstandard-pages%2FRubrique%2F%C3%89t%C3%A9.md");
  assert.equal(cmsUrl("main", { name: "home", type: "file" }),
    "https://app.pagescms.org/FederationChasseVendee/site-web-fdc85/main/file/home");
  assert.ok(cmsUrl("work", { name: "documents", type: "collection" }).endsWith("/collection/documents"));
});

test("shared data previews follow actual index filtering, not invented individual pages", () => {
  assert.equal(indexContains({ source: "documents", category: "Chasse" }, "documents", { category: "Autre" }), false);
  assert.equal(indexContains({ source: "documents", category: "Chasse" }, "documents", { category: "Chasse" }), true);
  assert.equal(indexContains({ source: "directories", category: "équipe" }, "directories", { category: "Notre Équipe" }), true);
  assert.equal(indexContains({ source: "faqs", category: "Chasse" }, "faqs", { category: "Autre" }), true);
  assert.equal(indexContains({ source: "glossary" }, "documents", {}), false);
});

test("deployment checks distinguish queued, failed, missing, unverifiable and ready", () => {
  const check = (fields) => ({ check_runs: [{ name: "Cloudflare Pages", head_sha: sha, ...fields }] });
  assert.equal(cloudflareCheck(check({ status: "queued" }), sha).state, "pending");
  assert.equal(cloudflareCheck(check({ status: "completed", conclusion: "failure" }), sha).state, "failed");
  assert.equal(cloudflareCheck(check({ status: "completed", conclusion: "success" }), sha).state, "unlocated");
  assert.equal(cloudflareCheck(check({ head_sha: other }), sha).state, "missing");
  const ready = cloudflareCheck(check({
    status: "completed", conclusion: "success",
    output: { summary: "<a href='https://12ab34cd.fdc85.pages.dev'>Preview</a>" },
  }), sha);
  assert.deepEqual(ready, { state: "ready", url: "https://12ab34cd.fdc85.pages.dev" });
  assert.throws(() => cloudflareCheck({}, sha));
});

test("branch aliases and untrusted URLs are never promoted to ready deployments", () => {
  for (const url of ["https://work.fdc85.pages.dev", "http://12ab34cd.fdc85.pages.dev",
    "https://12ab34cd.fdc85.pages.dev.evil.test", "https://secret@12ab34cd.fdc85.pages.dev"]) {
    assert.equal(deploymentUrl(url), null);
  }
});

test("comparison and freshness are honest about missing, local and different identities", () => {
  const identity = parseIdentity(fixture());
  assert.equal(identity.base, "/site-web/");
  assert.equal(comparisonState(identity, parseIdentity(fixture())), "same");
  assert.equal(comparisonState(identity, parseIdentity(fixture(other))), "different");
  assert.equal(comparisonState(identity, null), "unknown");
  assert.equal(comparisonState({ commit: sha, environment: "local" }, { commit: other }), "unknown");
  assert.equal(comparisonState({ commit: sha, environment: "local" }, { commit: sha }), "unknown");
  assert.equal(freshnessState(sha, sha), "current");
  assert.equal(freshnessState(sha, other), "stale");
  assert.equal(freshnessState("", sha), "unknown");
  assert.throws(() => parseIdentity("<html>Old deployment</html>"));
  assert.throws(() => parseIdentity({ ...fixture(), build: { ...fixture().build, commit: "invented" } }));
});

test("hosting identity excludes analytics for preview builds but preserves production", () => {
  const local = { branch: "work", commit: sha };
  assert.equal(createIdentity({ CF_PAGES: "1", CF_PAGES_BRANCH: "main", CF_PAGES_COMMIT_SHA: sha }, local).preview, false);
  assert.equal(createIdentity({ CF_PAGES: "1", CF_PAGES_BRANCH: "work", CF_PAGES_COMMIT_SHA: sha }, local).preview, true);
  assert.equal(createIdentity({ CF_PAGES: "1" }, local).environment, "preview");
  assert.equal(createIdentity({ PREVIEW_BUILD: "true" }, local).preview, true);
  assert.equal(createIdentity({}, local).environment, "local");
  assert.throws(() => createIdentity({ CF_PAGES: "1", CF_PAGES_COMMIT_SHA: "bad" }, local));
});

test("Cloudflare previews work at root without environment-specific dashboard configuration", () => {
  assert.deepEqual(siteConfig({ CF_PAGES: "1", CF_PAGES_BRANCH: "work" }),
    { site: "https://fdc85.maury.app", base: "/" });
  assert.deepEqual(siteConfig({ CF_PAGES: "1", CF_PAGES_BRANCH: "main" }),
    { site: "https://fdc85.maury.app", base: "/" });
  assert.equal(siteConfig({}).base, "/site-web");
  assert.deepEqual(siteConfig({ CF_PAGES: "1", ASTRO_SITE: "https://example.org", ASTRO_BASE_PATH: "/nested/" }),
    { site: "https://example.org", base: "/nested/" });
});
