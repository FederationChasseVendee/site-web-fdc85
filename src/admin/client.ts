import { parseDocument } from "yaml";
import { zipSync, strToU8 } from "fflate";
import { BrowserRuntime } from "./runtime.mjs";
import { changedDrafts, compatibility, previewRoute, validateSnapshot } from "./model.mjs";
import type { SiteSnapshot, EditorGroup } from "./model.mjs";

function element<T extends HTMLElement>(id: string, constructor: { new(): T }): T {
  const node = document.getElementById(id);
  if (!(node instanceof constructor)) throw new Error(`Élément d’atelier absent : ${id}`);
  return node;
}
const button = (id: string) => element(id, HTMLButtonElement);
const start = button("start");
const stop = button("stop");
const apply = button("apply");
const exportButton = button("export");
const collection = element("collection", HTMLSelectElement);
const file = element("file", HTMLSelectElement);
const source = element("source", HTMLTextAreaElement);
const frame = element("preview", HTMLIFrameElement);
const route = element("route", HTMLInputElement);
const base = element("admin-config", HTMLDivElement).dataset.base;
if (!base) throw new Error("Préfixe de déploiement absent.");
const publicBase = new URL(base, location.origin).href;
const message = element("message", HTMLParagraphElement);
const logs = element("logs", HTMLPreElement);
const storageKey = `fdc85-browser-drafts:${base}`;
let snapshot: SiteSnapshot | null = null;
let drafts: Record<string, string> = {};
let serverUrl = "";
let fetching = false;
let applying = false;
let navigating = false;
let editRevision = 0;
let exportedRevision = -1;
let staleDrafts = false;
let downloadAbort: AbortController | null = null;
let startGeneration = 0;
const stageText: Record<string, [string, string]> = {
  boot: ["Initialisation de Node", "Téléchargement du moteur WebContainers. Rien à installer sur votre ordinateur."],
  mount: ["Chargement du site public", "Les sources originales sont montées dans le système de fichiers virtuel."],
  install: ["Installation des dépendances npm", "Premier démarrage : plusieurs minutes possibles, selon le réseau et les caches."],
  wasm: ["Téléchargement des compilateurs WASM", "Versions officielles de Rolldown, Astro et Markdown, correspondant au verrou npm du site."],
  server: ["Lancement du vrai serveur Astro", "Astro 7 prépare les collections et ses compilateurs WASI. Attendez le signal du serveur."],
  ready: ["Serveur Astro prêt", "Modifiez un fichier puis appliquez-le : Astro actualise le site à chaud."],
};
function announce(text: string) { message.textContent = text; }
function updateControls() {
  start.disabled = fetching || runtime.busy || Boolean(runtime.container);
  stop.disabled = !fetching && !runtime.busy && !runtime.container;
  apply.disabled = !runtime.ready || applying || navigating || !snapshot;
  button("navigate").disabled = button("refresh").disabled = !runtime.ready;
  exportButton.disabled = !snapshot || Object.keys(changedDrafts(drafts, snapshot)).length === 0;
  element("dirty-state", HTMLParagraphElement).textContent = snapshot
    ? `${Object.keys(changedDrafts(drafts, snapshot)).length} fichier(s) modifié(s), uniquement dans ce navigateur.${staleDrafts ? " Le site a changé depuis ces brouillons : comparez les fichiers avant publication." : ""}`
    : "Aucun brouillon.";
}
function showError(text: string) {
  announce(text);
  element("status-dot", HTMLSpanElement).dataset.state = "error";
  element("stage-title", HTMLElement).textContent = "L’environnement n’est pas disponible";
  start.textContent = runtime.needsReload ? "Recharger pour réessayer" : "Réessayer";
  frame.hidden = true;
  frame.removeAttribute("src");
  element("preview-placeholder", HTMLParagraphElement).hidden = false;
  serverUrl = "";
  updateControls();
}
const runtime = new BrowserRuntime({
  boot: async () => {
    // No vendor request, worker or runtime download before the explicit start.
    const { WebContainer } = await import("@webcontainer/api");
    return WebContainer.boot({ coep: "require-corp", workdirName: "fdc85-brouillon", forwardPreviewErrors: "exceptions-only" });
  },
  stage: (stage) => {
    const [title, detail] = stageText[stage];
    element("stage-title", HTMLElement).textContent = title;
    element("stage-detail", HTMLParagraphElement).textContent = detail;
    element("status-dot", HTMLSpanElement).dataset.state = stage === "ready" ? "ready" : "busy";
    if (stage === "ready") announce("Aperçu local prêt. Aucune modification n’est publiée.");
    updateControls();
  },
  log: (text) => {
    logs.textContent = ((logs.textContent ?? "") + text.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "")).slice(-32_000);
    logs.scrollTop = logs.scrollHeight;
  },
  ready: (url) => {
    serverUrl = url;
    navigate();
  },
  error: showError,
});

