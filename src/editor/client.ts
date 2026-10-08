import { zipSync, strToU8 } from "fflate";
import { errorMessage, isRecord, type EditorPull } from "./contracts.ts";
import { editorConfig } from "./config.ts";
import { EditorController } from "./controller.ts";
import { GitHubRepository, EditorApiError } from "./github.ts";
import { BrowserRuntime } from "./runtime.ts";
import { CodeModel } from "./model.ts";
import { decodeFile } from "./policy.ts";

function element<T extends HTMLElement>(id: string, kind: { new(...args: never[]): T }): T {
  const value = document.getElementById(id);
  if (!(value instanceof kind)) throw new Error(`Élément d'interface absent : ${id}.`);
  return value;
}
const button = (id: string) => element(id, HTMLButtonElement);
const text = (id: string, value: string) => { element(id, HTMLElement).textContent = value; };
const show = (id: string, visible: boolean) => { element(id, HTMLElement).hidden = !visible; };
const frame = element("preview", HTMLIFrameElement);
const prompt = element("prompt", HTMLTextAreaElement);
const modelChoice = element("model-choice", HTMLSelectElement);
const dialog = element("confirmation", HTMLDialogElement);
const login = element("login", HTMLAnchorElement);
let controller: EditorController;
let modelStatus = "Préparation de l'IA locale…";
let runtimeStatus = "Préchargement des sources…";
let modelLoading = false;
let renderedMessages = "";
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
let confirmation: Promise<boolean> | null = null;
const diagnostics: string[] = [];

function log(message: string) {
  diagnostics.push(message);
  if (diagnostics.length > 80) diagnostics.shift();
  text("diagnostics", diagnostics.join("\n").slice(-12000));
}
function notice(message: string, error = false) {
  const notification = element("notification", HTMLElement);
  notification.textContent = message;
  notification.hidden = false;
  notification.dataset.error = String(error);
  if (noticeTimer) clearTimeout(noticeTimer);
  if (!error) noticeTimer = setTimeout(() => { notification.hidden = true; }, 9000);
}
function report(error: unknown) {
  const message = errorMessage(error);
  log(message);
  notice(message.length > 250 ? `${message.slice(0, 240)}… (diagnostic détaillé dans l'assistant)` : message, true);
  if (error instanceof EditorApiError && error.status === 401) {
    const reconnect = document.createElement("a");
    reconnect.href = `${editorConfig.apiBase}/login`; reconnect.textContent = " Se reconnecter à GitHub";
    element("notification", HTMLElement).append(reconnect);
  }
}
async function act(work: () => Promise<void>) {
  try { await work(); }
  catch (error) { report(error); }
}
function confirm(title: string, description: string, label: string): Promise<boolean> {
  if (confirmation) return confirmation;
  text("confirmation-title", title); text("confirmation-text", description); text("confirm-action", label);
  dialog.returnValue = "";
  confirmation = new Promise<boolean>((resolve) => {
    dialog.addEventListener("close", () => { confirmation = null; resolve(dialog.returnValue === "confirm"); }, { once: true });
    dialog.showModal();
  });
  return confirmation;
}
function progress(message: string) {
  runtimeStatus = message;
  text("runtime-status", message);
  text("background-status", `${modelStatus} · ${message}`);
  if (!controller.pull) text("pull-status", message);
}
const model = new CodeModel((message) => {
  modelStatus = message;
  text("model-status", message); text("background-status", `${message} · ${runtimeStatus}`);
}, () => render(), log);
const runtime = new BrowserRuntime({
  stage: progress, log,
  ready: (url) => controller.preview(url),
  error: (message) => controller.runtimeFailed(message),
});
controller = new EditorController(new GitHubRepository(editorConfig.apiBase), runtime, {
  change: render, progress, error: report, notice: (message) => notice(message),
}, editorConfig.runtimeEnabled);

