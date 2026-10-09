import { isRecord } from "./contracts.ts";
import type { DeploymentStatus, EditorPull, EditorStatus, FileChange, MergeResult, PullChecks } from "./contracts.ts";
import { baseBranch, editablePath, encodeFile, isSha, maxFileBytes, maxWorkspaceBytes, pullPrefix, repositoryName, requestTitle, validPath } from "./policy.ts";

export interface EditorKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options: { expirationTtl: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface EditorEnv {
  EDITOR_GITHUB_CLIENT_ID?: string;
  EDITOR_GITHUB_CLIENT_SECRET?: string;
  EDITOR_ORIGIN?: string;
  EDITOR_SESSIONS?: EditorKV;
  EDITOR_SESSION_KEY?: string;
  EDITOR_BASE_PATH?: string;
  EDITOR_REQUIRED_CHECKS?: string;
  EDITOR_MERGE_METHOD?: string;
}

interface Dependencies {
  fetch?: typeof fetch;
  now?: () => number;
  log?: (message: string) => void;
}

interface Configuration {
  clientId: string;
  clientSecret: string;
  origin: string;
  basePath: string;
  kv: EditorKV;
  key: CryptoKey;
  requiredChecks: string[];
  mergeMethod?: "merge" | "squash" | "rebase";
}

interface Session {
  kind: "session";
  login: string;
  avatarUrl: string;
  csrfToken: string;
  accessToken: string;
  accessExpiresAt: number;
  refreshToken?: string;
  refreshExpiresAt?: number;
  expiresAt: number;
}

interface OAuthState {
  kind: "oauth";
  state: string;
  verifier: string;
  expiresAt: number;
}

interface CreateOperation {
  kind: "create";
  name: string;
  author: string;
  branch: string;
  baseSha: string;
  time: string;
  pullNumber?: number;
}

interface SaveOperation {
  kind: "save";
  expectedSha: string;
  payloadHash: string;
  commitSha?: string;
}

interface PullData {
  pull: EditorPull;
  nodeId: string;
  mergeable: boolean | null;
  mergeableState: string;
}

interface RepositoryData {
  canWrite: boolean;
  merge: boolean;
  squash: boolean;
  rebase: boolean;
}

const sessionCookie = "__Host-fdc85-editor";
const oauthCookie = "__Host-fdc85-editor-oauth";
const oauthTtl = 10 * 60;
const sessionTtl = 8 * 60 * 60;
const operationTtl = 7 * 24 * 60 * 60;
const maxSaveFiles = 100;
const maxJsonBytes = 32 * 1024 * 1024;
const apiRoot = `https://api.github.com/repos/${repositoryName}`;
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function badInput(message = "La requête de l'éditeur est invalide."): never {
  throw new HttpError(400, message);
}

function upstream(): never {
  throw new HttpError(502, "GitHub a renvoyé une réponse inattendue. Réessayez.");
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return upstream();
  return value;
}

function text(value: unknown): string {
  if (typeof value !== "string") return upstream();
  return value;
}

function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) return upstream();
  return value;
}

function sha(value: unknown): string {
  if (!isSha(value)) return upstream();
  return value;
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) return upstream();
  return value;
}

