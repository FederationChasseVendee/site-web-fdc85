import { isRecord, type EditorStatus, type EditorPull, type FileChange, type PullChecks, type MergeResult, type DeploymentStatus, type RepositoryAdapter } from "./contracts.ts";
import { baseBranch, isSha, repositoryName, validPath } from "./policy.ts";

export class EditorApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

function parsePull(value: unknown): EditorPull {
  if (!isRecord(value) || !Number.isSafeInteger(value.number) || typeof value.number !== "number"
    || value.number <= 0 || typeof value.title !== "string" || typeof value.headRef !== "string"
    || !value.headRef.startsWith("editor/") || !isSha(value.headSha)
    || typeof value.author !== "string" || typeof value.updatedAt !== "string" || typeof value.draft !== "boolean") {
    throw new Error("Réponse de pull request invalide.");
  }
  return {
    number: value.number, title: value.title, headRef: value.headRef, headSha: value.headSha,
    author: value.author, updatedAt: value.updatedAt, draft: value.draft,
    url: `https://github.com/${repositoryName}/pull/${value.number}`,
  };
}

function parseStatus(value: unknown): EditorStatus {
  if (!isRecord(value) || typeof value.configured !== "boolean" || typeof value.authenticated !== "boolean"
    || !isRecord(value.repository) || value.repository.fullName !== repositoryName || value.repository.defaultBranch !== baseBranch) {
    throw new Error("Réponse de connexion GitHub invalide.");
  }
  const repository: EditorStatus["repository"] = { fullName: repositoryName, defaultBranch: baseBranch };
  if (isSha(value.repository.defaultSha)) repository.defaultSha = value.repository.defaultSha;
  const result: EditorStatus = { configured: value.configured, authenticated: value.authenticated, repository };
  if (typeof value.message === "string") result.message = value.message;
  if (value.authenticated) {
    if (!isRecord(value.user) || typeof value.user.login !== "string"
      || typeof value.user.avatarUrl !== "string" || typeof value.canWrite !== "boolean"
      || typeof value.csrfToken !== "string") throw new Error("Session GitHub incomplète.");
    result.user = { login: value.user.login, avatarUrl: value.user.avatarUrl };
    result.canWrite = value.canWrite;
    result.csrfToken = value.csrfToken;
  }
  return result;
}

function parseChanges(value: unknown): FileChange[] {
  if (!Array.isArray(value)) throw new Error("Réponse de fichiers invalide.");
  return value.map((item: unknown) => {
    if (!isRecord(item) || typeof item.path !== "string" || !validPath(item.path)
      || (item.content !== null && typeof item.content !== "string")
      || (item.encoding !== "utf8" && item.encoding !== "base64")) throw new Error("Changement de fichier invalide.");
    return { path: item.path, content: item.content, encoding: item.encoding };
  });
}

export class GitHubRepository implements RepositoryAdapter {
  private csrfToken = "";
  private readonly apiBase: string;
  constructor(apiBase = "/api/editor") { this.apiBase = apiBase; }

  private async response(path: string, options: RequestInit = {}): Promise<Response> {
    const headers = new Headers(options.headers);
    if (options.method && options.method !== "GET") {
      if (!this.csrfToken) throw new Error("Reconnectez-vous avant de modifier le dépôt.");
      headers.set("X-CSRF-Token", this.csrfToken);
      headers.set("Content-Type", "application/json");
    }
    const response = await fetch(`${this.apiBase}/${path}`, {
      ...options, headers, credentials: "same-origin", cache: "no-store",
    });
    if (!response.ok) {
      let message = `GitHub est indisponible (HTTP ${response.status}).`;
      if (response.headers.get("Content-Type")?.includes("application/json")) {
        const data: unknown = await response.json();
        if (isRecord(data) && typeof data.message === "string") message = data.message;
      }
      throw new EditorApiError(message, response.status);
    }
    return response;
  }

  private async json(path: string, body?: unknown): Promise<unknown> {
    const response = await this.response(path, body === undefined ? {} : { method: "POST", body: JSON.stringify(body) });
    if (!response.headers.get("Content-Type")?.includes("application/json")) {
      throw new Error("La passerelle GitHub n'est pas installée sur cet environnement.");
    }
    return response.json();
  }

  async status() {
    const status = parseStatus(await this.json("status"));
    this.csrfToken = status.csrfToken ?? "";
    return status;
  }
  async listPulls() {
    const value = await this.json("pulls");
    if (!Array.isArray(value)) throw new Error("Liste des modifications invalide.");
    return value.map(parsePull);
  }
  async getPull(number: number) { return parsePull(await this.json(`pulls/${number}`)); }
  async createPull(title: string, requestId: string) { return parsePull(await this.json("pulls", { title, requestId })); }
  async archive(sha: string, pull?: number, signal?: AbortSignal) {
    const params = new URLSearchParams({ sha });
    if (pull !== undefined) params.set("pull", String(pull));
    const response = await this.response(`archive?${params}`, { signal });
    if (!response.headers.get("Content-Type")?.includes("application/zip")) throw new Error("L'archive reçue n'est pas un ZIP.");
    return response;
  }
  async changes(fromSha: string, pull: EditorPull) {
    return parseChanges(await this.json(`pulls/${pull.number}/changes?${new URLSearchParams({ from: fromSha, expectedSha: pull.headSha })}`));
  }
  async save(pull: EditorPull, changes: FileChange[], requestId: string) {
    return parsePull(await this.json(`pulls/${pull.number}/save`, { expectedSha: pull.headSha, changes, requestId }));
  }
  async close(pull: EditorPull) { await this.json(`pulls/${pull.number}/close`, { expectedSha: pull.headSha }); }
  async checks(pull: EditorPull): Promise<PullChecks> {
    const value = await this.json(`pulls/${pull.number}/checks`);
    if (!isRecord(value) || !isSha(value.sha) || (value.state !== "pending" && value.state !== "success" && value.state !== "failure")
      || typeof value.message !== "string" || (value.mergeable !== null && typeof value.mergeable !== "boolean")) {
      throw new Error("État des contrôles GitHub invalide.");
    }
    return { sha: value.sha, state: value.state, message: value.message, mergeable: value.mergeable };
  }
  async merge(pull: EditorPull): Promise<MergeResult> {
    const value = await this.json(`pulls/${pull.number}/merge`, { expectedSha: pull.headSha });
    if (!isRecord(value) || !isSha(value.sha) || typeof value.merged !== "boolean" || typeof value.message !== "string") {
      throw new Error("Résultat de fusion GitHub invalide.");
    }
    return { sha: value.sha, merged: value.merged, message: value.message };
  }
  async deployment(sha: string): Promise<DeploymentStatus> {
    const value = await this.json(`deployment?${new URLSearchParams({ sha })}`);
    if (!isRecord(value) || (value.state !== "pending" && value.state !== "success" && value.state !== "failure") || typeof value.message !== "string") {
      throw new Error("État du déploiement invalide.");
    }
    const result: DeploymentStatus = { state: value.state, message: value.message };
    if (typeof value.url === "string" && value.url.startsWith("https://")) result.url = value.url;
    return result;
  }
  async logout() { await this.json("logout", {}); this.csrfToken = ""; }
}