function renderPulls() {
  const list = element("pull-list", HTMLElement);
  list.replaceChildren();
  for (const pull of controller.pulls) {
    const card = document.createElement("article"); card.className = "pull-card";
    const description = document.createElement("div");
    const heading = document.createElement("h3"); heading.textContent = pull.title.replace(/^\[Editor\]\[[^\]]+\]\s*/, "");
    const detail = document.createElement("p"); detail.textContent = `#${pull.number} · ${pull.author} · ${new Date(pull.updatedAt).toLocaleDateString("fr-FR")}`;
    description.append(heading, detail);
    const actions = document.createElement("div"); actions.className = "pull-card-actions";
    const resume = document.createElement("button"); resume.textContent = "Reprendre"; resume.disabled = controller.busy;
    resume.addEventListener("click", () => { void act(() => controller.select(pull)); });
    const abandon = document.createElement("button"); abandon.textContent = "Abandonner"; abandon.className = "quiet danger"; abandon.disabled = controller.busy;
    abandon.addEventListener("click", () => { void abandonPull(pull); });
    actions.append(resume, abandon); card.append(description, actions); list.append(card);
  }
}
function renderMessages() {
  const messages = controller.workspace?.messages ?? [];
  const fingerprint = JSON.stringify(messages);
  if (fingerprint === renderedMessages) return;
  renderedMessages = fingerprint;
  const list = element("messages", HTMLElement);
  list.replaceChildren();
  if (!messages.length) {
    const welcome = document.createElement("p"); welcome.className = "message assistant";
    welcome.textContent = "Que souhaitez-vous changer ? Vous pouvez parler du texte, d'une page ou de son apparence. Rien ne sera publié sans votre confirmation.";
    list.append(welcome);
  }
  for (const message of messages.slice(-100)) {
    const paragraph = document.createElement("p"); paragraph.className = `message ${message.role}`; paragraph.textContent = message.text;
    list.append(paragraph);
  }
  list.scrollTop = list.scrollHeight;
}
function render() {
  if (!controller) return;
  const authenticated = controller.status?.authenticated === true;
  const allowed = authenticated && controller.status?.canWrite === true;
  const selected = Boolean(controller.pull);
  const busy = controller.busy;
  document.body.classList.toggle("editing", selected);
  show("welcome", !allowed); show("selection", allowed && !selected); show("atelier", selected);
  show("editor-actions", selected); show("select-pull", selected); show("logout", authenticated);
  button("logout").disabled = busy;
  if (controller.status) {
    login.href = `${editorConfig.apiBase}/login`;
    login.setAttribute("aria-disabled", String(!controller.status.configured));
    text("connection-status", controller.status.message ?? (authenticated
      ? "Ce compte doit avoir un accès en écriture au dépôt. Vous pouvez vous déconnecter pour changer de compte."
      : controller.status.configured ? "Connectez-vous pour retrouver vos modifications." : "La connexion GitHub n'est pas encore configurée sur cet environnement."));
  }
  if (allowed && !selected) {
    text("pull-status", busy ? runtimeStatus : controller.pulls.length ? "Reprenez une modification ou créez-en une nouvelle." : "Aucune modification en cours. Donnez un nom à votre idée.");
    renderPulls();
  }
  button("create").disabled = busy;
  element("request-name", HTMLInputElement).disabled = busy;
  button("select-pull").disabled = busy;
  button("change-pull").disabled = busy;
  button("close-pull").disabled = busy;
  const writable = Boolean(controller.workspace && controller.runtimeReady && !controller.conflicted && !controller.remoteChanged && !controller.published);
  button("save").disabled = busy || !writable || !controller.workspace?.dirty;
  button("publish").disabled = !controller.canPublish;
  button("publish").title = controller.checks?.message ?? "Attendre les contrôles GitHub sur la version sauvegardée.";
  button("send").disabled = busy || !writable || !model.ready;
  prompt.disabled = busy || !writable;
  button("undo").disabled = busy || !writable || !controller.workspace?.history.length;
  show("stop-agent", controller.agentRunning);
  button("reload-model").disabled = controller.agentRunning || modelLoading;
  button("stop-model").disabled = controller.agentRunning;
  button("pause-preload").disabled = controller.agentRunning;
  modelChoice.disabled = controller.agentRunning || modelLoading;
  show("discard-conflict", controller.conflicted);
  button("discard-conflict").disabled = busy;
  button("export-draft").disabled = busy || !controller.workspace;
  show("retry-runtime", selected && !controller.runtimeReady && !busy && editorConfig.runtimeEnabled);
  show("preview-loading", !controller.runtimeReady); show("preview", controller.runtimeReady);
  if (controller.pull) {
    text("select-pull", controller.pull.title.replace(/^\[Editor\]\[[^\]]+\]\s*/, ""));
    element("github-link", HTMLAnchorElement).href = controller.pull.url;
    const deployment = controller.deployment;
    text("save-status", controller.conflicted ? "Brouillon local en conflit" : controller.remoteChanged ? "Version GitHub modifiée"
      : controller.published ? deployment?.state === "success" ? "Déploiement confirmé" : deployment?.state === "failure" ? "Déploiement échoué" : "Fusionné · déploiement en attente"
      : controller.workspace?.dirty ? "Brouillon local · non envoyé" : controller.checks?.message ?? "Version sauvegardée");
    if (controller.runtimeReady && controller.previewUrl) {
      const target = new URL(controller.route, controller.previewUrl).href;
      if (frame.src !== target) frame.src = target;
    }
    if (controller.published && deployment) text("runtime-status", deployment.message);
  }
  renderMessages();
}
async function loadModel() {
  modelLoading = true; render();
  try { await model.load(modelChoice.value === "1.5b" ? editorConfig.smallModel : editorConfig.model); }
  catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError")) {
      modelStatus = `IA locale indisponible : ${errorMessage(error)}`;
      text("model-status", modelStatus); text("background-status", modelStatus);
      report(error);
    }
  } finally { modelLoading = false; render(); }
}
async function abandonPull(pull: EditorPull) {
  if (await confirm("Abandonner cette modification ?", "La PR sera fermée sans publication. Sa branche GitHub et les brouillons de ce navigateur seront conservés.", "Abandonner")) {
    show("pull-menu", false); button("select-pull").setAttribute("aria-expanded", "false");
    await act(() => controller.abandon(pull));
  }
}
element("create-form", HTMLFormElement).addEventListener("submit", (event) => {
  event.preventDefault();
  const name = element("request-name", HTMLInputElement).value.trim();
  if (!name) { notice("Donnez un nom à la modification avant de la créer.", true); return; }
  if (!controller.busy) void act(() => controller.create(name));
});
element("chat-form", HTMLFormElement).addEventListener("submit", (event) => {
  event.preventDefault();
  const request = prompt.value.trim();
  if (!request) { notice("Décrivez une modification avant de l'envoyer.", true); return; }
  if (button("send").disabled) return;
  prompt.value = "";
  void act(() => controller.chat(request, (system, request, context, signal) => model.complete(system, request, context, signal)));
});
prompt.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); element("chat-form", HTMLFormElement).requestSubmit(); }
});
button("select-pull").addEventListener("click", () => {
  const visible = element("pull-menu", HTMLElement).hidden;
  show("pull-menu", visible); button("select-pull").setAttribute("aria-expanded", String(visible));
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") { show("pull-menu", false); button("select-pull").setAttribute("aria-expanded", "false"); }
});
document.addEventListener("click", (event) => {
  if (event.target instanceof Node && !element("pull-menu", HTMLElement).contains(event.target) && !button("select-pull").contains(event.target)) {
    show("pull-menu", false); button("select-pull").setAttribute("aria-expanded", "false");
  }
});
button("change-pull").addEventListener("click", () => {
  show("pull-menu", false); button("select-pull").setAttribute("aria-expanded", "false"); void act(() => controller.leave());
});
button("close-pull").addEventListener("click", () => { if (controller.pull) void abandonPull(controller.pull); });
button("save").addEventListener("click", () => { void act(() => controller.save()); });
button("publish").addEventListener("click", () => {
  const pull = controller.pull;
  if (!pull) return;
  void act(async () => {
    if (await confirm("Mettre cette modification en production ?", `La PR #${pull.number} sera fusionnée dans main. Le déploiement Cloudflare démarrera ensuite ; une fusion ne garantit pas un déploiement réussi.`, "Fusionner dans main")) {
      if (controller.pull !== pull) throw new Error("La PR a changé pendant la confirmation. Vérifiez à nouveau.");
      await controller.publish();
    }
  });
});
button("undo").addEventListener("click", () => { void act(() => controller.undo()); });
button("stop-agent").addEventListener("click", () => { controller.cancelChat(); model.interrupt(); });
button("retry-runtime").addEventListener("click", () => { void act(() => controller.retryRuntime()); });
button("reload-model").addEventListener("click", () => { void loadModel(); });
const stopModel = () => { model.stop(); modelStatus = "Modèle arrêté · le cache est conservé"; text("model-status", modelStatus); text("background-status", modelStatus); };
button("stop-model").addEventListener("click", stopModel);
button("pause-preload").addEventListener("click", stopModel);
button("logout").addEventListener("click", () => {
  void act(async () => { await controller.logout(); model.stop(); location.assign(new URL(`${import.meta.env.BASE_URL}edit/`, location.origin)); });
});
button("export-draft").addEventListener("click", () => {
  void act(async () => {
    const draft = await controller.exportDraft();
    const files: Record<string, Uint8Array> = { ".editor/draft.json": strToU8(JSON.stringify({ sha: draft.sha, deleted: draft.changes.filter((change) => change.content === null).map((change) => change.path) })) };
    for (const change of draft.changes) if (change.content !== null) files[change.path] = decodeFile({ content: change.content, encoding: change.encoding });
    const url = URL.createObjectURL(new Blob([new Uint8Array(zipSync(files)).buffer], { type: "application/zip" }));
    const download = document.createElement("a"); download.href = url; download.download = `brouillon-pr-${controller.pull?.number ?? "local"}.zip`; download.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    notice("Votre brouillon a été exporté. Il reste aussi conservé dans ce navigateur.");
  });
});
button("discard-conflict").addEventListener("click", () => {
  void act(async () => {
    if (await confirm("Reprendre la version GitHub ?", "Le brouillon local en conflit sera effacé. Exportez-le d'abord si vous souhaitez le conserver. Aucun fichier GitHub ne sera modifié.", "Effacer le brouillon local")) await controller.discardConflict();
  });
});
for (const id of ["desktop", "mobile"]) button(id).addEventListener("click", () => {
  element("preview-frame", HTMLElement).classList.toggle("mobile", id === "mobile");
  button("desktop").setAttribute("aria-pressed", String(id === "desktop")); button("mobile").setAttribute("aria-pressed", String(id === "mobile"));
});
for (const id of ["preview", "chat"]) button(`${id}-tab`).addEventListener("click", () => {
  element("workspace", HTMLElement).dataset.tab = id;
  button("preview-tab").setAttribute("aria-pressed", String(id === "preview")); button("chat-tab").setAttribute("aria-pressed", String(id === "chat"));
});
window.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (!controller.previewUrl || event.source !== frame.contentWindow || event.origin !== new URL(controller.previewUrl).origin
    || !isRecord(event.data) || event.data.type !== "editor-preview-route" || typeof event.data.pathname !== "string"
    || !event.data.pathname.startsWith("/") || event.data.pathname.startsWith("//") || event.data.pathname.length > 500) return;
  if (new URL(event.data.pathname, controller.previewUrl).origin !== event.origin) return;
  controller.route = event.data.pathname;
});
window.addEventListener("beforeunload", (event) => {
  if (controller.busy || controller.workspace?.dirty) event.preventDefault();
});
window.addEventListener("pagehide", () => { controller.dispose(); model.stop(); });
window.addEventListener("pageshow", (event) => { if (event.persisted) location.reload(); });
render();
void loadModel();
void act(async () => {
  try { await controller.initialize(); }
  catch (error) { text("connection-status", errorMessage(error)); throw error; }
});
