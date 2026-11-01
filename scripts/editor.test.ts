import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseHTML } from "linkedom";
import { exportSource, initialValue, isDirty, parseRenderEntry, parseSource, persistence, validateFields, cmsUrl, type Catalog } from "../src/lib/editor/model";
import { renderMarkdown, safeUrl } from "../src/lib/editor/markdown";
import { previewMarkup, previewTarget, updatePreview } from "../src/lib/editor/preview";

const catalog: Catalog = JSON.parse(readFileSync("dist/editeur/catalogue.json", "utf8"));
const context = {
  base: catalog.base, siteUrl: catalog.siteUrl, now: catalog.builtAt,
  entries: catalog.entries.flatMap((entry) => {
    const collection = catalog.collections.find((candidate) => candidate.name === entry.collection)!;
    const parsed = parseRenderEntry(entry, parseSource(entry.source, collection.format));
    return parsed ? [parsed] : [];
  }),
};

test("all source files round-trip through Pages CMS format and actual schemas", () => {
  for (const entry of catalog.entries) {
    const collection = catalog.collections.find((candidate) => candidate.name === entry.collection)!;
    const draft = parseSource(entry.source, collection.format);
    assert.deepEqual(validateFields(collection.fields, draft), [], entry.path);
    const exported = exportSource(draft, collection.format);
    const restored = parseSource(exported, collection.format);
    assert.deepEqual(restored, draft, entry.path);
    assert.deepEqual(parseRenderEntry(entry, restored), parseRenderEntry(entry, draft), entry.path);
  }
});

test("unknown frontmatter is retained and body is not serialized into YAML", () => {
  const value = parseSource("---\ntitle: Test\nmigration:\n  oldId: 7\n---\n## Corps\n", "yaml-frontmatter");
  const result = exportSource(value, "yaml-frontmatter");
  assert(!result.includes("body:"));
  assert.deepEqual(parseSource(result, "yaml-frontmatter"), value);
});

test("invalid source and YAML aliases surface explicit errors", () => {
  assert.throws(() => parseSource("texte", "yaml-frontmatter"), /YAML/);
  assert.throws(() => parseSource("[]", "json"), /objet/);
  assert.throws(() => parseSource("---\na: &a []\nb: *a\n---\n", "yaml-frontmatter"));
});

test("new list values and optional blocks preserve types", () => {
  assert.deepEqual(initialValue({ name: "items", type: "string", list: true }), []);
  assert.deepEqual(initialValue({ name: "image", type: "object", fields: [{ name: "src", type: "image", required: true }, { name: "decorative", type: "boolean", default: false }] }), { src: "", decorative: false });
  assert(validateFields([{ name: "navigation", type: "string", list: { min: 6, max: 6 } }], { navigation: [] }).length);
});

test("dirty state does not clear on export and resetting restores original", () => {
  const original = { title: "Publié", body: "Texte" };
  const draft = structuredClone(original);
  assert.equal(isDirty(original, draft), false);
  draft.title = "Brouillon";
  exportSource(draft, "yaml-frontmatter");
  assert.equal(isDirty(original, draft), true);
  assert.equal(isDirty(original, structuredClone(original)), false);
});

test("image/link base paths work at root, fallback and already-prefixed paths", () => {
  for (const base of ["/", "/site-web/"]) {
    assert.equal(safeUrl("/assets/a.webp", base), `${base}assets/a.webp`);
    assert.equal(safeUrl("/site-web/contact/?a=1#titre", base), `${base}contact/?a=1#titre`);
    assert.equal(safeUrl("https://example.org/a.webp", base), "https://example.org/a.webp");
    assert.equal(safeUrl("#titre", base), "#titre");
    assert.equal(safeUrl("tel:+33251478090", base), "tel:+33251478090");
  }
  assert.equal(safeUrl("/preview/assets/a.webp", "/preview/"), "/preview/assets/a.webp");
  for (const url of ["javascript:alert(1)", "data:text/html,test", "//evil.example", "java\nscript:alert(1)", "\\evil.example"]) assert.equal(safeUrl(url, "/"), undefined);
});

test("shared Markdown retains GFM, images, telephone, headings and neutralizes HTML execution", () => {
  const html = renderMarkdown('## Titre\n\n**Gras** et [Appeler](tel:+33251478090).\n\n![Alt](/assets/a.webp)\n\n<script>alert(1)</script><img src="x" alt="ok" onerror="alert(1)"><iframe src="https://evil.example"></iframe>\n\n[Danger](javascript:alert(1))', "/site-web/");
  assert(html.includes('<h2 id="titre">Titre</h2>'));
  assert(html.includes("<strong>Gras</strong>"));
  assert(html.includes('href="tel:+33251478090"'));
  assert(html.includes('src="/site-web/assets/a.webp"'));
  assert(!/<script|onerror|iframe|javascript:/i.test(html));
});

test("live renderer uses changed values, optional blocks and escapes text and JSON-LD", () => {
  const entry = context.entries.find((item) => item.collection === "articles")!;
  assert(entry.collection === "articles");
  const changed = { ...entry, data: { ...entry.data, title: '</script><script>alert(1)</script>', archived: true } };
  const html = previewMarkup(changed, context);
  const rendered = parseHTML(`<main>${html}</main>`).document;
  assert.equal(rendered.querySelector("h1")?.textContent, changed.data.title);
  assert(html.includes("Cette information est archivée"));
  assert(!html.includes('</script><script>alert(1)'));
  const { document } = parseHTML(`<main id="contenu">${html}</main>`);
  updatePreview(document, html);
  assert.equal(document.querySelectorAll("script,a[href]").length, 0);
  assert.equal(document.querySelectorAll("h1").length, 1);
});

test("all seven live templates and resource indexes render without fabricated stand-in pages", () => {
  for (const collection of ["home", "standardPages", "articles", "crossroads", "species", "trainings", "indexes"]) {
    const entry = context.entries.find((candidate) => candidate.collection === collection)!;
    const html = previewMarkup(entry, context);
    assert(html.includes("<h1>"), collection);
  }
  for (const collection of ["documents", "faqs", "glossary", "directories"]) {
    const resource = context.entries.find((candidate) => candidate.collection === collection)!;
    const target = previewTarget(resource, context);
    assert(target?.collection === "indexes", collection);
    assert.equal(target.data.source, collection);
  }
});

test("persistence stays unavailable and upstream links use real Pages CMS routes", () => {
  assert.equal(persistence.available, false);
  assert(persistence.message.includes("aucune écriture"));
  const article = catalog.entries.find((entry) => entry.collection === "articles")!;
  assert.equal(cmsUrl(article, "test/branch"), `https://app.pagescms.org/FederationChasseVendee/site-web-fdc85/test%2Fbranch/collection/articles/edit/${encodeURIComponent(article.path)}`);
  const home = catalog.entries.find((entry) => entry.collection === "home")!;
  assert(cmsUrl(home, "main").endsWith("/main/file/home"));
});

test("editor/frame are noindex, excluded from sitemap and have no analytics", () => {
  for (const path of ["dist/editeur/index.html", "dist/editeur/cadre/index.html"]) {
    const html = readFileSync(path, "utf8");
    assert(html.includes('content="noindex, nofollow"'));
    assert(!html.includes("cloud.umami.is"));
  }
  assert(!readFileSync("dist/sitemap.xml", "utf8").includes("/editeur/"));
  assert(readFileSync("dist/robots.txt", "utf8").includes(`Disallow: ${catalog.base}editeur/`));
});
