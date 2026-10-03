import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const sitePath = "src/content/site.json";
const originalSiteSource = readFileSync(sitePath, "utf8");
const originalSite = JSON.parse(originalSiteSource);
const astroCli = "node_modules/astro/bin/astro.mjs";
const scriptUrl = "https://cloud.umami.is/script.js";

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function writeAnalytics(analytics) {
  writeFileSync(
    sitePath,
    `${JSON.stringify({ ...originalSite, analytics }, null, 2)}\n`,
    "utf8",
  );
}

function build() {
  return spawnSync(process.execPath, [astroCli, "build"], {
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
}

function htmlFiles() {
  return walk("dist").filter((file) => extname(file) === ".html");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  writeAnalytics({ enabled: false, websiteId: "" });
  const disabledBuild = build();
  assert(
    disabledBuild.status === 0,
    `Le build désactivé a échoué.\n${disabledBuild.stdout}\n${disabledBuild.stderr}`,
  );
  for (const file of htmlFiles()) {
    const html = readFileSync(file, "utf8");
    assert(
      !html.includes(scriptUrl) && !html.includes("data-website-id"),
      `Un script Umami est présent alors que le suivi est désactivé : ${relative("dist", file)}`,
    );
  }

  const websiteId = randomUUID();
  writeAnalytics({ enabled: true, websiteId });
  const enabledBuild = build();
  assert(
    enabledBuild.status === 0,
    `Le build activé a échoué.\n${enabledBuild.stdout}\n${enabledBuild.stderr}`,
  );
  const generatedHtml = htmlFiles();
  assert(generatedHtml.length > 0, "Aucune page HTML n’a été générée.");
  for (const file of generatedHtml) {
    const html = readFileSync(file, "utf8");
    const outputPath = relative("dist", file);
    if (outputPath.replaceAll("\\", "/") === "admin/index.html") {
      assert(!html.includes(scriptUrl) && !html.includes("data-website-id")
        && html.includes('<meta name="robots" content="noindex, nofollow">'),
      "L’atelier navigateur doit rester noindex et sans Umami, même quand le site public est suivi.");
      continue;
    }
    if (existsSync(join("public", outputPath))) {
      assert(
        !html.includes(scriptUrl)
          && html.includes('<meta name="robots" content="noindex, follow">')
          && html.includes('http-equiv="refresh"'),
        `La redirection statique exclue du suivi est invalide : ${outputPath}`,
      );
      continue;
    }
    const scripts = [...html.matchAll(/<script\b[^>]*data-website-id="[^"]+"[^>]*><\/script>/g)];
    assert(
      scripts.length === 1,
      `${outputPath} doit contenir exactement un script Umami (trouvé : ${scripts.length}).`,
    );
    const script = scripts[0][0];
    assert(script.includes(" defer"), `Attribut defer absent dans ${outputPath}.`);
    assert(script.includes(`src="${scriptUrl}"`), `URL Umami incorrecte dans ${outputPath}.`);
    assert(script.includes(`data-website-id="${websiteId}"`), `Website ID incorrect dans ${outputPath}.`);
    assert(script.includes('data-do-not-track="true"'), `Respect DNT absent dans ${outputPath}.`);
  }

  writeAnalytics({ enabled: true, websiteId: "" });
  const invalidBuild = build();
  const invalidOutput = `${invalidBuild.stdout}\n${invalidBuild.stderr}`;
  assert(invalidBuild.status !== 0, "Une configuration Umami active sans Website ID devrait faire échouer le build.");
  assert(
    invalidOutput.includes("désactivez Umami ou renseignez un Website ID Umami valide"),
    `Le message d’erreur de configuration n’est pas actionnable.\n${invalidOutput}`,
  );

  console.log(
    `Umami vérifié sur ${generatedHtml.length} sorties HTML : absent si désactivé, unique et conforme sur les pages Astro si activé, erreur explicite si invalide.`,
  );
} finally {
  writeFileSync(sitePath, originalSiteSource, "utf8");
}