function persist() {
  if (!snapshot) return;
  drafts = changedDrafts(drafts, snapshot);
  try {
    localStorage.setItem(storageKey, JSON.stringify({ sourceHash: snapshot.sourceHash, drafts }));
  } catch (error) {
    announce(`Stockage local indisponible : exportez vos brouillons avant de fermer (${String(error)}).`);
  }
  updateControls();
}
function currentGroup(): EditorGroup {
  const group = snapshot?.editors.find((item) => item.name === collection.value);
  if (!group) throw new Error("Collection inconnue.");
  return group;
}
function selectFile() {
  if (!snapshot || !snapshot.files[file.value]) return;
  source.value = drafts[file.value] ?? snapshot.files[file.value].contents;
  source.disabled = false;
  route.value = previewRoute(file.value, currentGroup());
  if (serverUrl) navigate();
}
function selectCollection() {
  file.replaceChildren(...currentGroup().files.map((path) => new Option(path.replace("src/content/", ""), path)));
  file.disabled = false;
  selectFile();
}
async function loadSnapshot() {
  downloadAbort = new AbortController();
  const signal = AbortSignal.any([downloadAbort.signal, AbortSignal.timeout(30_000)]);
  const response = await fetch(new URL("admin-runtime/site.json", publicBase), { credentials: "omit", signal });
  if (!response.ok) throw new Error(`Sources publiques introuvables (HTTP ${response.status}). Redéployez la branche.`);
  const candidate: SiteSnapshot = await response.json();
  signal.throwIfAborted();
  validateSnapshot(candidate);
  snapshot = candidate;
  let stored: { sourceHash: string; drafts: Record<string, string> } | null = null;
  try {
    stored = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (stored && (typeof stored.drafts !== "object" || !stored.drafts
      || Object.values(stored.drafts).some((value) => typeof value !== "string"))) {
      throw new Error("Format de brouillon invalide.");
    }
  } catch (error) { announce(`Les brouillons stockés ne peuvent pas être lus : ${String(error)}.`); }
  if (stored) {
    drafts = changedDrafts(stored.drafts, snapshot);
    if (stored.sourceHash !== snapshot.sourceHash) {
      staleDrafts = true;
      announce("Le site publié a changé. Les brouillons ont été conservés pour export ; vérifiez chaque fichier avant de l’appliquer.");
    }
  }
  collection.replaceChildren(...snapshot.editors.map((group) => new Option(group.label, group.name)));
  collection.disabled = false;
  selectCollection();
  updateControls();
}
function navigate() {
  if (!serverUrl) return;
  if (!route.value.startsWith("/") || route.value.startsWith("//") || route.value.includes("\\")) {
    announce("Saisissez une adresse locale commençant par un seul /.");
    return;
  }
  const target = new URL(route.value, serverUrl);
  if (target.origin !== new URL(serverUrl).origin) {
    announce("L’aperçu ne peut ouvrir qu’une adresse du serveur Astro local.");
    return;
  }
  navigating = true;
  frame.setAttribute("aria-busy", "true");
  updateControls();
  frame.src = target.href;
  frame.hidden = false;
  element("preview-placeholder", HTMLParagraphElement).hidden = true;
}
frame.addEventListener("load", () => {
  navigating = false;
  frame.setAttribute("aria-busy", "false");
  updateControls();
});
function validateContents(path: string, contents: string) {
  if (path.endsWith(".json")) {
    JSON.parse(contents);
  } else {
    const match = contents.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!match) throw new Error("L’en-tête YAML doit être encadré par deux lignes ---.");
    const document = parseDocument(match[1], { uniqueKeys: true });
    if (document.errors.length) throw new Error(document.errors[0].message);
  }
}
start.addEventListener("click", async () => {
  if (fetching || runtime.busy || runtime.container) return;
  if (runtime.needsReload) { location.reload(); return; }
  const unsupported = compatibility({ secure: isSecureContext, isolated: crossOriginIsolated,
    sharedMemory: typeof SharedArrayBuffer !== "undefined", userAgent: navigator.userAgent });
  if (unsupported) { showError(unsupported); return; }
  fetching = true;
  const generation = ++startGeneration;
  updateControls();
  try {
    if (!snapshot) {
      element("stage-title", HTMLElement).textContent = "Téléchargement des sources publiques";
      await loadSnapshot();
    }
    if (!fetching || generation !== startGeneration || !snapshot) return;
    await runtime.start(snapshot, publicBase, changedDrafts(drafts, snapshot));
  } catch (error) {
    if (generation === startGeneration) showError(error instanceof Error ? error.message : String(error));
  } finally {
    if (generation === startGeneration) { fetching = false; updateControls(); }
  }
});
stop.addEventListener("click", () => {
  ++startGeneration;
  fetching = false;
  downloadAbort?.abort();
  runtime.stop();
  frame.hidden = true;
  navigating = false;
  frame.removeAttribute("src");
  serverUrl = "";
  element("preview-placeholder", HTMLParagraphElement).hidden = false;
  element("stage-title", HTMLElement).textContent = "Environnement arrêté";
  element("status-dot", HTMLSpanElement).dataset.state = "";
  start.textContent = runtime.needsReload ? "Recharger pour réessayer" : "Redémarrer";
  announce("Node est arrêté. Vos brouillons locaux sont conservés.");
  updateControls();
});
source.addEventListener("input", () => {
  drafts[file.value] = source.value;
  ++editRevision;
  persist();
});
collection.addEventListener("change", selectCollection);
file.addEventListener("change", selectFile);
apply.addEventListener("click", async () => {
  const path = file.value;
  const contents = source.value;
  applying = true;
  updateControls();
  try {
    validateContents(path, contents);
    await runtime.write(path, contents);
    announce("Brouillon écrit dans Node. Astro met à jour l’aperçu à chaud ; ses erreurs de schéma apparaissent dans l’aperçu ou le journal. Rien n’est publié.");
  } catch (error) { announce(`Brouillon non appliqué : ${error instanceof Error ? error.message : String(error)}`); }
  finally { applying = false; updateControls(); }
});
exportButton.addEventListener("click", () => {
  if (!snapshot) return;
  const changed = changedDrafts(drafts, snapshot);
  const archive = zipSync(Object.fromEntries(Object.entries(changed).map(([path, text]) => [path, strToU8(text)])));
  const url = URL.createObjectURL(new Blob([new Uint8Array(archive)], { type: "application/zip" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "fdc85-brouillons.zip";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  exportedRevision = editRevision;
  announce("ZIP exporté avec les vrais noms de fichiers. Importez les changements via votre procédure GitHub habituelle ou recopiez-les dans Pages CMS ; rien n’a été publié automatiquement.");
});
button("reset").addEventListener("click", () => {
  if (!confirm("Effacer tous les brouillons locaux et arrêter Node ? Exportez-les d’abord si vous souhaitez les conserver.")) return;
  downloadAbort?.abort();
  runtime.stop();
  try { localStorage.removeItem(storageKey); }
  catch (error) { announce(`Effacement impossible : ${String(error)}.`); return; }
  drafts = {};
  location.reload();
});
button("navigate").addEventListener("click", navigate);
route.addEventListener("keydown", (event) => { if (event.key === "Enter") navigate(); });
button("refresh").addEventListener("click", navigate);
for (const mode of ["desktop", "mobile"]) {
  button(mode).addEventListener("click", () => {
    frame.dataset.mobile = String(mode === "mobile");
    button("desktop").setAttribute("aria-pressed", String(mode === "desktop"));
    button("mobile").setAttribute("aria-pressed", String(mode === "mobile"));
  });
}
window.addEventListener("beforeunload", (event) => {
  if (snapshot && Object.keys(changedDrafts(drafts, snapshot)).length && exportedRevision !== editRevision) {
    event.preventDefault();
  }
});
window.addEventListener("pagehide", () => runtime.stop());
