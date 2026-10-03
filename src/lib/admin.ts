import type { PreviewManifest } from "./preview-manifest";
import {
  cloudflareCheck, comparisonState, freshnessState, isRecord, normalizeBase,
  parseIdentity, REPOSITORY, sitePath,
} from "./preview.mjs";

function element<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Commande de prévisualisation absente : ${id}`);
  return node as T;
}

const manifest: PreviewManifest = JSON.parse(element("preview-manifest").textContent ?? "");
const current = parseIdentity(manifest);
const catalogue = element("content-list");
const search = element<HTMLInputElement>("content-search");
const filter = element<HTMLSelectElement>("collection-filter");
const route = element<HTMLSelectElement>("page-route");
const compare = element<HTMLInputElement>("compare");
const working = element<HTMLIFrameElement>("working-frame");
const production = element<HTMLIFrameElement>("production-frame");
let selected = manifest.contents[0];
let productionIdentity: ReturnType<typeof parseIdentity> | null = null;
let productionBase = "/";
let productionMetadataError = "";
let frameRevision = 0;
let branchRevision = 0;

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Une erreur inattendue empêche cette vérification.";
}

async function request(url: string, accept = "application/json"): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, {
      cache: "no-store", credentials: "omit", headers: { Accept: accept },
      signal: AbortSignal.timeout(12000),
    });
  } catch (error) {
    throw new Error(`Adresse inaccessible : réseau, protection d’accès ou autorisation entre sites. ${message(error)}`);
  }
  if (!response.ok) {
    if (url.startsWith("https://api.github.com/") && [403, 429].includes(response.status)) {
      throw new Error("GitHub limite les vérifications publiques. Réessayez plus tard ; aucun jeton n’est nécessaire.");
    }
    if (response.status === 404) {
      throw new Error("Adresse introuvable (404). L’espace peut ne pas exister, être privé ou ne pas avoir été déployé.");
    }
    throw new Error(`Le serveur répond avec une erreur (${response.status}).`);
  }
  if (!response.headers.get("content-type")?.includes(accept)) {
    throw new Error("La réponse n’est pas au format attendu. Une protection d’accès ou une ancienne version peut être en cause.");
  }
  return response;
}

async function json(url: string): Promise<unknown> {
  const response = await request(url);
  return response.json();
}

async function latestCommit(branch: string): Promise<string> {
  const value = await json(`https://api.github.com/repos/${REPOSITORY}/commits/${encodeURIComponent(branch)}`);
  if (!isRecord(value) || typeof value.sha !== "string" || !/^[a-f0-9]{40}$/i.test(value.sha)) {
    throw new Error("GitHub ne fournit pas un identifiant de version valide.");
  }
  return value.sha;
}

async function readyWorkspace(branch: string, sha: string) {
  const checks = await json(`https://api.github.com/repos/${REPOSITORY}/commits/${sha}/check-runs?per_page=100`);
  const check = cloudflareCheck(checks, sha);
  const explanations: Record<string, string> = {
    pending: "La nouvelle version est en cours de construction. Réessayez dans quelques instants.",
    failed: "La construction a échoué. Consultez les contrôles dans GitHub ; la version précédente reste affichée.",
    missing: "Cloudflare n’a pas encore signalé de déploiement pour cet enregistrement.",
    unlocated: "Cloudflare annonce une réussite, mais ne fournit pas d’adresse de prévisualisation vérifiable.",
  };
  if (!check.url) throw new Error(explanations[check.state] ?? "Déploiement non vérifiable.");
  const identity = parseIdentity(await json(`${check.url}${sitePath(manifest.base, "admin/preview.json")}`));
  if (identity.commit !== sha || identity.branch !== branch || identity.base !== normalizeBase(manifest.base)) {
    throw new Error("L’adresse répond, mais sa version ne correspond pas à l’espace demandé. Aucun lien prêt n’est proposé.");
  }
  return `${check.url}${sitePath(identity.base, "admin/")}`;
}

