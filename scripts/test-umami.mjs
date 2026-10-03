import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import { getSiteConfig } from "./site-config.mjs";

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
    if (outputPath === join("admin", "index.html")) {
      assert(!html.includes(scriptUrl), "L’administration ne doit jamais inclure Umami.");
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
    const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
      .filter((match) => match[1].includes("const adminPreview") && match[1].includes("umami.scriptUrl"));
    assert(
      scripts.length === 1,
      `${outputPath} doit contenir exactement un script Umami (trouvé : ${scripts.length}).`,
    );
    const script = scripts[0][1];
    for (const scenario of [
      { host: new URL(getSiteConfig().site).hostname, search: "", embedded: false, expected: 1 },
      { host: "a1b2c3d4.fdc85.pages.dev", search: "", embedded: false, expected: 0 },
      { host: "fdc85.maury.app", search: "?admin-preview=1", embedded: false, expected: 0 },
      { host: "fdc85.maury.app", search: "", embedded: true, expected: 0 },
    ]) {
      const injected = [];
      const top = {};
      runInNewContext(script, {
        URLSearchParams,
        location: { hostname: scenario.host, search: scenario.search },
        window: { self: scenario.embedded ? {} : top, top },
        document: {
          createElement: () => ({ dataset: {} }),
          head: { append: (element) => injected.push(element) },
        },
      });
      assert(injected.length === scenario.expected, `Suivi incorrect dans ${outputPath} : ${JSON.stringify(scenario)}`);
      if (injected.length) {
        const element = injected[0];
        assert(element.defer && element.src === scriptUrl, `Script Umami incorrect dans ${outputPath}.`);
        assert(element.dataset.websiteId === websiteId, `Website ID incorrect dans ${outputPath}.`);
        assert(element.dataset.doNotTrack === "true", `Respect DNT absent dans ${outputPath}.`);
      }
    }
    const navigationGuard = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
      .find((match) => match[1].includes("const mark ="))?.[1];
    assert(navigationGuard, `Protection navigation admin-preview absente dans ${outputPath}.`);
    const anchors = [
      { href: "https://fdc85.maury.app/contact/", getAttribute: () => "/contact/" },
      { href: "https://external.test/", getAttribute: () => "https://external.test/" },
      { href: "https://fdc85.maury.app/#contenu", getAttribute: () => "#contenu" },
    ];
    const refresh = { content: "0; url=/contact/" };
    runInNewContext(navigationGuard, {
      URL, URLSearchParams,
      location: { href: "https://fdc85.maury.app/?admin-preview=1", origin: "https://fdc85.maury.app", search: "?admin-preview=1" },
      document: {
        querySelector: () => refresh,
        querySelectorAll: () => anchors,
        addEventListener: (_name, callback) => callback(),
      },
    });
    assert(anchors[0].href.endsWith("?admin-preview=1"), `Paramètre perdu à la navigation dans ${outputPath}.`);
    assert(anchors[1].href === "https://external.test/", "Un lien externe ne doit pas être modifié.");
    assert(anchors[2].href.endsWith("#contenu"), "Une ancre de page ne doit pas être modifiée.");
    assert(refresh.content.endsWith("?admin-preview=1"), "Une redirection doit conserver l’exclusion du suivi.");
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
    `Umami vérifié sur ${generatedHtml.length} sorties HTML : absent sur admin, iframes et previews ; unique sur le site public ; erreur explicite si invalide.`,
  );
} finally {
  writeFileSync(sitePath, originalSiteSource, "utf8");
}
