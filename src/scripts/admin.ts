import {
  cmsFrameMessage, cmsUrl, deploymentFromCheck, previewUrl, PRODUCTION_ORIGIN,
  validateDeployment, type AdminManifest, type CmsFrameState,
} from "../lib/admin";

export function initializeAdmin(): void {
  if (window.self !== window.top) {
    document.body.replaceChildren(Object.assign(document.createElement("p"), {
      textContent: "L’administration ne peut pas être prévisualisée dans elle-même. Ouvrez /admin/ dans un onglet séparé.",
    }));
    return;
  }
  function element<T extends HTMLElement>(id: string): T {
    const found = document.getElementById(id);
    if (!found) throw new Error(`Élément de l’atelier absent : ${id}.`);
    return found as T;
  }
  const manifest: AdminManifest = JSON.parse(element("admin-manifest").textContent!);
  const contentSelect = element<HTMLSelectElement>("content-select");
  const routeSelect = element<HTMLSelectElement>("route-select");
  const cmsFrame = element<HTMLIFrameElement>("cms-frame");
  const previewFrame = element<HTMLIFrameElement>("preview-frame");
  const productionFrame = element<HTMLIFrameElement>("production-frame");
  const workspace = element("workspace");
  let previewOrigin = manifest.deployment || window.location.origin;
  let previewBase = manifest.base;
  let selectedContent = "home";
  let selectedRoute = "";
  let comparing = false;
  let cmsTimer: ReturnType<typeof setTimeout>;
  let previewTimer: ReturnType<typeof setTimeout>;
  let productionTimer: ReturnType<typeof setTimeout>;
  let visibleCommit = manifest.commit;

  const setCmsState = (state: CmsFrameState) => {
    element("cms-status").textContent = cmsFrameMessage(state);
  };
  const loadCms = () => {
    clearTimeout(cmsTimer);
    const content = manifest.contents.find((item) => item.id === selectedContent);
    const url = cmsUrl(manifest.branch, content);
    element<HTMLAnchorElement>("cms-own-tab").href = url;
    if (manifest.branch === "main") {
      element("cms-status").textContent = "Cet atelier provient de main. Créez une branche de travail dans GitHub et ouvrez son déploiement avant de modifier. Enregistrer sur main déclenche une publication.";
      return;
    }
    setCmsState("loading");
    cmsFrame.src = url;
    cmsTimer = setTimeout(() => setCmsState("timeout"), 12000);
  };
  cmsFrame.addEventListener("load", () => {
    if (!cmsFrame.hasAttribute("src")) return;
    clearTimeout(cmsTimer);
    setCmsState("unverified");
  });
  cmsFrame.addEventListener("error", () => {
    if (!cmsFrame.hasAttribute("src")) return;
    clearTimeout(cmsTimer);
    setCmsState("error");
  });
  element("cms-reload").addEventListener("click", loadCms);

  function renderContents(search = ""): void {
    const query = search.toLocaleLowerCase("fr");
    contentSelect.replaceChildren();
    const groups = new Map<string, HTMLOptGroupElement>();
    for (const content of manifest.contents) {
      if (content.id !== selectedContent && !`${content.label} ${content.collection} ${content.path || ""}`.toLocaleLowerCase("fr").includes(query)) continue;
      const groupName = content.kind === "file" || content.kind === "media" ? "Tout le site" : content.collection;
      let group = groups.get(groupName);
      if (!group) {
        group = document.createElement("optgroup");
        group.label = groupName;
        groups.set(groupName, group);
        contentSelect.append(group);
      }
      group.append(new Option(content.label, content.id, false, content.id === selectedContent));
    }
    element("content-impact").textContent = manifest.contents.find((content) => content.id === selectedContent)!.impact;
  }
  function renderRoutes(): void {
    const content = manifest.contents.find((item) => item.id === selectedContent)!;
    routeSelect.replaceChildren();
    const affected = document.createElement("optgroup");
    affected.label = "Pages liées au contenu";
    const all = document.createElement("optgroup");
    all.label = "Naviguer dans tout le site";
    for (const route of manifest.routes) {
      const option = new Option(`${route.label} · /${route.path}`, route.path, false, route.path === selectedRoute);
      (content.routes.includes(route.path) ? affected : all).append(option);
    }
    if (affected.children.length) routeSelect.append(affected);
    routeSelect.append(all);
    element("content-impact").textContent = content.impact;
    element("source-path").textContent = content.path || `Collection ${content.collection}`;
  }
  function observeFrame(frame: HTMLIFrameElement, statusId: string): void {
    frame.addEventListener("load", () => {
      if (frame === previewFrame) clearTimeout(previewTimer);
      else clearTimeout(productionTimer);
      // Cross-origin frames expose no document; a load event is not a status check.
      const doc = frame.contentDocument;
      if (!doc) {
        element(statusId).textContent = "Cadre chargé, contenu distant non vérifiable depuis cet atelier. Vérifiez visuellement ou ouvrez-le dans un onglet séparé.";
        return;
      }
      const url = new URL(doc.URL);
      if (url.pathname.replace(previewBase, "/").split("/").includes("admin")) {
        selectedRoute = "";
        renderRoutes();
        loadPreview();
        element(statusId).textContent = "La route d’administration est exclue pour éviter une prévisualisation récursive.";
        return;
      }
      element(statusId).textContent = `Affichage du build ${visibleCommit.slice(0, 7)} · ${url.pathname} · aucun brouillon non enregistré.`;
    });
    frame.addEventListener("error", () => {
      if (frame === previewFrame) clearTimeout(previewTimer);
      else clearTimeout(productionTimer);
      element(statusId).textContent = "Le navigateur a signalé une erreur. Réessayez ou ouvrez cette page dans un nouvel onglet.";
    });
  }
  function loadPreview(): void {
    clearTimeout(previewTimer);
    const url = previewUrl(previewOrigin, previewBase, selectedRoute);
    previewFrame.src = url;
    element<HTMLAnchorElement>("preview-own-tab").href = url;
    element("preview-status").textContent = `Chargement de /${selectedRoute} · build ${visibleCommit.slice(0, 7)}.`;
    previewTimer = setTimeout(() => {
      element("preview-status").textContent = "Le chargement prend trop de temps. Actualisez ou ouvrez l’aperçu dans un nouvel onglet.";
    }, 12000);
    if (comparing) loadProduction();
  }
  function loadProduction(): void {
    clearTimeout(productionTimer);
    const url = previewUrl(PRODUCTION_ORIGIN, "/", selectedRoute);
    productionFrame.src = url;
    element<HTMLAnchorElement>("production-own-tab").href = url;
    element("production-status").textContent = `Production · /${selectedRoute} · une nouvelle page de branche peut ne pas exister ici.`;
    productionTimer = setTimeout(() => {
      element("production-status").textContent = "Production lente ou non accessible. Le navigateur ne permet pas de lire le statut du cadre distant ; utilisez son onglet séparé.";
    }, 12000);
  }
  observeFrame(previewFrame, "preview-status");
  observeFrame(productionFrame, "production-status");

  renderContents();
  renderRoutes();
  loadCms();
  loadPreview();
  element<HTMLInputElement>("content-search").addEventListener("input", (event) => {
    renderContents((event.currentTarget as HTMLInputElement).value);
  });
  contentSelect.addEventListener("change", () => {
    selectedContent = contentSelect.value;
    const content = manifest.contents.find((item) => item.id === selectedContent)!;
    selectedRoute = content.routes[0] ?? "";
    renderRoutes();
    loadCms();
    loadPreview();
  });
  routeSelect.addEventListener("change", () => {
    selectedRoute = routeSelect.value;
    loadPreview();
  });
  element("preview-reload").addEventListener("click", loadPreview);
  document.querySelectorAll<HTMLButtonElement>("[data-viewport]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll<HTMLElement>(".preview-stage").forEach((stage) => {
        stage.dataset.viewport = button.dataset.viewport;
      });
      document.querySelectorAll<HTMLButtonElement>("[data-viewport]").forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-focus]").forEach((button) => {
    button.addEventListener("click", () => {
      workspace.dataset.focus = button.dataset.focus;
      document.querySelectorAll<HTMLButtonElement>("[data-focus]").forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
    });
  });
  element("compare").addEventListener("click", () => {
    comparing = !comparing;
    element("production-panel").hidden = !comparing;
    workspace.classList.toggle("comparing", comparing);
    element("compare").setAttribute("aria-pressed", String(comparing));
    if (comparing) loadProduction();
    else {
      clearTimeout(productionTimer);
      productionFrame.removeAttribute("src");
    }
  });
  element("fullscreen").addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.body.requestFullscreen();
    } catch (error) {
      console.error("Impossible d’activer le plein écran.", error);
      element("build-status").textContent = "Le plein écran n’est pas autorisé par ce navigateur. Utilisez « Éditeur seul » ou « Aperçu seul ».";
    }
  });
  document.addEventListener("fullscreenchange", () => {
    element("fullscreen").textContent = document.fullscreenElement ? "Quitter le plein écran" : "Plein écran";
  });
  if (manifest.branch === "main") {
    element("publication-state").textContent = "Branche de production · ne pas modifier directement";
  }

  const latestButton = element<HTMLButtonElement>("latest-build");
  latestButton.addEventListener("click", async () => {
    latestButton.disabled = true;
    element("build-status").textContent = "Recherche du dernier commit et de son contrôle Cloudflare…";
    async function readJson(url: string): Promise<unknown> {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000), cache: "no-store" });
      if (!response.ok) throw new Error(`Requête refusée (HTTP ${response.status}). GitHub peut limiter les consultations publiques ; utilisez l’historique du dépôt.`);
      return response.json();
    }
    try {
      const api = `https://api.github.com/repos/${manifest.repository}`;
      const branchData = await readJson(`${api}/branches/${encodeURIComponent(manifest.branch)}`) as { commit?: { sha?: string } };
      const sha = branchData.commit?.sha;
      if (!sha || !/^[a-f0-9]{40}$/.test(sha)) throw new Error("Le dernier commit de cette branche est introuvable.");
      const checks = await readJson(`${api}/commits/${sha}/check-runs`) as {
        check_runs?: Array<{ name: string; status: string; conclusion: string; output?: { summary?: string } }>;
      };
      const check = checks.check_runs?.find((item) => item.name === "Cloudflare Pages" && item.status === "completed" && item.conclusion === "success");
      if (!check) throw new Error(`Le commit ${sha.slice(0, 7)} n’a pas encore de déploiement Cloudflare réussi. Attendez le build et consultez son contrôle dans GitHub.`);
      const origin = deploymentFromCheck(check.output?.summary || "");
      const candidate = await readJson(`${origin}/admin/manifest.json`) as AdminManifest;
      validateDeployment(candidate, manifest.branch, sha);
      previewOrigin = origin;
      previewBase = candidate.base;
      visibleCommit = sha;
      element("build-label").textContent = `Aperçu vérifié · ${sha.slice(0, 7)} · déploiement immuable · ${candidate.buildTime}`;
      const deploymentLink = element<HTMLAnchorElement>("deployment-link");
      deploymentLink.href = `${origin}/admin/`;
      deploymentLink.textContent = "Ouvrir l’atelier de ce build (nouvel onglet) ↗";
      element("build-status").textContent = "Dernier build réussi sélectionné. Les listes de cet atelier restent celles de son build initial : ouvrez l’atelier du nouveau build pour retrouver les contenus créés ou renommés.";
      loadPreview();
    } catch (error) {
      console.error("Recherche du déploiement impossible.", error);
      element("build-status").textContent = error instanceof Error ? error.message : "La recherche a échoué. Consultez les contrôles GitHub.";
    } finally {
      latestButton.disabled = false;
    }
  });
}