async function refreshFreshness() {
  const button = element<HTMLButtonElement>("refresh-version");
  const status = element("freshness");
  const link = element<HTMLAnchorElement>("fresh-version");
  link.hidden = true;
  if (current.environment === "local") {
    status.textContent = "Aperçu local : les fichiers locaux ne constituent pas un déploiement confirmé.";
    return;
  }
  if (!current.branch || !current.commit) {
    status.textContent = "Fraîcheur inconnue : l’hébergeur n’a pas fourni l’espace et l’identifiant enregistrés.";
    return;
  }
  button.disabled = true;
  status.textContent = "Vérification des derniers enregistrements…";
  try {
    const latest = await latestCommit(current.branch);
    const time = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    if (freshnessState(current.commit, latest) === "current") {
      status.textContent = `À jour à ${time} : cet aperçu correspond au dernier enregistrement. Les champs non sauvegardés ne sont pas visibles.`;
    } else {
      status.textContent = "Un nouvel enregistrement existe. Cette page affiche encore la version précédente.";
      try {
        link.href = await readyWorkspace(current.branch, latest);
        link.hidden = false;
        status.textContent = "Une version plus récente est prête. Ouvrez-la pour voir vos derniers enregistrements.";
      } catch (error) {
        status.textContent = `Aperçu ancien. ${message(error)}`;
      }
    }
  } catch (error) {
    status.textContent = `Fraîcheur non vérifiée. ${message(error)}`;
  } finally {
    button.disabled = false;
  }
}

function updateComparison() {
  const state = comparisonState(current, productionIdentity);
  const labels: Record<string, string> = {
    same: "Même version enregistrée que le site public. Aucun écart de version confirmé.",
    different: "Version de travail différente du site public. Il s’agit d’un écart de version, pas d’une détection des changements visuels.",
    unknown: `La version du site public ne peut pas être comparée automatiquement. ${productionMetadataError || "L’aperçu est local ou l’identifiant est absent."}`,
  };
  element("comparison-status").textContent = compare.checked ? labels[state]
    : "La comparaison porte sur les versions enregistrées, pas sur les champs non sauvegardés.";
}

async function loadProductionIdentity() {
  productionIdentity = null;
  productionMetadataError = "Vérification de l’identité du site public en cours…";
  updateComparison();
  try {
    const identity = parseIdentity(await json(`${manifest.productionUrl}/admin/preview.json`));
    if (identity.environment !== "production") throw new Error("Le site public n’annonce pas une version de production.");
    productionIdentity = identity;
    productionMetadataError = "";
    productionBase = productionIdentity.base;
  } catch (error) {
    productionMetadataError = message(error);
  }
  updateComparison();
}

function productionUrl(path: string) {
  const relative = path.slice(normalizeBase(manifest.base).length);
  return new URL(sitePath(productionBase, relative), manifest.productionUrl).href;
}

async function checkFrame(url: string, statusId: string, revision: number) {
  const status = element(statusId);
  status.textContent = "Vérification de l’accès à la page…";
  try {
    await request(url, "text/html");
    if (revision !== frameRevision) return;
    status.textContent = "Page accessible. Le cadre affiche le site réel ; si son affichage est bloqué, utilisez « Pleine page ».";
  } catch (error) {
    if (revision !== frameRevision) return;
    status.textContent = `Affichage non confirmé. ${message(error)} Utilisez le lien « Pleine page » pour vérifier directement.`;
  }
}

function showFrames() {
  frameRevision += 1;
  const path = route.value;
  const available = Boolean(path);
  element<HTMLAnchorElement>("working-fullscreen").hidden = !available;
  element<HTMLAnchorElement>("production-fullscreen").hidden = !available;
  working.hidden = !available;
  production.hidden = !available;
  element("production-pane").hidden = !compare.checked;
  element("preview-panes").classList.toggle("comparing", compare.checked);
  if (!available) {
    working.removeAttribute("src");
    production.removeAttribute("src");
    element("working-state").textContent = "Cette ressource n’est affichée par aucun index compilé. Aucun aperçu de page n’est inventé.";
    element("production-state").textContent = "Aucune page correspondante à comparer.";
    updateComparison();
    return;
  }
  const localUrl = new URL(path, location.origin).href;
  working.src = localUrl;
  element<HTMLAnchorElement>("working-fullscreen").href = localUrl;
  void checkFrame(localUrl, "working-state", frameRevision);
  const publicUrl = productionUrl(path);
  element<HTMLAnchorElement>("production-fullscreen").href = publicUrl;
  if (compare.checked) {
    production.src = publicUrl;
    void checkFrame(publicUrl, "production-state", frameRevision);
  } else {
    production.removeAttribute("src");
  }
  updateComparison();
  sizeFrames();
}

function sizeFrames() {
  const mobile = element("preview-panes").dataset.device === "mobile";
  const width = (mobile ? 390 : 1200) + 2;
  const height = (mobile ? 780 : 740) + 2;
  for (const viewport of document.querySelectorAll<HTMLElement>(".frame-viewport")) {
    if (!viewport.clientWidth) continue;
    const scale = Math.min(1, Math.max(0.1, (viewport.clientWidth - 32) / width));
    viewport.style.setProperty("--frame-scale", String(scale));
    viewport.style.setProperty("--frame-left", `${(viewport.clientWidth - width * scale) / 2}px`);
    viewport.style.setProperty("--frame-height", `${height * scale + 32}px`);
  }
}

