import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { z } from "zod";
import Fields from "./Fields";
import {
  catalogSchema, cmsUrl, errorMessage, exportSource, isDirty, parseRenderEntry, parseSource, persistence, validateFields,
  type Catalog, type Draft, type RenderContext, type SourceEntry,
} from "../../lib/editor/model";
import { previewMarkup, previewTarget, updatePreview } from "../../lib/editor/preview";

interface StoredDraft { source: string; draft: Draft; updatedAt: string }
const storedSchema = z.object({ source: z.string(), draft: z.record(z.string(), z.unknown()), updatedAt: z.iso.datetime() });
const storageKey = (catalog: Catalog, entry: SourceEntry) => `fdc85:editor:v1:${catalog.branch}:${entry.path}`;

function download(content: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Workspace({ catalog, frame }: { catalog: Catalog; frame: string }) {
  const initialPath = new URLSearchParams(window.location.search).get("fichier");
  const [path, setPath] = useState(catalog.entries.find((entry) => entry.path === initialPath)?.path ?? catalog.entries[0].path);
  const [search, setSearch] = useState("");
  const entry = catalog.entries.find((item) => item.path === path)!;
  const collection = catalog.collections.find((item) => item.name === entry.collection)!;
  const original = useMemo(() => parseSource(entry.source, collection.format), [entry, collection]);
  const [draft, setDraft] = useState<Draft>(original);
  const [stored, setStored] = useState<StoredDraft>();
  const [storageReady, setStorageReady] = useState(false);
  const [storageStatus, setStorageStatus] = useState("Brouillon en mémoire.");
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [width, setWidth] = useState("100%");
  const [previewSlug, setPreviewSlug] = useState("");
  const [frameReady, setFrameReady] = useState(false);
  const iframe = useRef<HTMLIFrameElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const dirty = isDirty(original, draft);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const currentDraftRef = useRef({ catalog, entry, draft, storageReady, stored });
  currentDraftRef.current = { catalog, entry, draft, storageReady, stored };
  const baselineContext = useMemo<RenderContext>(() => ({
    base: catalog.base, siteUrl: catalog.siteUrl, now: catalog.builtAt,
    entries: catalog.entries.flatMap((item) => {
      const schema = catalog.collections.find((candidate) => candidate.name === item.collection);
      if (!schema) throw new Error(`Schéma manquant : ${item.collection}`);
      const parsed = parseRenderEntry(item, parseSource(item.source, schema.format));
      return parsed ? [parsed] : [];
    }),
  }), [catalog]);
  const result = useMemo(() => {
    try {
      const errors = validateFields(collection.fields, draft);
      if (errors.length) return { error: errors.join("\n") };
      const parsed = parseRenderEntry(entry, draft);
      if (!parsed) return { unsupported: "Paramètres du site : export JSON disponible, aperçu de l’en-tête/pied de page et analytics non pris en charge. Aucun suivi n’est exécuté ici." };
      const context: RenderContext = {
        ...baselineContext,
        entries: baselineContext.entries.map((item) =>
          item.collection === parsed.collection && item.slug === parsed.slug ? parsed : item),
      };
      const target = previewTarget(parsed, context, previewSlug || undefined);
      if (!target) return { unsupported: "Aucun index n’affiche cette collection. Export disponible, pas d’aperçu individuel." };
      return { target, parsed, context };
    } catch (error) { return { error: errorMessage(error) }; }
  }, [collection, draft, entry, baselineContext, previewSlug]);
  const indexes = baselineContext.entries.filter((item) => item.collection === "indexes" && item.data.source === entry.collection);

  useEffect(() => {
    function guard(event: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      const current = currentDraftRef.current;
      if (current.storageReady && !current.stored) {
        try {
          localStorage.setItem(storageKey(current.catalog, current.entry), JSON.stringify({
            source: current.entry.source, draft: current.draft, updatedAt: new Date().toISOString(),
          }));
        } catch (error) {
          setActionError(`Dernier brouillon non conservé : ${errorMessage(error)}. Exportez avant de quitter.`);
        }
      }
      event.preventDefault();
    }
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, []);

  useEffect(() => {
    setStorageReady(false);
    setDraft(original);
    setStored(undefined);
    setPreviewSlug("");
    setNotice("");
    setActionError("");
    try {
      const raw = localStorage.getItem(storageKey(catalog, entry));
      if (raw) {
        setStored(storedSchema.parse(JSON.parse(raw)));
        setStorageStatus("Un brouillon local attend votre décision.");
      } else {
        setStorageReady(true);
        setStorageStatus("Version du déploiement chargée, aucune modification.");
      }
    } catch (error) {
      setActionError(`Impossible de lire le brouillon local : ${errorMessage(error)}. Vous pouvez toujours exporter.`);
    }
  }, [original, catalog, entry]);

  useEffect(() => {
    if (!storageReady || stored) return;
    const timer = setTimeout(() => {
      try {
        if (dirty) {
          localStorage.setItem(storageKey(catalog, entry), JSON.stringify({
            source: entry.source, draft, updatedAt: new Date().toISOString(),
          }));
          setStorageStatus("Brouillon conservé sur cet appareil seulement — non enregistré dans GitHub.");
        } else {
          localStorage.removeItem(storageKey(catalog, entry));
          setStorageStatus("Version du déploiement, aucune modification.");
        }
      } catch (error) {
        setStorageStatus("Brouillon en mémoire uniquement.");
        setActionError(`Stockage local indisponible : ${errorMessage(error)}. Exportez avant de quitter.`);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [draft, dirty, storageReady, stored, catalog, entry]);

  useEffect(() => {
    if (!frameReady || !iframe.current?.contentDocument) return;
    const timer = setTimeout(() => {
      try {
        const document = iframe.current?.contentDocument;
        if (!document) throw new Error("Le cadre de prévisualisation est inaccessible.");
        if (result.target && result.context) updatePreview(document, previewMarkup(result.target, result.context));
        else updatePreview(document, "<div class=\"container content-layout\"><h1>Aperçu indisponible</h1><p>Corrigez les champs ou consultez la limitation indiquée dans l’éditeur.</p></div>");
      } catch (error) { setActionError(`Erreur d’aperçu : ${errorMessage(error)}`); }
    }, 200);
    return () => clearTimeout(timer);
  }, [result, frameReady]);

  function changeEntry(next: string) {
    if (next === path) return true;
    if (dirty && !window.confirm("Ce contenu comporte des modifications non enregistrées dans GitHub. Quitter ce contenu ? Exportez-le si vous souhaitez le transmettre.")) return false;
    if (dirty && storageReady && !stored) {
      try {
        localStorage.setItem(storageKey(catalog, entry), JSON.stringify({ source: entry.source, draft, updatedAt: new Date().toISOString() }));
      } catch (error) {
        setActionError(`Impossible de conserver le brouillon avant de changer de contenu : ${errorMessage(error)}. Exportez-le avant de quitter.`);
        return false;
      }
    }
    setPath(next);
    const url = new URL(window.location.href);
    url.searchParams.set("fichier", next);
    window.history.replaceState(null, "", url);
    return true;
  }

  function reset() {
    if ((dirty || stored) && !window.confirm("Abandonner le brouillon et revenir à la version de ce déploiement ? Cette suppression locale est définitive.")) return;
    setStored(undefined);
    setDraft(structuredClone(original));
    setNotice("Brouillon abandonné. Version du déploiement restaurée.");
    try {
      localStorage.removeItem(storageKey(catalog, entry));
      setStorageReady(true);
      setActionError("");
    } catch (error) {
      setStorageReady(false);
      setStorageStatus("Version du déploiement restaurée en mémoire.");
      setActionError(`Contenu rétabli, mais impossible de supprimer le stockage local : ${errorMessage(error)}. Un ancien brouillon peut encore être proposé à la prochaine ouverture.`);
    }
  }

  function exportDraft(value = draft) {
    try {
      const fields = validateFields(collection.fields, value);
      if (fields.length) throw new Error(fields.join("\n"));
      parseRenderEntry(entry, value);
      const source = exportSource(value, collection.format);
      const roundTrip = parseSource(source, collection.format);
      parseRenderEntry(entry, roundTrip);
      download(source, entry.path.split("/").at(-1) ?? "brouillon.txt");
      setNotice(`Export téléchargé pour ${entry.path}. Rien n’a été envoyé à Pages CMS ou GitHub. Les modifications restent non publiées.`);
    } catch (error) { setActionError(`Export impossible : ${errorMessage(error)}`); }
  }

  async function importDraft(file: File) {
    try {
      if (file.size > 2_000_000) throw new Error("Fichier trop volumineux (maximum 2 Mo).");
      const value = parseSource(await file.text(), collection.format);
      const fields = validateFields(collection.fields, value);
      if (fields.length) throw new Error(fields.join("\n"));
      parseRenderEntry(entry, value);
      if (dirty && !window.confirm("Remplacer le brouillon actuel par le fichier importé ?")) return;
      setDraft(value);
      setNotice("Fichier importé comme brouillon local, sans publication.");
      setActionError("");
    } catch (error) { setActionError(`Import impossible : ${errorMessage(error)}`); }
  }

  const matches = catalog.entries.filter((item) => `${item.label} ${item.path}`.toLocaleLowerCase("fr").includes(search.toLocaleLowerCase("fr")));
  return <div class="editor-workspace">
    <section class="editor-panel" aria-label="Contenu à modifier">
      <div class="editor-picker"><label for="content-search">Rechercher un contenu</label>
        <input id="content-search" type="search" value={search} onInput={(event) => setSearch(event.currentTarget.value)} />
        <label for="content-select">Contenu ({matches.length} résultats)</label>
        <select id="content-select" value={path} onChange={(event) => { if (!changeEntry(event.currentTarget.value)) event.currentTarget.value = path; }}>
          {!matches.some((item) => item.path === path) && <option value={path}>{entry.label}</option>}
          {catalog.collections.map((group) => <optgroup key={group.name} label={group.label}>
            {matches.filter((item) => item.collection === group.name).map((item) =>
              <option key={item.path} value={item.path}>{item.label}</option>)}
          </optgroup>)}
        </select>
        <p class="source-path">{entry.path}</p>
      </div>
      <div class="editor-state" role="status" aria-live="polite">
        <strong>{dirty ? "Modifications non enregistrées dans GitHub" : "Version de ce déploiement"}</strong>
        <p>{storageStatus}</p>
      </div>
      {stored && <aside class="draft-recovery" aria-label="Brouillon retrouvé">
        <strong>Brouillon local du {new Date(stored.updatedAt).toLocaleString("fr-FR")}</strong>
        <p>{stored.source === entry.source ? "Reprendre votre travail sur ce contenu ?" : "Le contenu du dépôt a changé depuis ce brouillon. Reprendre peut écraser des changements plus récents lors d’un export ; aucune fusion automatique."}</p>
        <button type="button" onClick={() => { setDraft(stored.draft); setStored(undefined); setStorageReady(true); }}>Reprendre le brouillon</button>
        <button type="button" onClick={() => exportDraft(stored.draft)}>Exporter le brouillon retrouvé</button>
        <button type="button" onClick={reset}>Supprimer le brouillon</button>
      </aside>}
      <div class="editor-actions">
        <button type="button" class="primary" disabled={Boolean(result.error) || Boolean(stored)} onClick={() => exportDraft()}>Exporter {collection.format === "json" ? "le JSON" : "le Markdown"}</button>
        <button type="button" onClick={() => importInput.current?.click()} disabled={Boolean(stored)}>Importer un brouillon</button>
        <input ref={importInput} type="file" hidden accept={collection.format === "json" ? ".json" : ".md"}
          onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void importDraft(file); event.currentTarget.value = ""; }} />
        <button type="button" disabled={!dirty && !stored} onClick={reset}>Abandonner les modifications</button>
        <button type="button" disabled title="Aucun backend authentifié de publication n’est installé.">Publication indisponible ici</button>
      </div>
      {notice && <p class="editor-notice" role="status">{notice}</p>}
      {actionError && <div class="editor-error" role="alert"><p>{actionError}</p><button type="button" onClick={() => setActionError("")}>Fermer ce message</button></div>}
      {result.error && <div class="editor-error" role="alert"><strong>Corrigez ces champs pour prévisualiser ou exporter :</strong><pre>{result.error}</pre></div>}
      {result.unsupported && <p class="editor-notice" role="status">{result.unsupported}</p>}
      <form onSubmit={(event) => event.preventDefault()} inert={stored ? true : undefined}>
        <p class="field-help">* Champ obligatoire. Les champs absents de ce schéma sont préservés dans l’export.</p>
        <Fields fields={collection.fields} value={draft} onChange={(next) => { setDraft(next); setNotice(""); }} base={catalog.base} />
      </form>
      <datalist id="editor-images">{catalog.images.map((image) => <option value={image} key={image} />)}</datalist>
      <aside class="publication-help">
        <h2>Pour publier réellement</h2><p>{persistence.message}</p>
        <p>Transférez les champs dans Pages CMS, ou faites appliquer le fichier exporté au chemin ci-dessus par un mainteneur. Pages CMS créera le commit après authentification ; attendez ensuite le déploiement Cloudflare.</p>
        <a href={cmsUrl(entry, catalog.branch)} target="_blank" rel="noreferrer">Ouvrir ce contenu dans Pages CMS (nouvel onglet, sans transfert du brouillon)</a>
      </aside>
    </section>
    <section class="editor-preview-panel" aria-label="Aperçu responsive du brouillon">
      <div class="preview-tools">
        <h2>Aperçu {dirty ? "du brouillon non publié" : "de la version déployée"}</h2>
        <div role="group" aria-label="Largeur de l’aperçu">
          {[["100%", "Adaptatif"], ["1280px", "Bureau 1280 px"], ["768px", "Tablette 768 px"], ["390px", "Mobile 390 px"]].map(([value, label]) =>
            <button type="button" key={value} aria-pressed={width === value} onClick={() => setWidth(value)}>{label}</button>)}
        </div>
        {indexes.length > 0 && <label>Voir la ressource dans cet index <select value={previewSlug} onChange={(event) => setPreviewSlug(event.currentTarget.value)}>
          <option value="">Premier index associé</option>{indexes.map((item) => <option key={item.slug} value={item.slug}>{item.collection === "indexes" ? item.data.title : item.slug}</option>)}
        </select></label>}
        <p>Rendu et styles du site, liens et scripts neutralisés. Météo inactive. Un index conserve ses filtres : une ressource peut ne pas y figurer.</p>
        {result.target && !["documents", "faqs", "glossary", "directories", "redirects", "site"].includes(entry.collection) &&
          <a href={`${catalog.base}${result.target.slug ? `${result.target.slug}/` : ""}`} target="_blank" rel="noreferrer">Comparer avec la page de ce déploiement (nouvel onglet, sans le brouillon)</a>}
      </div>
      <div class="preview-scroll">
        <iframe ref={iframe} title={`Aperçu : ${entry.label}`} sandbox="allow-same-origin" srcDoc={frame}
          style={{ width }} onLoad={() => setFrameReady(true)} />
      </div>
    </section>
  </div>;
}

export default function Editor({ base }: { base: string }) {
  const [data, setData] = useState<{ catalog: Catalog; frame: string }>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const [catalogResponse, frameResponse] = await Promise.all([
          fetch(`${base}editeur/catalogue.json`, { signal: controller.signal }),
          fetch(`${base}editeur/cadre/`, { signal: controller.signal }),
        ]);
        if (!catalogResponse.ok || !frameResponse.ok) throw new Error(`Chargement impossible (${catalogResponse.status}, ${frameResponse.status}).`);
        const catalog = catalogSchema.parse(await catalogResponse.json());
        for (const entry of catalog.entries) {
          const collection = catalog.collections.find((candidate) => candidate.name === entry.collection);
          if (!collection) throw new Error(`Schéma manquant : ${entry.collection}`);
          parseRenderEntry(entry, parseSource(entry.source, collection.format));
        }
        const frameDocument = new DOMParser().parseFromString(await frameResponse.text(), "text/html");
        frameDocument.querySelectorAll("script").forEach((script) => script.remove());
        frameDocument.querySelectorAll("a").forEach((link) => link.removeAttribute("href"));
        setData({ catalog, frame: `<!doctype html>${frameDocument.documentElement.outerHTML}` });
        setError("");
      } catch (failure) {
        if (!controller.signal.aborted) setError(errorMessage(failure));
      }
    }
    void load();
    return () => controller.abort();
  }, [base, attempt]);
  if (error) return <div role="alert" class="editor-error"><p>{error}</p><button type="button" onClick={() => setAttempt(attempt + 1)}>Réessayer</button></div>;
  if (!data) return <p role="status">Chargement du schéma et des contenus de ce déploiement…</p>;
  return <><p class="deployment-meta">Branche <strong>{data.catalog.branch}</strong> · commit <code>{data.catalog.commit.slice(0, 8)}</code> · contenu chargé au build du {new Date(data.catalog.builtAt).toLocaleString("fr-FR")}. Ce catalogue n’est pas une lecture en direct de GitHub.</p>
    <Workspace catalog={data.catalog} frame={data.frame} /></>;
}