function base64(bytes: Uint8Array): string {
  let result = "";
  for (let index = 0; index < bytes.length; index += 8192) {
    result += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return btoa(result);
}

function unbase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function randomToken(): string {
  return base64(crypto.getRandomValues(new Uint8Array(32))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function equal(left: string, right: string): boolean {
  let difference = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

async function digest(value: string): Promise<string> {
  return base64(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function cookie(request: Request, name: string): string | undefined {
  const matches = (request.headers.get("Cookie") ?? "").split(";").map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`));
  if (matches.length !== 1) return undefined;
  const value = matches[0]?.slice(name.length + 1);
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : undefined;
}

function setCookie(name: string, value: string, ttl: number): string {
  return `${name}=${value}; Path=/; Max-Age=${ttl}; HttpOnly; Secure; SameSite=Lax`;
}

function safeUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2000) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

async function configuration(env: EditorEnv): Promise<Configuration | string> {
  const missing = [
    !env.EDITOR_GITHUB_CLIENT_ID && "EDITOR_GITHUB_CLIENT_ID",
    !env.EDITOR_GITHUB_CLIENT_SECRET && "EDITOR_GITHUB_CLIENT_SECRET",
    !env.EDITOR_ORIGIN && "EDITOR_ORIGIN",
    !env.EDITOR_SESSIONS && "EDITOR_SESSIONS",
    !env.EDITOR_SESSION_KEY && "EDITOR_SESSION_KEY",
  ].filter(Boolean);
  if (missing.length) return `Configurez les variables Cloudflare suivantes : ${missing.join(", ")}.`;
  const clientId = env.EDITOR_GITHUB_CLIENT_ID;
  const clientSecret = env.EDITOR_GITHUB_CLIENT_SECRET;
  const kv = env.EDITOR_SESSIONS;
  const encodedKey = env.EDITOR_SESSION_KEY;
  if (!clientId || !clientSecret || !kv || !encodedKey) return "La configuration GitHub est incomplète.";
  let origin: URL;
  try {
    origin = new URL(env.EDITOR_ORIGIN ?? "");
  } catch {
    return "EDITOR_ORIGIN doit être une origine HTTPS fixe.";
  }
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
    return "EDITOR_ORIGIN doit être une origine HTTPS fixe, sans chemin ni paramètres.";
  }
  const basePath = (env.EDITOR_BASE_PATH ?? "").replace(/\/$/, "");
  if (basePath && (!/^\/[A-Za-z0-9/_-]+$/.test(basePath) || basePath.includes("//"))) {
    return "EDITOR_BASE_PATH doit être un chemin absolu simple, par exemple /site-web.";
  }
  const requiredChecks = (env.EDITOR_REQUIRED_CHECKS ?? "Editor validation,Cloudflare Pages").split(",").map((name) => name.trim());
  if (!requiredChecks.length || requiredChecks.some((name) => !name || name.length > 200 || /[\x00-\x1f]/.test(name))) {
    return "EDITOR_REQUIRED_CHECKS doit contenir les noms exacts des validations, séparés par des virgules.";
  }
  const mergeMethod = env.EDITOR_MERGE_METHOD;
  if (mergeMethod !== undefined && mergeMethod !== "merge" && mergeMethod !== "squash" && mergeMethod !== "rebase") {
    return "EDITOR_MERGE_METHOD doit être merge, squash ou rebase.";
  }
  try {
    const keyBytes = unbase64(encodedKey);
    if (keyBytes.length !== 32 || base64(keyBytes) !== encodedKey) return "EDITOR_SESSION_KEY doit être une clé AES de 32 octets encodée en base64.";
    const key = await crypto.subtle.importKey("raw", new Uint8Array(keyBytes).buffer, "AES-GCM", false, ["encrypt", "decrypt"]);
    return { clientId, clientSecret, kv, key, origin: origin.origin, basePath, requiredChecks: [...new Set(requiredChecks)], mergeMethod };
  } catch {
    return "EDITOR_SESSION_KEY doit être une clé AES de 32 octets encodée en base64.";
  }
}

async function store(config: Configuration, key: string, value: object, ttl: number): Promise<void> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(key) },
    config.key, new TextEncoder().encode(JSON.stringify(value)),
  ));
  const bytes = new Uint8Array(iv.length + ciphertext.length);
  bytes.set(iv);
  bytes.set(ciphertext, iv.length);
  await config.kv.put(key, `v1.${base64(bytes)}`, { expirationTtl: ttl });
}

async function load(config: Configuration, key: string): Promise<unknown> {
  const encrypted = await config.kv.get(key);
  if (!encrypted || !encrypted.startsWith("v1.")) return null;
  try {
    const bytes = unbase64(encrypted.slice(3));
    if (bytes.length < 29) return null;
    const clear = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes.slice(0, 12), additionalData: new TextEncoder().encode(key) },
      config.key, bytes.slice(12),
    );
    const value: unknown = JSON.parse(new TextDecoder().decode(clear));
    return value;
  } catch {
    return null;
  }
}

function readSession(value: unknown): Session | null {
  if (!isRecord(value) || value.kind !== "session" || typeof value.login !== "string"
    || !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(value.login) || typeof value.avatarUrl !== "string"
    || typeof value.csrfToken !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value.csrfToken)
    || typeof value.accessToken !== "string" || !value.accessToken
    || typeof value.accessExpiresAt !== "number" || typeof value.expiresAt !== "number") return null;
  return {
    kind: "session", login: value.login, avatarUrl: value.avatarUrl, csrfToken: value.csrfToken,
    accessToken: value.accessToken, accessExpiresAt: value.accessExpiresAt, expiresAt: value.expiresAt,
    refreshToken: typeof value.refreshToken === "string" ? value.refreshToken : undefined,
    refreshExpiresAt: typeof value.refreshExpiresAt === "number" ? value.refreshExpiresAt : undefined,
  };
}

async function boundedJson(source: Request | Response, limit: number, oversizedStatus?: number): Promise<unknown> {
  const tooLarge = () => new HttpError(oversizedStatus ?? (source instanceof Request ? 413 : 502),
    oversizedStatus === 413 ? "Les fichiers de cette comparaison sont trop volumineux. Téléchargez l'archive complète." : "La réponse ou la requête est trop volumineuse.");
  const declared = Number(source.headers.get("Content-Length") ?? 0);
  if (declared > limit) throw tooLarge();
  if (!source.body) return source instanceof Request ? badInput() : upstream();
  const reader = source.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const item = await reader.read();
      if (item.done) break;
      length += item.value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw tooLarge();
      }
      chunks.push(item.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return parsed;
  } catch {
    return source instanceof Request ? badInput("Envoyez un document JSON valide.") : upstream();
  }
}

function apiFailure(status: number): never {
  if (status === 401) throw new HttpError(401, "La connexion GitHub a expiré. Reconnectez-vous.");
  if (status === 403 || status === 429) throw new HttpError(403, "GitHub refuse cette opération. Vérifiez les permissions de l'application et du compte, ou réessayez après la limite d'API.");
  if (status === 404) throw new HttpError(404, "La ressource GitHub n'est pas accessible à ce compte.");
  if (status === 405 || status === 409 || status === 422) throw new HttpError(409, "GitHub refuse cette modification : le contenu ou les protections ont changé. Actualisez puis réessayez.");
  throw new HttpError(502, "GitHub est indisponible. Réessayez sans changer l'identifiant de la requête.");
}

class GitHub {
  private session: Session;
  private fetcher: typeof fetch;
  constructor(session: Session, fetcher: typeof fetch) {
    this.session = session;
    this.fetcher = fetcher;
  }

  async response(path: string, method = "GET", body?: object): Promise<Response> {
    let response: Response;
    const fetcher = this.fetcher;
    try {
      response = await fetcher(path.startsWith("https://api.github.com/") ? path : `${apiRoot}${path}`, {
        method, redirect: "manual",
        headers: {
          Authorization: `Bearer ${this.session.accessToken}`, Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "FDC85-site-editor",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new HttpError(503, "La connexion à GitHub a été interrompue. Réessayez avec le même identifiant de requête.");
    }
    return response;
  }

  async json(path: string, method = "GET", body?: object, missingAllowed = false, limit = 8 * 1024 * 1024, oversizedStatus?: number): Promise<unknown> {
    const response = await this.response(path, method, body);
    if (response.status === 404 && missingAllowed) return null;
    if (!response.ok) return apiFailure(response.status);
    return boundedJson(response, limit, oversizedStatus);
  }

  async pages(path: string): Promise<unknown[]> {
    const items: unknown[] = [];
    for (let page = 1; page <= 100; page++) {
      const batch = array(await this.json(`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`));
      items.push(...batch);
      if (batch.length < 100) return items;
    }
    throw new HttpError(503, "Trop de résultats GitHub pour une seule opération. Aucun résultat partiel n'a été utilisé.");
  }
}

async function repository(github: GitHub): Promise<RepositoryData> {
  const data = record(await github.json(""));
  if (data.full_name !== repositoryName || data.default_branch !== baseBranch) {
    throw new HttpError(409, "Le dépôt ou sa branche principale ne correspond pas à la configuration de l'éditeur.");
  }
  const permissions = isRecord(data.permissions) ? data.permissions : {};
  return { canWrite: permissions.push === true, merge: data.allow_merge_commit === true, squash: data.allow_squash_merge === true, rebase: data.allow_rebase_merge === true };
}

function requireWrite(repo: RepositoryData): void {
  if (!repo.canWrite) throw new HttpError(403, "Ce compte et cette application GitHub doivent disposer du droit d'écriture sur le dépôt.");
}

async function mainSha(github: GitHub): Promise<string> {
  return sha(record(record(await github.json(`/git/ref/heads/${baseBranch}`)).object).sha);
}

function parsePull(value: unknown, requireEditorBranch = true): PullData {
  const data = record(value);
  const head = record(data.head);
  const base = record(data.base);
  if (data.state !== "open" || base.ref !== baseBranch
    || !isRecord(base.repo) || base.repo.full_name !== repositoryName
    || !isRecord(head.repo) || head.repo.full_name !== repositoryName
    || typeof data.title !== "string" || !data.title.startsWith(pullPrefix)
    || typeof head.ref !== "string" || (requireEditorBranch && !/^editor\/[^/]+\/[^/]+$/.test(head.ref))) {
    throw new HttpError(409, "Seules les demandes ouvertes de l'éditeur, issues de ce dépôt et destinées à main, sont prises en charge.");
  }
  const number = integer(data.number);
  if (!number) return upstream();
  const url = safeUrl(data.html_url);
  if (!url || new URL(url).hostname !== "github.com" || new URL(url).pathname !== `/${repositoryName}/pull/${number}`) return upstream();
  const author = text(record(data.user).login);
  if (typeof data.draft !== "boolean") return upstream();
  return {
    pull: { number, title: data.title, url, headRef: head.ref, headSha: sha(head.sha), author, updatedAt: text(data.updated_at), draft: data.draft },
    nodeId: typeof data.node_id === "string" ? data.node_id : "",
    mergeable: typeof data.mergeable === "boolean" ? data.mergeable : null,
    mergeableState: typeof data.mergeable_state === "string" ? data.mergeable_state : "unknown",
  };
}

async function getPull(github: GitHub, number: number): Promise<PullData> {
  const data = parsePull(await github.json(`/pulls/${number}`));
  if (data.pull.number !== number) return upstream();
  return data;
}

async function listPulls(github: GitHub): Promise<EditorPull[]> {
  const values = await github.pages(`/pulls?state=open&base=${baseBranch}`);
  const pulls: EditorPull[] = [];
  for (const value of values) {
    const data = record(value);
    if (typeof data.title !== "string" || !data.title.startsWith(pullPrefix)) continue;
    if (!isRecord(data.head) || !isRecord(data.head.repo) || data.head.repo.full_name !== repositoryName) continue;
    pulls.push(parsePull(value, false).pull);
  }
  return pulls;
}

function guardHead(pull: EditorPull, expectedSha: string): void {
  if (pull.headSha !== expectedSha) throw new HttpError(409, "La demande a changé sur GitHub. Rechargez sa dernière version avant de continuer.");
}

function requestId(value: unknown): string {
  if (typeof value !== "string" || !idPattern.test(value)) return badInput("requestId doit être un UUID unique.");
  return value;
}

function inputSha(value: unknown): string {
  if (!isSha(value)) return badInput("expectedSha doit être le SHA exact de la dernière sauvegarde.");
  return value;
}

function inputRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return badInput();
  return value;
}

function allowedPath(path: string): boolean {
  return editablePath(path)
    && !path.split("/").some((part) => /^(admin|editor|edit)(?:\.|$)/i.test(part) || /\.config\./i.test(part))
    && !path.startsWith("src/pages/api/");
}

function changesInput(value: unknown): FileChange[] {
  if (!Array.isArray(value) || !value.length || value.length > maxSaveFiles) {
    return badInput(`Une sauvegarde doit contenir de 1 à ${maxSaveFiles} fichiers.`);
  }
  const paths = new Set<string>();
  let total = 0;
  return value.map((item: unknown) => {
    const change = inputRecord(item);
    if (typeof change.path !== "string" || !allowedPath(change.path)) return badInput("Ce chemin est protégé ou n'est pas modifiable dans l'éditeur.");
    if (paths.has(change.path)) return badInput("Un fichier ne peut apparaître qu'une seule fois dans une sauvegarde.");
    paths.add(change.path);
    if (change.encoding !== "utf8" && change.encoding !== "base64") return badInput("Encodage de fichier invalide.");
    if (change.content !== null && typeof change.content !== "string") return badInput("Contenu de fichier invalide.");
    let length = 0;
    if (typeof change.content === "string") {
      if (change.encoding === "base64") {
        if (change.content.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(change.content)) return badInput("Contenu base64 invalide.");
        try {
          const decoded = unbase64(change.content);
          if (base64(decoded) !== change.content) return badInput("Contenu base64 invalide.");
          length = decoded.length;
        } catch (error) {
          if (error instanceof HttpError) throw error;
          return badInput("Contenu base64 invalide.");
        }
      } else {
        length = new TextEncoder().encode(change.content).byteLength;
      }
    }
    total += length;
    if (length > maxFileBytes || total > maxWorkspaceBytes) throw new HttpError(413, "La sauvegarde dépasse les limites de taille de l'éditeur.");
    return { path: change.path, content: change.content, encoding: change.encoding };
  });
}

function createOperation(value: unknown): CreateOperation | null {
  if (!isRecord(value) || value.kind !== "create" || typeof value.name !== "string" || typeof value.author !== "string"
    || typeof value.branch !== "string" || !isSha(value.baseSha) || typeof value.time !== "string") return null;
  return { kind: "create", name: value.name, author: value.author, branch: value.branch, baseSha: value.baseSha, time: value.time,
    pullNumber: typeof value.pullNumber === "number" && Number.isSafeInteger(value.pullNumber) ? value.pullNumber : undefined };
}

function saveOperation(value: unknown): SaveOperation | null {
  if (!isRecord(value) || value.kind !== "save" || !isSha(value.expectedSha) || typeof value.payloadHash !== "string") return null;
  return { kind: "save", expectedSha: value.expectedSha, payloadHash: value.payloadHash, commitSha: isSha(value.commitSha) ? value.commitSha : undefined };
}

async function refSha(github: GitHub, branch: string): Promise<string | null> {
  const data = await github.json(`/git/ref/heads/${branch}`, "GET", undefined, true);
  return data === null ? null : sha(record(record(data).object).sha);
}

async function metadataMatches(github: GitHub, headSha: string, id: string, operation: CreateOperation): Promise<boolean> {
  const data = await github.json(`/contents/.editor/requests/${id}.json?ref=${headSha}`, "GET", undefined, true);
  if (data === null) return false;
  const file = record(data);
  if (file.type !== "file" || file.encoding !== "base64" || typeof file.content !== "string") return upstream();
  let metadata: unknown;
  try {
    metadata = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(unbase64(file.content.replace(/\n/g, ""))));
  } catch {
    return upstream();
  }
  if (!isRecord(metadata) || metadata.version !== 1 || metadata.name !== operation.name || metadata.author !== operation.author || metadata.time !== operation.time) {
    throw new HttpError(409, "L'identifiant de création appartient à une autre demande.");
  }
  return true;
}

async function createPull(github: GitHub, config: Configuration, session: Session, body: Record<string, unknown>, now: number): Promise<EditorPull> {
  let name: string;
  try {
    name = requestTitle(body.title);
  } catch {
    return badInput("Donnez un nom de 1 à 100 caractères à la modification.");
  }
  const id = requestId(body.requestId);
  const key = `create:${session.login}:${id}`;
  let operation = createOperation(await load(config, key));
  if (operation && (operation.name !== name || operation.author !== session.login)) throw new HttpError(409, "Cet identifiant a déjà été utilisé avec un autre nom.");
  if (!operation) {
    const slug = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "modification";
    operation = { kind: "create", name, author: session.login, branch: `editor/${session.login}/${slug}-${id}`, baseSha: await mainSha(github), time: new Date(now).toISOString() };
    await store(config, key, operation, operationTtl);
  }
  if (operation.pullNumber) return (await getPull(github, operation.pullNumber)).pull;
  let headSha = await refSha(github, operation.branch);
  if (!headSha) {
    try {
      await github.json("/git/refs", "POST", { ref: `refs/heads/${operation.branch}`, sha: operation.baseSha });
    } catch (error) {
      if (!(error instanceof HttpError) || error.status !== 409) throw error;
    }
    headSha = await refSha(github, operation.branch);
    if (!headSha) return upstream();
  }
  if (!await metadataMatches(github, headSha, id, operation)) {
    if (headSha !== operation.baseSha) throw new HttpError(409, "La branche de cette demande a été modifiée avant sa création.");
    const commit = record(await github.json(`/git/commits/${headSha}`));
    const blob = record(await github.json("/git/blobs", "POST", {
      content: `${JSON.stringify({ version: 1, name: operation.name, author: operation.author, time: operation.time }, null, 2)}\n`, encoding: "utf-8",
    }));
    const tree = record(await github.json("/git/trees", "POST", { base_tree: sha(record(commit.tree).sha), tree: [{ path: `.editor/requests/${id}.json`, mode: "100644", type: "blob", sha: sha(blob.sha) }] }));
    const created = record(await github.json("/git/commits", "POST", {
      message: `${pullPrefix}[${session.login}] ${name}\n\nEditor-Request: create:${id}`, tree: sha(tree.sha), parents: [headSha],
    }));
    try {
      await github.json(`/git/refs/heads/${operation.branch}`, "PATCH", { sha: sha(created.sha), force: false });
    } catch (error) {
      if (!(error instanceof HttpError) || error.status !== 409) throw error;
      const current = await refSha(github, operation.branch);
      if (!current || !await metadataMatches(github, current, id, operation)) throw error;
    }
  }
  const existing = (await listPulls(github)).find((pull) => pull.headRef === operation.branch);
  let pull: EditorPull;
  if (existing) {
    pull = (await getPull(github, existing.number)).pull;
  } else {
    try {
      pull = parsePull(await github.json("/pulls", "POST", {
        title: `${pullPrefix}[${session.login}] ${name}`, head: operation.branch, base: baseBranch, draft: true,
        body: "Demande créée dans l'éditeur local du site. Les fichiers sont sauvegardés et validés avant toute fusion.",
      })).pull;
    } catch (error) {
      if (!(error instanceof HttpError) || error.status !== 409) throw error;
      const recovered = (await listPulls(github)).find((candidate) => candidate.headRef === operation.branch);
      if (!recovered) throw error;
      pull = (await getPull(github, recovered.number)).pull;
    }
  }
  operation.pullNumber = pull.number;
  await store(config, key, operation, operationTtl);
  return pull;
}

function markerMatches(value: unknown, expectedSha: string, id: string, payloadHash: string): boolean {
  const data = record(value);
  const commit = isRecord(data.commit) ? data.commit : data;
  const message = text(commit.message);
  const parents = array(data.parents);
  return message.split("\n").includes(`Editor-Request: save:${id}`)
    && message.split("\n").includes(`Editor-Payload: ${payloadHash}`)
    && parents.length === 1 && record(parents[0]).sha === expectedSha;
}

async function savedInHistory(github: GitHub, expectedSha: string, headSha: string, id: string, payloadHash: string): Promise<string | null> {
  if (markerMatches(await github.json(`/git/commits/${headSha}`), expectedSha, id, payloadHash)) return headSha;
  for (let page = 1; page <= 20; page++) {
    const comparison = record(await github.json(`/compare/${expectedSha}...${headSha}?per_page=100&page=${page}`));
    if (comparison.status !== "ahead" && comparison.status !== "identical") return null;
    const commits = array(comparison.commits);
    const saved = commits.find((commit) => markerMatches(commit, expectedSha, id, payloadHash));
    if (saved) return sha(record(saved).sha);
    if (commits.length < 100) return null;
  }
  throw new HttpError(409, "La demande a trop évolué pour retrouver cette sauvegarde. Rechargez-la avant de continuer.");
}

async function savePull(github: GitHub, config: Configuration, session: Session, number: number, body: Record<string, unknown>): Promise<EditorPull & { savedSha: string }> {
  const expectedSha = inputSha(body.expectedSha);
  const changes = changesInput(body.changes);
  const id = requestId(body.requestId);
  const payloadHash = await digest(JSON.stringify({ expectedSha, changes }));
  const key = `save:${number}:${session.login}:${id}`;
  const previous = saveOperation(await load(config, key));
  if (previous && (previous.expectedSha !== expectedSha || previous.payloadHash !== payloadHash)) {
    throw new HttpError(409, "Cet identifiant de sauvegarde a déjà été utilisé avec un autre contenu.");
  }
  let current = await getPull(github, number);
  if (current.pull.headSha !== expectedSha) {
    const savedSha = await savedInHistory(github, expectedSha, current.pull.headSha, id, payloadHash);
    if (savedSha) return { ...current.pull, savedSha };
    guardHead(current.pull, expectedSha);
  }
  if (previous?.commitSha) throw new HttpError(409, "La branche a été réinitialisée après cette sauvegarde. Rechargez-la.");
  await store(config, key, { kind: "save", expectedSha, payloadHash }, operationTtl);
  const parent = record(await github.json(`/git/commits/${expectedSha}`));
  const treeSha = sha(record(parent.tree).sha);
  const tree = record(await github.json(`/git/trees/${treeSha}?recursive=1`));
  if (tree.truncated !== false) throw new HttpError(409, "L'arbre Git est trop volumineux pour vérifier les chemins en toute sécurité.");
  const entries = new Map<string, { mode: string; type: string }>();
  for (const item of array(tree.tree)) {
    const entry = record(item);
    entries.set(text(entry.path), { mode: text(entry.mode), type: text(entry.type) });
  }
  const updates: { path: string; mode: string; type: string; sha: string | null }[] = [];
  for (const change of changes) {
    const parts = change.path.split("/");
    for (let length = 1; length <= parts.length; length++) {
      const entry = entries.get(parts.slice(0, length).join("/"));
      if (!entry) continue;
      const last = length === parts.length;
      if ((!last && (entry.type !== "tree" || entry.mode !== "040000"))
        || (last && (entry.type !== "blob" || !["100644", "100755"].includes(entry.mode)))) {
        return badInput("Les liens symboliques, sous-modules et remplacements de dossiers sont interdits.");
      }
    }
    const existing = entries.get(change.path);
    if (change.content === null) {
      if (!existing) throw new HttpError(409, "Un fichier à supprimer n'existe plus. Rechargez la demande.");
      updates.push({ path: change.path, mode: existing.mode, type: "blob", sha: null });
    } else {
      const blob = record(await github.json("/git/blobs", "POST", { content: change.content, encoding: change.encoding === "utf8" ? "utf-8" : "base64" }));
      updates.push({ path: change.path, mode: existing?.mode ?? "100644", type: "blob", sha: sha(blob.sha) });
    }
  }
  const createdTree = record(await github.json("/git/trees", "POST", { base_tree: treeSha, tree: updates }));
  const createdCommit = record(await github.json("/git/commits", "POST", {
    message: `${pullPrefix} Sauvegarde de ${session.login}\n\nEditor-Request: save:${id}\nEditor-Payload: ${payloadHash}`,
    tree: sha(createdTree.sha), parents: [expectedSha],
  }));
  const commitSha = sha(createdCommit.sha);
  current = await getPull(github, number);
  if (current.pull.headSha !== expectedSha) {
    const savedSha = await savedInHistory(github, expectedSha, current.pull.headSha, id, payloadHash);
    if (savedSha) return { ...current.pull, savedSha };
    guardHead(current.pull, expectedSha);
  }
  await github.json(`/git/refs/heads/${current.pull.headRef}`, "PATCH", { sha: commitSha, force: false });
  await store(config, key, { kind: "save", expectedSha, payloadHash, commitSha }, operationTtl);
  const result = (await getPull(github, number)).pull;
  const savedSha = result.headSha === commitSha ? commitSha : await savedInHistory(github, expectedSha, result.headSha, id, payloadHash);
  if (!savedSha) {
    throw new HttpError(409, "La branche a changé après la sauvegarde. Rechargez la demande.");
  }
  return { ...result, savedSha };
}

async function pullChecks(github: GitHub, config: Configuration, data: PullData): Promise<PullChecks> {
  const headSha = data.pull.headSha;
  const runs: unknown[] = [];
  for (let page = 1; page <= 100; page++) {
    const result = record(await github.json(`/commits/${headSha}/check-runs?filter=latest&per_page=100&page=${page}`));
    const batch = array(result.check_runs);
    runs.push(...batch);
    if (batch.length < 100) break;
    if (page === 100) throw new HttpError(503, "Trop de validations GitHub pour cette demande.");
  }
  const statuses = await github.pages(`/commits/${headSha}/statuses`);
  const latest = new Map<string, Record<string, unknown>>();
  for (const value of statuses) {
    const status = record(value);
    const context = text(status.context);
    const previous = latest.get(context);
    if (!previous || integer(status.id) > integer(previous.id)) latest.set(context, status);
  }
  let pending = false;
  let failed = false;
  const missing: string[] = [];
  for (const name of config.requiredChecks) {
    const matches = runs.map(record).filter((run) => run.name === name);
    const status = latest.get(name);
    if (!matches.length && !status) missing.push(name);
    for (const run of matches) {
      if (run.head_sha !== headSha) return upstream();
      if (run.status !== "completed" || run.conclusion === null) pending = true;
      else if (["failure", "cancelled", "timed_out", "action_required", "startup_failure", "stale"].includes(text(run.conclusion))) failed = true;
      else if (!["success", "neutral", "skipped"].includes(text(run.conclusion))) pending = true;
    }
    if (status) {
      if (status.sha !== undefined && status.sha !== headSha) return upstream();
      if (status.state === "error" || status.state === "failure") failed = true;
      else if (status.state !== "success") pending = true;
    }
  }
  const mergeabilityPending = data.mergeable === null || data.mergeableState === "unknown"
    || (data.mergeable === true && !["clean", "has_hooks"].includes(data.mergeableState) && !(data.pull.draft && data.mergeableState === "draft"));
  if (failed || data.mergeable === false) return { sha: headSha, state: "failure", mergeable: data.mergeable, message: failed ? "Une validation requise a échoué." : "La demande présente un conflit avec main." };
  if (pending || missing.length || mergeabilityPending) return {
    sha: headSha, state: "pending", mergeable: data.mergeable,
    message: missing.length ? `Validations attendues : ${missing.join(", ")}.` : "Les validations ou les protections GitHub ne sont pas encore prêtes.",
  };
  return { sha: headSha, state: "success", mergeable: data.mergeable, message: "Les validations requises de cette version ont réussi." };
}

async function mergePull(github: GitHub, config: Configuration, repo: RepositoryData, number: number, expectedSha: string): Promise<MergeResult> {
  let data = await getPull(github, number);
  guardHead(data.pull, expectedSha);
  const check = await pullChecks(github, config, data);
  if (check.state !== "success" || check.mergeable !== true) throw new HttpError(409, check.message);
  const method = config.mergeMethod ?? (repo.squash ? "squash" : repo.merge ? "merge" : repo.rebase ? "rebase" : undefined);
  if (!method || !repo[method]) throw new HttpError(409, "Le mode de fusion configuré n'est pas autorisé par ce dépôt.");
  if (data.pull.draft) {
    if (!data.nodeId || data.nodeId.length > 200 || !/^[A-Za-z0-9_=-]+$/.test(data.nodeId)) return upstream();
    const result = record(await github.json("https://api.github.com/graphql", "POST", {
      query: "mutation EditorReady($id: ID!) { markPullRequestReadyForReview(input: {pullRequestId: $id}) { pullRequest { isDraft headRefOid } } }",
      variables: { id: data.nodeId },
    }));
    if (Array.isArray(result.errors) && result.errors.length) throw new HttpError(409, "GitHub n'autorise pas le passage de cette demande en revue.");
    const ready = record(record(record(result.data).markPullRequestReadyForReview).pullRequest);
    if (ready.isDraft !== false || ready.headRefOid !== expectedSha) throw new HttpError(409, "La demande a changé pendant son passage en revue.");
    data = await getPull(github, number);
    guardHead(data.pull, expectedSha);
    const readyChecks = await pullChecks(github, config, data);
    if (data.pull.draft || readyChecks.state !== "success" || readyChecks.mergeable !== true) throw new HttpError(409, readyChecks.message);
  } else {
    guardHead((await getPull(github, number)).pull, expectedSha);
  }
  const result = record(await github.json(`/pulls/${number}/merge`, "PUT", { sha: expectedSha, merge_method: method }));
  if (typeof result.merged !== "boolean") return upstream();
  return { sha: result.merged ? sha(result.sha) : expectedSha, merged: result.merged,
    message: result.merged ? "La demande a été fusionnée dans main." : "GitHub n'a pas fusionné la demande. Vérifiez les protections et rechargez sa dernière version." };
}

async function deployment(github: GitHub, requestedSha: string): Promise<DeploymentStatus> {
  const values = await github.pages(`/deployments?sha=${requestedSha}`);
  const deployments = values.map(record).filter((item) => item.sha === requestedSha && item.transient_environment !== true
    && (item.production_environment === true || (typeof item.environment === "string" && item.environment.toLowerCase() === "production")));
  deployments.sort((left, right) => text(right.created_at).localeCompare(text(left.created_at)) || integer(right.id) - integer(left.id));
  const latest = deployments[0];
  if (!latest) return { state: "pending", message: "Aucun déploiement de production GitHub n'a encore été enregistré pour cette version." };
  const statuses = (await github.pages(`/deployments/${integer(latest.id)}/statuses`)).map(record);
  statuses.sort((left, right) => text(right.created_at).localeCompare(text(left.created_at)) || integer(right.id) - integer(left.id));
  const status = statuses[0];
  if (!status) return { state: "pending", message: "Le déploiement de production attend un statut GitHub." };
  if (status.state === "success") return { state: "success", url: safeUrl(status.environment_url), message: "Cette version a été déployée en production." };
  if (status.state === "failure" || status.state === "error") return { state: "failure", message: "Le déploiement de production de cette version a échoué." };
  return { state: "pending", message: "Le déploiement de production de cette version n'est pas encore terminé." };
}

async function pullChanges(github: GitHub, number: number, fromSha: string, expectedSha: string): Promise<FileChange[]> {
  const pull = (await getPull(github, number)).pull;
  guardHead(pull, expectedSha);
  const currentMain = await mainSha(github);
  if (fromSha !== currentMain) {
    const ancestry = record(await github.json(`/compare/${fromSha}...${currentMain}?per_page=1`));
    if (!["ahead", "identical"].includes(text(ancestry.status))) {
      throw new HttpError(409, "La version en cache n'est plus un ancêtre de main. Téléchargez l'archive complète.");
    }
  }
  const comparison = record(await github.json(`/compare/${fromSha}...${pull.headSha}?per_page=1`));
  // GitHub compares against the merge base; a diverged cache cannot be patched into the exact head.
  if (!["ahead", "identical"].includes(text(comparison.status))) {
    throw new HttpError(409, "La demande et la version en cache ont divergé. Téléchargez l'archive complète.");
  }
  const files = array(comparison.files);
  if (files.length >= 300) throw new HttpError(409, "GitHub limite cette comparaison à 300 fichiers. Téléchargez l'archive complète.");
  const changes = new Map<string, FileChange>();
  const changed: Record<string, unknown>[] = [];
  for (const value of files) {
    const file = record(value);
    const path = text(file.filename);
    if (!validPath(path)) return upstream();
    const status = text(file.status);
    if (!["added", "removed", "modified", "renamed", "copied", "changed", "unchanged"].includes(status)) return upstream();
    if (status === "removed") changes.set(path, { path, content: null, encoding: "utf8" });
    else {
      if (status === "renamed") {
        const previous = text(file.previous_filename);
        if (!validPath(previous)) return upstream();
        changes.set(previous, { path: previous, content: null, encoding: "utf8" });
      }
      changed.push(file);
    }
  }
  let total = 0;
  for (const file of changed) {
    const blobSha = sha(file.sha);
    const blob = record(await github.json(`/git/blobs/${blobSha}`, "GET", undefined, false, maxJsonBytes, 413));
    const size = integer(blob.size);
    total += size;
    if (size > maxFileBytes || total > maxJsonBytes) throw new HttpError(413, "Les fichiers de cette comparaison dépassent les limites. Téléchargez l'archive complète.");
    if (blob.sha !== blobSha || blob.encoding !== "base64" || typeof blob.content !== "string") return upstream();
    let bytes: Uint8Array;
    try {
      bytes = unbase64(blob.content.replace(/\n/g, ""));
    } catch {
      return upstream();
    }
    if (bytes.byteLength !== size) return upstream();
    const path = text(file.filename);
    changes.set(path, { path, ...encodeFile(bytes) });
  }
  guardHead((await getPull(github, number)).pull, pull.headSha);
  return [...changes.values()];
}

export function createEditorHandler(dependencies: Dependencies = {}): (request: Request, env: EditorEnv) => Promise<Response> {
  const fetcher = dependencies.fetch ?? fetch;
  const now = dependencies.now ?? Date.now;
  const log = dependencies.log ?? ((message: string) => console.error(message));
  return async (request, env) => {
    const responseCookies: string[] = [];
    const finish = (response: Response): Response => {
      response.headers.set("Cache-Control", "no-store");
      response.headers.set("X-Content-Type-Options", "nosniff");
      response.headers.set("Referrer-Policy", "no-referrer");
      for (const value of responseCookies) response.headers.append("Set-Cookie", value);
      return response;
    };
    const json = (value: unknown, status = 200): Response => finish(new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json; charset=utf-8" } }));
    const redirect = (location: string): Response => finish(new Response(null, { status: 302, headers: { Location: location } }));
    try {
      const url = new URL(request.url);
      const config = await configuration(env);
      const basePath = typeof config === "string" ? "" : config.basePath;
      const prefix = url.pathname.startsWith(`${basePath}/api/editor/`) ? `${basePath}/api/editor/` : "/api/editor/";
      if (!url.pathname.startsWith(prefix)) return json({ message: "Route de l'éditeur introuvable." }, 404);
      const route = url.pathname.slice(prefix.length).replace(/\/$/, "");
      if (typeof config === "string") {
        if (request.method === "GET" && route === "status") {
          const status: EditorStatus = { configured: false, authenticated: false, message: config, repository: { fullName: repositoryName, defaultBranch: baseBranch } };
          return json(status);
        }
        throw new HttpError(503, config);
      }
      const callbackUrl = `${config.origin}${config.basePath}/api/editor/callback`;
      if (request.method === "GET" && route === "login") {
        if (url.origin !== config.origin) return redirect(`${config.origin}${config.basePath}/api/editor/login`);
        const previous = cookie(request, oauthCookie);
        if (previous) await config.kv.delete(`oauth:${previous}`);
        const id = randomToken();
        const state = randomToken();
        const verifier = randomToken();
        await store(config, `oauth:${id}`, { kind: "oauth", state, verifier, expiresAt: now() + oauthTtl * 1000 }, oauthTtl);
        responseCookies.push(setCookie(oauthCookie, id, oauthTtl));
        const authorize = new URL("https://github.com/login/oauth/authorize");
        authorize.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: callbackUrl, state, code_challenge: await digest(verifier), code_challenge_method: "S256" }).toString();
        return redirect(authorize.href);
      }
      if (request.method === "GET" && route === "callback") {
        responseCookies.push(setCookie(oauthCookie, "", 0));
        const id = cookie(request, oauthCookie);
        const saved = id ? await load(config, `oauth:${id}`) : null;
        if (id) await config.kv.delete(`oauth:${id}`);
        const state = url.searchParams.get("state");
        const code = url.searchParams.get("code");
        if (!isRecord(saved) || saved.kind !== "oauth" || typeof saved.state !== "string" || typeof saved.verifier !== "string"
          || typeof saved.expiresAt !== "number" || saved.expiresAt <= now()
          || !state || state.length > 100 || !equal(state, saved.state) || !code || code.length > 1000 || url.searchParams.has("error")) {
          throw new HttpError(400, "La connexion GitHub a expiré ou son état est invalide. Recommencez la connexion.");
        }
        const oauth: OAuthState = { kind: "oauth", state: saved.state, verifier: saved.verifier, expiresAt: saved.expiresAt };
        let tokenResponse: Response;
        try {
          tokenResponse = await fetcher("https://github.com/login/oauth/access_token", {
            method: "POST", redirect: "manual", headers: { Accept: "application/json", "Content-Type": "application/json" },
            body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, code, redirect_uri: callbackUrl, code_verifier: oauth.verifier }),
          });
        } catch {
          throw new HttpError(503, "La connexion GitHub est indisponible. Recommencez la connexion.");
        }
        if (!tokenResponse.ok) return apiFailure(tokenResponse.status);
        const tokens = record(await boundedJson(tokenResponse, 64 * 1024));
        if (typeof tokens.access_token !== "string" || !tokens.access_token || tokens.access_token.length > 4096
          || tokens.token_type !== "bearer" || tokens.error) throw new HttpError(401, "GitHub n'a pas autorisé la connexion. Vérifiez l'installation de l'application puis reconnectez-vous.");
        if (tokens.expires_in !== undefined && (typeof tokens.expires_in !== "number" || !Number.isFinite(tokens.expires_in) || tokens.expires_in < 1)) return upstream();
        const expiresIn = typeof tokens.expires_in === "number" ? Math.min(tokens.expires_in, sessionTtl) : sessionTtl;
        const session: Session = {
          kind: "session", login: "", avatarUrl: "", csrfToken: randomToken(), accessToken: tokens.access_token,
          accessExpiresAt: now() + expiresIn * 1000, expiresAt: now() + sessionTtl * 1000,
          refreshToken: typeof tokens.refresh_token === "string" ? tokens.refresh_token : undefined,
          refreshExpiresAt: typeof tokens.refresh_token_expires_in === "number" ? now() + tokens.refresh_token_expires_in * 1000 : undefined,
        };
        const user = record(await new GitHub(session, fetcher).json("https://api.github.com/user"));
        if (typeof user.login !== "string" || !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(user.login)) return upstream();
        session.login = user.login;
        session.avatarUrl = safeUrl(user.avatar_url) ?? "";
        const previous = cookie(request, sessionCookie);
        if (previous) await config.kv.delete(`session:${previous}`);
        const sessionId = randomToken();
        await store(config, `session:${sessionId}`, session, Math.ceil(expiresIn));
        responseCookies.push(setCookie(sessionCookie, sessionId, Math.floor(expiresIn)));
        return redirect(`${config.origin}${config.basePath}/edit/`);
      }
      const sessionId = cookie(request, sessionCookie);
      let session = sessionId ? readSession(await load(config, `session:${sessionId}`)) : null;
      if (session && (session.expiresAt <= now() || session.accessExpiresAt <= now())) {
        if (sessionId) await config.kv.delete(`session:${sessionId}`);
        session = null;
      }
      if (!session && sessionId) responseCookies.push(setCookie(sessionCookie, "", 0));
      if (request.method === "GET" && route === "status") {
        const status: EditorStatus = { configured: true, authenticated: Boolean(session), repository: { fullName: repositoryName, defaultBranch: baseBranch } };
        if (session) {
          const github = new GitHub(session, fetcher);
          const repo = await repository(github);
          status.repository.defaultSha = await mainSha(github);
          status.user = { login: session.login, avatarUrl: session.avatarUrl };
          status.canWrite = repo.canWrite;
          status.csrfToken = session.csrfToken;
        } else {
          status.message = "Connectez-vous à GitHub pour ouvrir une modification.";
        }
        return json(status);
      }
      if (!session) throw new HttpError(401, "Connectez-vous à GitHub pour utiliser l'éditeur.");
      if (request.method !== "GET" && request.method !== "POST") return json({ message: "Méthode non autorisée." }, 405);
      if (request.method === "POST") {
        const csrf = request.headers.get("X-CSRF-Token");
        if (request.headers.get("Origin") !== config.origin || !csrf || csrf.length > 100 || !equal(csrf, session.csrfToken)) {
          throw new HttpError(403, "L'origine ou le jeton de sécurité est invalide. Rechargez l'éditeur.");
        }
      }
      const github = new GitHub(session, fetcher);
      if (route === "logout" && request.method === "POST") {
        if (sessionId) await config.kv.delete(`session:${sessionId}`);
        responseCookies.push(setCookie(sessionCookie, "", 0));
        return json({ loggedOut: true });
      }
      if (route === "pulls" && request.method === "GET") return json(await listPulls(github));
      if (route === "archive" && request.method === "GET") {
        const requestedSha = url.searchParams.get("sha");
        if (!isSha(requestedSha)) return badInput("Indiquez un SHA Git complet pour l'archive.");
        const number = url.searchParams.get("pull");
        if (number !== null) {
          if (!/^[1-9][0-9]{0,8}$/.test(number)) return badInput("Numéro de demande invalide.");
          guardHead((await getPull(github, Number(number))).pull, requestedSha);
        } else if (await mainSha(github) !== requestedSha) {
          throw new HttpError(409, "Seule la version actuelle de main ou d'une demande ouverte peut être téléchargée.");
        }
        let archive = await github.response(`/zipball/${requestedSha}`);
        if ([301, 302, 303, 307, 308].includes(archive.status)) {
          const location = safeUrl(archive.headers.get("Location"));
          if (!location || new URL(location).hostname !== "codeload.github.com") return upstream();
          try {
            archive = await fetcher(location, { redirect: "manual", signal: request.signal });
          } catch {
            throw new HttpError(503, "Le téléchargement GitHub a été interrompu. Réessayez.");
          }
        }
        if (!archive.ok || !archive.body) return apiFailure(archive.status);
        return finish(new Response(archive.body, { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="editor-${requestedSha}.zip"` } }));
      }
      if (route === "deployment" && request.method === "GET") {
        const requestedSha = url.searchParams.get("sha");
        if (!isSha(requestedSha)) return badInput("Indiquez le SHA exact de la version fusionnée.");
        return json(await deployment(github, requestedSha));
      }
      const match = /^pulls\/([1-9][0-9]{0,8})(?:\/(save|close|checks|merge|changes))?$/.exec(route);
      if (request.method === "GET" && match) {
        const number = Number(match[1]);
        if (!match[2]) return json((await getPull(github, number)).pull);
        if (match[2] === "checks") return json(await pullChecks(github, config, await getPull(github, number)));
        if (match[2] === "changes") {
          const fromSha = url.searchParams.get("from");
          if (!isSha(fromSha)) return badInput("Indiquez le SHA complet de la version main en cache.");
          return json(await pullChanges(github, number, fromSha, inputSha(url.searchParams.get("expectedSha"))));
        }
      }
      if (request.method === "POST" && (route === "pulls" || (match && ["save", "close", "merge"].includes(match[2] ?? "")))) {
        if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type") ?? "")) return badInput("Content-Type doit être application/json.");
        const body = inputRecord(await boundedJson(request, maxJsonBytes));
        const repo = await repository(github);
        requireWrite(repo);
        if (route === "pulls") return json(await createPull(github, config, session, body, now()));
        if (!match) return badInput();
        const number = Number(match[1]);
        if (match[2] === "save") return json(await savePull(github, config, session, number, body));
        const expectedSha = inputSha(body.expectedSha);
        if (match[2] === "merge") return json(await mergePull(github, config, repo, number, expectedSha));
        const data = await getPull(github, number);
        guardHead(data.pull, expectedSha);
        const closed = record(await github.json(`/pulls/${number}`, "PATCH", { state: "closed" }));
        if (closed.state !== "closed" || integer(closed.number) !== number) return upstream();
        return json({ closed: true });
      }
      return json({ message: "Route ou méthode de l'éditeur introuvable." }, 404);
    } catch (error) {
      if (error instanceof HttpError) {
        if (error.status === 401) responseCookies.push(setCookie(sessionCookie, "", 0));
        return json({ message: error.message }, error.status);
      }
      log("Editor backend: unexpected server or storage failure.");
      return json({ message: "L'éditeur est temporairement indisponible. Réessayez avec le même identifiant de requête." }, 503);
    }
  };
}

export const handleEditorRequest = createEditorHandler();