function selectContent(id: string) {
  const item = manifest.contents.find((candidate) => candidate.id === id);
  if (!item) throw new Error("Ce contenu n’existe pas dans la version construite.");
  selected = item;
  for (const button of catalogue.querySelectorAll<HTMLButtonElement>("button[data-content]")) {
    button.setAttribute("aria-pressed", String(button.dataset.content === item.id));
  }
  element("selected-title").textContent = item.title;
  element("selected-kind").textContent = item.label;
  const note = element("selected-note");
  note.textContent = item.note;
  note.hidden = !item.note;
  const editor = element<HTMLAnchorElement>("edit-content");
  editor.hidden = !item.editorUrl;
  if (item.editorUrl) editor.href = item.editorUrl;
  const collection = manifest.collections.find((candidate) => candidate.name === item.collection);
  const collectionLink = element<HTMLAnchorElement>("collection-editor");
  collectionLink.hidden = !collection?.editorUrl;
  if (collection?.editorUrl) collectionLink.href = collection.editorUrl;
  route.replaceChildren(...item.pages.map((page) => new Option(page.title, page.path)));
  route.disabled = item.pages.length === 0;
  showFrames();
  const url = new URL(location.href);
  url.searchParams.set("content", item.id);
  history.replaceState(null, "", url);
}

function filterContents() {
  const normalized = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("fr");
  const query = normalized(search.value.trim());
  let count = 0;
  for (const item of catalogue.querySelectorAll<HTMLLIElement>("li")) {
    item.hidden = Boolean(filter.value && filter.value !== item.dataset.collection)
      || !normalized(item.dataset.search ?? "").includes(query);
    if (!item.hidden) count += 1;
  }
  element("result-count").textContent = `${count} contenu${count === 1 ? "" : "s"}`;
  element("no-results").hidden = count !== 0;
  const collection = manifest.collections.find((item) => item.name === (filter.value || selected.collection));
  const link = element<HTMLAnchorElement>("collection-editor");
  link.hidden = !collection?.editorUrl;
  if (collection?.editorUrl) link.href = collection.editorUrl;
}

catalogue.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest<HTMLButtonElement>("button[data-content]");
  if (button?.dataset.content) selectContent(button.dataset.content);
});
search.addEventListener("input", filterContents);
filter.addEventListener("change", filterContents);
route.addEventListener("change", showFrames);
compare.addEventListener("change", async () => {
  showFrames();
  if (compare.checked) {
    await loadProductionIdentity();
    showFrames();
  }
});
for (const input of document.querySelectorAll<HTMLInputElement>('input[name="device"]')) {
  input.addEventListener("change", () => {
    if (input.checked) {
      element("preview-panes").dataset.device = input.value;
      sizeFrames();
    }
  });
}
element("refresh-version").addEventListener("click", async () => {
  await refreshFreshness();
  if (compare.checked) {
    await loadProductionIdentity();
    showFrames();
  }
});
element<HTMLFormElement>("branch-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const revision = ++branchRevision;
  const branch = element<HTMLInputElement>("branch").value.trim();
  const status = element("branch-status");
  const link = element<HTMLAnchorElement>("branch-open");
  link.hidden = true;
  status.textContent = "Recherche de la dernière version enregistrée et de son déploiement…";
  try {
    if (!branch) throw new Error("Saisissez le nom de l’espace.");
    const sha = await latestCommit(branch);
    const url = await readyWorkspace(branch, sha);
    if (revision !== branchRevision) return;
    link.href = url;
    link.hidden = false;
    status.textContent = "Version prête : Cloudflare a terminé la construction et l’identifiant de la page correspond.";
  } catch (error) {
    if (revision !== branchRevision) return;
    status.textContent = `Aucun aperçu prêt proposé. ${message(error)}`;
  }
});
element("branch").addEventListener("input", () => {
  branchRevision += 1;
  element("branch-open").hidden = true;
  element("branch-status").textContent = "Validez ce nom pour rechercher sa version prête.";
});

const requested = new URL(location.href).searchParams.get("content");
const resizeObserver = new ResizeObserver(sizeFrames);
document.querySelectorAll(".frame-viewport").forEach((viewport) => resizeObserver.observe(viewport));
if (requested && !manifest.contents.some((item) => item.id === requested)) {
  selectContent("home");
  element("selected-note").hidden = false;
  element("selected-note").textContent = "Le contenu demandé n’existe plus dans cette version. L’accueil est affiché.";
} else {
  selectContent(requested ?? "home");
}
void refreshFreshness();
