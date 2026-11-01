import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";

const workshopPath = fileURLToPath(new URL("../docs/refonte/propositions-visuelles.html", import.meta.url));
const workshop = readFileSync(workshopPath, "utf8");
const scripts = [...workshop.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
  .map((match) => match[1])
  .filter((source) => source.trim());
assert.equal(scripts.length, 1, "Le script intégré de l’atelier doit être identifiable.");
const workshopScript = scripts[0];
const visualScript = readFileSync(new URL("../docs/refonte/pistes-v2.js", import.meta.url), "utf8");

const v1Key = "fdc85-atelier-visuel-v1";
const v2Key = "fdc85-atelier-visuel-v2";
const legacyIds = ["ledger", "coast", "atlas", "bulletin", "guide", "kiosk", "season", "route", "index", "poster"];
const originalV2Ids = ["guichet", "journal", "two-doors", "directory", "subject-map", "journey", "big-type", "open-files", "photo-guide", "landscape"];

function legacyState() {
  const reviews = Object.fromEntries(legacyIds.map((id) => [id, {
    status: "unreviewed",
    userNote: "",
    clientNote: "",
  }]));
  reviews.ledger = {
    status: "keep",
    userNote: "Ancien avis utilisateur",
    clientNote: "Ancien avis cliente",
    extra: "champ conservé",
  };
  return { current: 0, mode: "single", device: "desktop", reviews, marker: "métadonnée conservée" };
}

class StorageStub {
  constructor(values = {}) {
    this.values = new Map(Object.entries(values));
    this.failRead = false;
    this.failWrite = false;
    this.writeCount = 0;
  }

  getItem(key) {
    if (this.failRead) throw new Error("Lecture impossible");
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.writeCount += 1;
    if (this.failWrite) throw new Error("Écriture impossible");
    this.values.set(key, String(value));
  }
}

class ElementStub {
  constructor() {
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this.lastChild = { textContent: "" };
    this.classList = { toggle() {} };
    this.value = "";
    this.textContent = "";
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  querySelectorAll() {
    return [];
  }

  addEventListener(type, listener) {
    this.listeners[type] = listener;
  }

  focus() {}

  input(value) {
    this.value = value;
    this.listeners.input({ currentTarget: this });
  }

  click() {
    this.listeners.click();
  }
}

function createWorkshop(storage, { withVisuals = true } = {}) {
  const elements = new Map();
  const getElementById = (id) => {
    if (!elements.has(id)) elements.set(id, new ElementStub());
    return elements.get(id);
  };
  const statuses = ["keep", "revisit", "discard"].map((choice) => {
    const element = new ElementStub();
    element.dataset.choice = choice;
    return element;
  });
  const privacy = new ElementStub();
  const document = {
    getElementById,
    querySelector(selector) {
      assert.equal(selector, ".privacy-note");
      return privacy;
    },
    querySelectorAll(selector) {
      assert.equal(selector, ".status-button");
      return statuses;
    },
  };
  const context = createContext({ document, localStorage: storage, window: {} });
  if (withVisuals) runInContext(visualScript, context);
  runInContext(workshopScript, context);
  return { context, getElementById, statuses };
}

test("les avis des deux séries restent séparés et sont réunis dans l’export", () => {
  const original = JSON.stringify(legacyState());
  const storage = new StorageStub({ [v1Key]: original });
  const app = createWorkshop(storage);

  app.getElementById("userNote").input("Nouvel avis utilisateur");
  app.getElementById("clientNote").input("Nouvel avis cliente");
  app.statuses[0].click();
  assert.equal(storage.getItem(v1Key), original);
  const savedV2 = storage.getItem(v2Key);
  assert.equal(JSON.parse(savedV2).reviews.guichet.status, "keep");

  runInContext("selectSeries(series.v1)", app.context);
  assert.equal(app.getElementById("userNote").value, "Ancien avis utilisateur");
  assert.equal(app.getElementById("clientNote").value, "Ancien avis cliente");
  app.getElementById("userNote").input("Ancien avis complété");
  assert.equal(storage.getItem(v2Key), savedV2);
  const savedV1 = JSON.parse(storage.getItem(v1Key));
  assert.equal(savedV1.marker, "métadonnée conservée");
  assert.equal(savedV1.reviews.ledger.extra, "champ conservé");

  const markdown = runInContext("buildMarkdown()", app.context);
  for (const text of [
    "## Nouvelles pistes", "## Première série", "Nouvel avis utilisateur",
    "Nouvel avis cliente", "Ancien avis complété", "Ancien avis cliente",
  ]) {
    assert.ok(markdown.includes(text), `L’export ne contient pas « ${text} ».`);
  }
  assert.equal((markdown.match(/^### \d{2} — /gm) || []).length, 22);

  const reloaded = createWorkshop(storage);
  assert.equal(reloaded.getElementById("userNote").value, "Nouvel avis utilisateur");
  runInContext("selectSeries(series.v1)", reloaded.context);
  assert.equal(reloaded.getElementById("userNote").value, "Ancien avis complété");
});

test("les nouvelles pistes circulaires préservent les avis de la série précédente", () => {
  const reviews = Object.fromEntries(originalV2Ids.map((id) => [id, {
    status: "unreviewed",
    userNote: "",
    clientNote: "",
  }]));
  reviews["open-files"] = {
    status: "keep",
    userNote: "Conserver les dossiers",
    clientNote: "Avis de la cliente",
    extra: "champ conservé",
  };
  const original = JSON.stringify({ current: 7, mode: "single", device: "desktop", reviews, marker: "métadonnée" });
  const storage = new StorageStub({ [v2Key]: original });
  const app = createWorkshop(storage);

  assert.equal(app.getElementById("userNote").value, "Conserver les dossiers");
  assert.equal(app.getElementById("clientNote").value, "Avis de la cliente");
  assert.equal(app.getElementById("overviewMode").textContent, "Voir les 12");
  assert.equal(storage.getItem(v2Key), original);

  runInContext("selectConcept(10)", app.context);
  const saved = JSON.parse(storage.getItem(v2Key));
  assert.equal(saved.marker, "métadonnée");
  assert.equal(saved.reviews["open-files"].extra, "champ conservé");
  assert.equal(saved.reviews["open-files"].userNote, "Conserver les dossiers");
  assert.equal(saved.reviews["circle-ribbon"].status, "unreviewed");
  assert.equal(saved.reviews["circle-plaza"].status, "unreviewed");
  app.getElementById("userNote").input("Une piste circulaire à tester");
  const markdown = runInContext("buildMarkdown()", app.context);
  assert.match(markdown, /Conserver les dossiers/);
  assert.match(markdown, /Une piste circulaire à tester/);
});

test("des données illisibles restent intactes et sont signalées dans l’export", () => {
  const raw = "{retours invalides";
  const storage = new StorageStub({ [v1Key]: raw });
  const app = createWorkshop(storage);

  assert.equal(app.getElementById("storageStatus").dataset.state, "error");
  assert.match(app.getElementById("storageStatus").textContent, /Première série.*ne sont pas lisibles/);
  runInContext("selectSeries(series.v1)", app.context);
  app.getElementById("userNote").input("Avis temporaire");
  app.getElementById("overviewMode").click();

  assert.equal(storage.getItem(v1Key), raw);
  assert.equal(app.getElementById("storageStatus").dataset.state, "error");
  const markdown = runInContext("buildMarkdown()", app.context);
  assert.match(markdown, /Avis temporaire/);
  assert.match(markdown, /ne sont pas lisibles/);
});

test("un stockage inaccessible est signalé sans tentative d’écraser les données", () => {
  const raw = JSON.stringify(legacyState());
  const storage = new StorageStub({ [v1Key]: raw });
  storage.failRead = true;
  const app = createWorkshop(storage);

  app.getElementById("userNote").input("Avis à télécharger");
  assert.equal(storage.writeCount, 0);
  assert.equal(storage.values.get(v1Key), raw);
  assert.match(app.getElementById("storageStatus").textContent, /stockage local est inaccessible/i);
  assert.match(runInContext("buildMarkdown()", app.context), /Avis à télécharger/);
});

test("un échec d’écriture est visible et la sauvegarde reprend ensuite", () => {
  const storage = new StorageStub();
  const app = createWorkshop(storage);
  storage.failWrite = true;

  app.getElementById("userNote").input("Avis non enregistré");
  assert.equal(app.getElementById("storageStatus").dataset.state, "error");
  assert.match(runInContext("buildMarkdown()", app.context), /Avis non enregistré/);
  storage.failWrite = false;
  app.getElementById("userNote").input("Avis enregistré");
  assert.equal(app.getElementById("storageStatus").dataset.state, "ok");
  assert.equal(JSON.parse(storage.getItem(v2Key)).reviews.guichet.userNote, "Avis enregistré");
});

test("si les nouvelles pistes manquent, la première série reste accessible", () => {
  const savedV2 = "retours à ne pas modifier";
  const storage = new StorageStub({ [v1Key]: JSON.stringify(legacyState()), [v2Key]: savedV2 });
  const app = createWorkshop(storage, { withVisuals: false });

  assert.equal(app.getElementById("seriesV2").disabled, true);
  assert.equal(app.getElementById("userNote").value, "Ancien avis utilisateur");
  assert.match(app.getElementById("storageStatus").textContent, /n’ont pas pu être chargées/);
  assert.equal(storage.getItem(v2Key), savedV2);
});

test("les douze nouvelles compositions conservent les rubriques et les démarches", () => {
  const app = createWorkshop(new StorageStub());
  const bundle = app.context.window.fdcVisualV2;
  const actions = [
    "Passer mon permis", "Valider mon permis", "Se former", "Déclarer mes prélèvements",
    "Déclarer une arme", "Déclarer un dégât", "Déclarer une perte", "Se connecter à mon espace",
  ];
  const navigation = [
    "Mes démarches", "Devenir chasseur", "Formations", "Chasser en Vendée",
    "Nature et biodiversité", "La Fédération",
  ];
  assert.equal(bundle.concepts.length, 12);
  assert.equal(new Set(bundle.concepts.map((concept) => concept.id)).size, 12);
  assert.equal(new Set(bundle.concepts.map((concept) => concept.layout)).size, 12);

  for (const concept of bundle.concepts) {
    const markup = bundle.render(concept);
    assert.equal((markup.match(/class="v2-task"/g) || []).length, 8, concept.title);
    for (const label of [...actions, ...navigation, "Actualités"]) {
      assert.ok(markup.includes(label), `« ${label} » manque dans ${concept.title}.`);
    }
    for (const [, image] of markup.matchAll(/<img src="([^"]+)"/g)) {
      assert.ok(existsSync(resolve(dirname(workshopPath), image)), `Image absente : ${image}`);
    }
  }
});
