import { errorMessage, type EditorPull, type EditorStatus, type FileChange, type PullChecks, type RepositoryAdapter, type RuntimeAdapter, type DeploymentStatus } from "./contracts.ts";
import { EditorApiError } from "./github.ts";
import { BrowserStorage, DraftConflictError, LocalWorkspace, applyChanges, readArchive } from "./workspace.ts";
import { runAgent, PreviewRestoreError } from "./agent.ts";
import type { Generator } from "./model.ts";
import { editorConfig } from "./config.ts";

export interface StorageAdapter {
  cached(sha: string): Promise<Map<string, Uint8Array> | null>;
  cache(sha: string, files: Map<string, Uint8Array>, signal: AbortSignal): Promise<void>;
  saveDraft(ref: string, workspace: LocalWorkspace): Promise<void>;
  restoreDraft(ref: string, workspace: LocalWorkspace): Promise<void>;
  exportDraft(ref: string): Promise<{ sha: string; changes: FileChange[] }>;
  discardDraft(ref: string): Promise<void>;
}

interface Hooks {
  change(): void;
  progress(message: string): void;
  error(message: string): void;
  notice(message: string): void;
}

interface Snapshot { sha: string; files: Map<string, Uint8Array> }

export class EditorController {
  status: EditorStatus | null = null;
  pulls: EditorPull[] = [];
  pull: EditorPull | null = null;
  workspace: LocalWorkspace | null = null;
  busy = false;
  runtimeReady = false;
  previewUrl = "";
  route = "/";
  checks: PullChecks | null = null;
  conflicted = false;
  remoteChanged = false;
  published = false;
  deployment: DeploymentStatus | null = null;
  private repository: RepositoryAdapter;
  private runtime: RuntimeAdapter;
  private hooks: Hooks;
  private storage: StorageAdapter | null = null;
  private storageFactory: (login: string) => StorageAdapter;
  private runtimeEnabled: boolean;
  private lifetime = new AbortController();
  private agentAbort: AbortController | null = null;
  private warm: Promise<Snapshot | null> | null = null;
  private main: Snapshot | null = null;
  private createRequest: { title: string; id: string } | null = null;
  private saveRequest: { key: string; id: string } | null = null;
  private checksTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(repository: RepositoryAdapter, runtime: RuntimeAdapter, hooks: Hooks, runtimeEnabled: boolean,
    storageFactory: (login: string) => StorageAdapter = (login) => new BrowserStorage(login)) {
    this.repository = repository; this.runtime = runtime; this.hooks = hooks;
    this.runtimeEnabled = runtimeEnabled; this.storageFactory = storageFactory;
  }
  private requireSession() {
    if (!this.status?.authenticated || !this.status.canWrite || !this.storage) throw new Error("Une connexion GitHub avec accès en écriture est nécessaire.");
    return this.storage;
  }
  private async operation(work: () => Promise<void>): Promise<void> {
    if (this.busy) throw new Error("Attendez la fin de l'opération en cours.");
    this.busy = true; this.hooks.change();
    try { await work(); }
    finally { this.busy = false; this.hooks.change(); }
  }
  async initialize(): Promise<void> {
    this.status = await this.repository.status();
    this.hooks.change();
    if (!this.status.authenticated || !this.status.canWrite || !this.status.user) return;
    this.storage = this.storageFactory(this.status.user.login);
    this.warm = this.warmMain().catch((error: unknown) => {
      if (!this.lifetime.signal.aborted) this.hooks.error(`Le préchargement a échoué : ${errorMessage(error)}`);
      return null;
    });
    await this.listPulls();
  }
  async listPulls() {
    this.requireSession();
    this.pulls = await this.repository.listPulls();
    this.hooks.change();
  }
  private async snapshot(sha: string, pull?: number): Promise<Snapshot> {
    const storage = this.requireSession();
    const cached = await storage.cached(sha);
    if (cached) return { sha, files: cached };
    const response = await this.repository.archive(sha, pull, this.lifetime.signal);
    const files = await readArchive(response, this.lifetime.signal, (message) => this.hooks.progress(message));
    this.hooks.progress("Conservation des fichiers dans le navigateur…");
    await storage.cache(sha, files, this.lifetime.signal);
    return { sha, files };
  }
  private async warmMain(): Promise<Snapshot> {
    const sha = this.status?.repository.defaultSha;
    if (!sha) throw new Error("La version de main n'a pas été fournie par GitHub.");
    const snapshot = await this.snapshot(sha);
    this.main = snapshot;
    if (this.runtimeEnabled) await this.runtime.prepare(snapshot.files, this.lifetime.signal);
    this.hooks.progress(this.runtimeEnabled ? "Dépôt et dépendances prêts dans le navigateur." : "Dépôt chargé. La prévisualisation attend son activation Cloudflare.");
    return snapshot;
  }
  async create(title: string): Promise<void> {
    await this.operation(async () => {
      this.requireSession();
      if (!this.createRequest || this.createRequest.title !== title) this.createRequest = { title, id: crypto.randomUUID() };
      const pull = await this.repository.createPull(title, this.createRequest.id);
      this.createRequest = null;
      await this.open(pull);
    });
  }
  async select(pull: EditorPull): Promise<void> { await this.operation(() => this.open(pull)); }
  private async open(selected: EditorPull): Promise<void> {
    const storage = this.requireSession();
    if (this.workspace && this.pull && !this.conflicted) await storage.saveDraft(this.pull.headRef, this.workspace);
    if (this.warm) await this.warm;
    const pull = await this.repository.getPull(selected.number);
    let snapshot: Snapshot | null = null;
    const cached = await storage.cached(pull.headSha);
    if (cached) snapshot = { sha: pull.headSha, files: cached };
    else if (this.main) {
      try {
        const changes = await this.repository.changes(this.main.sha, pull);
        const files = applyChanges(this.main.files, changes);
        await storage.cache(pull.headSha, files, this.lifetime.signal);
        snapshot = { sha: pull.headSha, files };
      } catch (error) {
        if (!(error instanceof EditorApiError) || (error.status !== 409 && error.status !== 413)) throw error;
        this.hooks.progress("Le changement nécessite un téléchargement complet au SHA de la PR.");
      }
    }
    snapshot ??= await this.snapshot(pull.headSha, pull.number);
    const workspace = new LocalWorkspace(pull.headSha, snapshot.files);
    this.conflicted = false;
    try { await storage.restoreDraft(pull.headRef, workspace); }
    catch (error) {
      if (!(error instanceof DraftConflictError)) throw error;
      this.conflicted = true; this.hooks.notice(error.message);
    }
    this.pull = pull; this.workspace = workspace; this.route = "/";
    this.runtimeReady = false; this.remoteChanged = false; this.published = false;
    this.checks = null; this.deployment = null; this.previewUrl = "";
    this.hooks.change();
    if (!this.runtimeEnabled) {
      throw new Error("La prévisualisation n'est pas activée. Après confirmation de la licence WebContainer, activez PUBLIC_EDITOR_RUNTIME_ENABLED=true dans Cloudflare.");
    }
    const url = await this.runtime.open(workspace.files, this.lifetime.signal);
    this.preview(url);
    if (!this.conflicted) await storage.saveDraft(pull.headRef, workspace);
    await this.refreshChecks();
    this.scheduleChecks();
  }
  preview(url: string) {
    if (!this.pull || !this.workspace) return;
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") throw new Error("L'origine de prévisualisation doit être HTTPS.");
    if (!this.previewUrl || !this.route.startsWith(parsed.pathname)) this.route = parsed.pathname;
    this.previewUrl = parsed.href;
    this.runtimeReady = true; this.hooks.change();
  }
  runtimeFailed(message: string) {
    this.runtimeReady = false;
    this.hooks.error(message); this.hooks.change();
  }
  async retryRuntime() {
    await this.operation(async () => {
      if (!this.workspace || !this.runtimeEnabled) throw new Error("La prévisualisation n'est pas activée.");
      const url = await this.runtime.open(this.workspace.files, this.lifetime.signal);
      this.preview(url);
      this.hooks.notice("L'aperçu a redémarré.");
    });
  }
  async leave() {
    await this.operation(async () => {
      if (this.pull && this.workspace && !this.conflicted) await this.requireSession().saveDraft(this.pull.headRef, this.workspace);
      this.pull = null; this.workspace = null; this.runtimeReady = false; this.checks = null;
      this.clearChecks();
      await this.listPulls();
    });
  }
  async abandon(pull: EditorPull) {
    await this.operation(async () => {
      this.requireSession();
      if (this.pull?.number === pull.number && this.workspace && !this.conflicted) await this.storage!.saveDraft(pull.headRef, this.workspace);
      await this.repository.close(pull);
      if (this.pull?.number === pull.number) {
        this.runtime.stop(); this.pull = null; this.workspace = null; this.runtimeReady = false; this.clearChecks();
      }
      this.hooks.notice("PR abandonnée. Sa branche et vos brouillons locaux sont conservés.");
      await this.listPulls();
    });
  }
  private requireWorkspace() {
    this.requireSession();
    if (!this.workspace || !this.pull || !this.runtimeReady || this.published || this.conflicted || this.remoteChanged) {
      throw new Error("Attendez un aperçu prêt et une version de PR sans conflit.");
    }
    return { workspace: this.workspace, pull: this.pull };
  }
  get agentRunning() { return this.agentAbort !== null; }
  async chat(prompt: string, generate: Generator): Promise<void> {
    await this.operation(async () => {
      const { workspace, pull } = this.requireWorkspace();
      workspace.messages.push({ role: "user", text: prompt });
      this.hooks.change();
      await this.requireSession().saveDraft(pull.headRef, workspace);
      const abort = new AbortController();
      this.agentAbort = abort;
      this.hooks.change();
      const signal = AbortSignal.any([abort.signal, this.lifetime.signal, AbortSignal.timeout(editorConfig.maxAgentMilliseconds)]);
      try {
        const result = await runAgent({ workspace, runtime: this.runtime, generate, prompt, title: pull.title, route: this.route,
          signal, recoverySignal: this.lifetime.signal, progress: (message) => this.hooks.progress(message) });
        workspace.messages.push({ role: "assistant", text: result });
        this.saveRequest = null;
      } catch (error) {
        if (error instanceof PreviewRestoreError) this.runtimeReady = false;
        workspace.messages.push({ role: "assistant", text: "La modification n'a pas pu être validée. Les fichiers de cette demande ont été restaurés ; rien n'a été envoyé sur GitHub. Le diagnostic contient la cause précise." });
        throw error;
      } finally {
        this.agentAbort = null;
        await this.requireSession().saveDraft(pull.headRef, workspace);
        this.hooks.change();
      }
    });
  }
  cancelChat() { this.agentAbort?.abort(new DOMException("Demande interrompue.", "AbortError")); }
  async undo() {
    await this.operation(async () => {
      const { workspace, pull } = this.requireWorkspace();
      const checkpoint = workspace.checkpoint();
      const inverse = workspace.history.at(-1);
      if (!inverse) throw new Error("Aucune modification à annuler.");
      workspace.files = applyChanges(workspace.files, inverse, true);
      try {
        for (const change of inverse) await this.runtime.write(change.path, workspace.files.get(change.path) ?? null);
        await this.runtime.validate(this.lifetime.signal);
      } catch (error) {
        const restore = workspace.restore(checkpoint);
        try {
          for (const change of restore) await this.runtime.write(change.path, workspace.files.get(change.path) ?? null);
          this.preview(await this.runtime.open(workspace.files, AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(180000)])));
        } catch (restoreError) {
          this.runtimeReady = false;
          throw new Error(`${errorMessage(error)} L'aperçu doit être redémarré : ${errorMessage(restoreError)}`);
        }
        throw error;
      }
      workspace.history.pop();
      workspace.messages.push({ role: "assistant", text: "Le dernier changement a été annulé dans l'aperçu. Sauvegardez pour envoyer ce résultat sur GitHub." });
      this.saveRequest = null;
      await this.requireSession().saveDraft(pull.headRef, workspace);
    });
  }
  async save() {
    await this.operation(async () => {
      const { workspace, pull } = this.requireWorkspace();
      const changes = workspace.changes();
      if (!changes.length) throw new Error("Aucun changement à sauvegarder.");
      await this.validateWorkspace();
      const key = JSON.stringify({ sha: pull.headSha, changes });
      if (!this.saveRequest || this.saveRequest.key !== key) this.saveRequest = { key, id: crypto.randomUUID() };
      const updated = await this.repository.save(pull, changes, this.saveRequest.id);
      this.pull = { ...updated, headSha: updated.savedSha };
      workspace.markSaved(updated.savedSha); this.saveRequest = null;
      this.remoteChanged = updated.headSha !== updated.savedSha;
      this.checks = null;
      this.hooks.notice("Les modifications sont sauvegardées sur la branche de la PR, pas encore publiées.");
      await this.requireSession().cache(updated.savedSha, workspace.files, this.lifetime.signal);
      await this.requireSession().saveDraft(updated.headRef, workspace);
      if (this.remoteChanged) {
        this.hooks.progress("Sauvegarde confirmée. Réconciliation avec les changements GitHub plus récents…");
        await this.open(updated);
      }
      await this.refreshChecks();
    });
  }
  async refreshChecks() {
    if (!this.pull || this.published) return;
    const pull = this.pull;
    const checks = await this.repository.checks(pull);
    if (this.pull !== pull) return;
    this.checks = checks;
    if (checks.sha !== pull.headSha) {
      if (!this.remoteChanged) this.hooks.notice("Cette PR a changé sur GitHub. Votre brouillon est conservé ; choisissez à nouveau la PR pour la réconcilier.");
      this.remoteChanged = true;
    }
    this.hooks.change();
  }
  private async validateWorkspace() {
    try { await this.runtime.validate(this.lifetime.signal); }
    catch (error) { this.runtimeReady = false; throw error; }
  }
  get canPublish() {
    return !this.busy && !this.workspace?.dirty && !this.conflicted && !this.remoteChanged && !this.published
      && this.runtimeReady && this.checks?.sha === this.pull?.headSha && this.checks?.state === "success" && this.checks.mergeable === true;
  }
  async publish() {
    if (!this.canPublish) throw new Error("Sauvegardez et attendez les contrôles réussis sur cette version avant de publier.");
    await this.operation(async () => {
      const { workspace, pull } = this.requireWorkspace();
      if (workspace.dirty) throw new Error("Des modifications locales restent à sauvegarder.");
      await this.validateWorkspace();
      await this.refreshChecks();
      if (this.checks?.sha !== pull.headSha || this.checks.state !== "success" || this.checks.mergeable !== true) {
        throw new Error("La PR n'est plus prête à être fusionnée.");
      }
      const result = await this.repository.merge(pull);
      if (!result.merged) throw new Error(result.message);
      this.published = true; this.clearChecks();
      this.deployment = { state: "pending", message: "PR fusionnée. Recherche d'un déploiement de production confirmé…" };
      this.hooks.notice("PR fusionnée dans main. Le déploiement est suivi séparément.");
      try { this.deployment = await this.repository.deployment(result.sha); }
      finally { this.followDeployment(result.sha, 0); }
    });
  }
  private followDeployment(sha: string, attempts: number) {
    const pull = this.pull;
    if (!pull || !this.published || this.deployment?.state !== "pending" || this.lifetime.signal.aborted) return;
    if (attempts >= 30) {
      this.deployment = { state: "pending", message: "La PR est fusionnée, mais aucun déploiement réussi n'a été confirmé en dix minutes. Consultez GitHub et Cloudflare." };
      this.hooks.change();
      return;
    }
    this.checksTimer = setTimeout(() => {
      void this.repository.deployment(sha).then((deployment) => {
        if (this.pull !== pull || !this.published || this.lifetime.signal.aborted) return;
        this.deployment = deployment; this.hooks.change();
        if (deployment.state === "pending") this.followDeployment(sha, attempts + 1);
      }).catch((error: unknown) => {
        if (this.pull !== pull || !this.published || this.lifetime.signal.aborted) return;
        this.hooks.error(`Le suivi du déploiement a échoué : ${errorMessage(error)}`);
        this.followDeployment(sha, attempts + 1);
      });
    }, 20000);
  }
  private scheduleChecks() {
    this.clearChecks();
    this.checksTimer = setTimeout(() => {
      if (!this.pull || this.published || this.lifetime.signal.aborted) return;
      if (!this.busy) void this.refreshChecks().catch((error: unknown) => this.hooks.error(errorMessage(error)));
      this.scheduleChecks();
    }, 20000);
  }
  private clearChecks() { if (this.checksTimer) clearTimeout(this.checksTimer); this.checksTimer = null; }
  async exportDraft() {
    if (!this.pull) throw new Error("Aucune modification sélectionnée.");
    if (!this.conflicted && this.workspace) await this.requireSession().saveDraft(this.pull.headRef, this.workspace);
    return this.requireSession().exportDraft(this.pull.headRef);
  }
  async discardConflict() {
    await this.operation(async () => {
      if (!this.pull || !this.workspace || !this.conflicted) throw new Error("Aucun conflit local à effacer.");
      await this.requireSession().discardDraft(this.pull.headRef);
      this.conflicted = false;
      await this.requireSession().saveDraft(this.pull.headRef, this.workspace);
    });
  }
  async logout() {
    await this.operation(async () => {
      if (this.pull && this.workspace && !this.conflicted) await this.requireSession().saveDraft(this.pull.headRef, this.workspace);
      await this.repository.logout();
      this.dispose();
      this.status = null; this.pull = null; this.workspace = null;
    });
  }
  dispose() {
    this.lifetime.abort(new DOMException("Atelier fermé.", "AbortError"));
    this.cancelChat(); this.clearChecks(); this.runtime.stop();
  }
}
