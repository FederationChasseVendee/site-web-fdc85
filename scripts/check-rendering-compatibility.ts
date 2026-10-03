import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parseHTML } from "linkedom";
import { createHash } from "node:crypto";

const fixture = "scripts/fixtures/rendering-baseline.json";
const normalizedText = (value: string | null) => (value ?? "").replace(/\s+/g, "");
const normalizeUrl = (url: string | null) => (url ?? "")
  .replace("https://federationchassevendee.github.io/site-web/", "{site}/")
  .replace("https://fdc85.maury.app/", "{site}/")
  .replace(/^\/site-web\//, "/");

// CommonMark delimiters around adjacent emoji/strong spans differ from Sätteri.
// Only this exact, inspected text result is accepted; the other six invariants remain unchanged.
const intentionalMarkdownChanges: Record<string, string> = {
  "levee-des-restrictions-sur-la-zone-reglementee-de-vaire-et-st-mathurin/index.html": "0a3af8fb006871adcc6e5f505d0996982c35292614882b03ab4b0e844d0a0602",
};

function snapshot(html: string) {
  const { document } = parseHTML(html);
  const main = document.getElementById("contenu");
  if (!main) throw new Error("Zone principale manquante.");
  const structured = [...document.querySelectorAll('script[type="application/ld+json"]')].map((script) =>
    JSON.parse((script.textContent ?? "").replaceAll("https://federationchassevendee.github.io/site-web/", "{site}/").replaceAll("https://fdc85.maury.app/", "{site}/")));
  main.querySelector(".weather-section")?.remove();
  main.querySelectorAll("script").forEach((script) => script.remove());
  const details = {
    text: normalizedText(main.textContent),
    headings: [...main.querySelectorAll("h1,h2,h3,h4")].map((node) => [node.tagName, node.id, normalizedText(node.textContent)]),
    links: [...main.querySelectorAll("a")].map((node) => [normalizeUrl(node.getAttribute("href")), normalizedText(node.textContent)]),
    images: [...main.querySelectorAll("img")].map((node) => ["src", "alt", "width", "height"].map((attribute) =>
      attribute === "src" ? normalizeUrl(node.getAttribute(attribute)) : node.getAttribute(attribute))),
    navigation: [...document.querySelectorAll(".site-header a,.site-footer a")].map((node) =>
      [normalizeUrl(node.getAttribute("href")), normalizedText(node.textContent)]),
    blocks: [".cta-panel", ".resource-block", ".status-message", ".gallery", ".index-item", ".link-card"]
      .map((selector) => [selector, main.querySelectorAll(selector).length]),
    structured,
  };
  return Object.fromEntries(Object.entries(details).map(([key, value]) =>
    [key, createHash("sha256").update(JSON.stringify(value)).digest("hex")]));
}

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)]);
}

const baselineDirectory = process.env.RENDER_BASELINE_DIR;
if (process.argv.includes("--capture")) {
  if (!baselineDirectory) throw new Error("RENDER_BASELINE_DIR est requis pour capturer le build avant refactorisation.");
  const snapshots = Object.fromEntries(walk(baselineDirectory)
    .filter((path) => path.endsWith(".html"))
    .map((path) => [relative(baselineDirectory, path).replaceAll("\\", "/"), snapshot(readFileSync(path, "utf8"))]));
  mkdirSync("scripts/fixtures", { recursive: true });
  writeFileSync(fixture, `${JSON.stringify(snapshots)}\n`);
  console.log(`Baseline capturée : ${Object.keys(snapshots).length} pages.`);
} else {
  if (!existsSync(fixture)) throw new Error("Fixture de référence absente.");
  const snapshots = JSON.parse(readFileSync(fixture, "utf8"));
  let count = 0;
  for (const [path, expected] of Object.entries(snapshots)) {
    const actual = snapshot(readFileSync(join("dist", path), "utf8"));
    const reference = intentionalMarkdownChanges[path]
      ? { ...(expected as Record<string, string>), text: intentionalMarkdownChanges[path] }
      : expected;
    try { assert.deepEqual(actual, reference); }
    catch (error) { throw new Error(`Rendu incompatible : ${path}`, { cause: error }); }
    count += 1;
  }
  console.log(`Compatibilité sémantique : ${count} pages, textes, titres, liens, images/alt, navigation, blocs optionnels et JSON-LD.`);
}
