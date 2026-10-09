export interface EditorPull {
  number: number;
  title: string;
  url: string;
  headRef: string;
  headSha: string;
  author: string;
  updatedAt: string;
  draft: boolean;
}

export interface EditorStatus {
  configured: boolean;
  authenticated: boolean;
  message?: string;
  user?: { login: string; avatarUrl: string };
  canWrite?: boolean;
  csrfToken?: string;
  repository: { fullName: string; defaultBranch: string; defaultSha?: string };
}

export interface FileChange {
  path: string;
  content: string | null;
  encoding: "utf8" | "base64";
}

export interface SavedPull extends EditorPull { savedSha: string }

export interface PullChecks {
  sha: string;
  state: "pending" | "success" | "failure";
  message: string;
  mergeable: boolean | null;
}

export interface MergeResult {
  sha: string;
  merged: boolean;
  message: string;
}

export interface DeploymentStatus {
  state: "pending" | "success" | "failure";
  url?: string;
  message: string;
}

export interface RepositoryAdapter {
  status(): Promise<EditorStatus>;
  listPulls(): Promise<EditorPull[]>;
  getPull(number: number): Promise<EditorPull>;
  createPull(title: string, requestId: string): Promise<EditorPull>;
  archive(sha: string, pull?: number, signal?: AbortSignal): Promise<Response>;
  changes(fromSha: string, pull: EditorPull): Promise<FileChange[]>;
  save(pull: EditorPull, changes: FileChange[], requestId: string): Promise<SavedPull>;
  close(pull: EditorPull): Promise<void>;
  checks(pull: EditorPull): Promise<PullChecks>;
  merge(pull: EditorPull): Promise<MergeResult>;
  deployment(sha: string): Promise<DeploymentStatus>;
  logout(): Promise<void>;
}

export interface RuntimeHooks {
  stage(message: string): void;
  log(message: string): void;
  ready(url: string): void;
  error(message: string): void;
}

export interface RuntimeAdapter {
  prepare(files: Map<string, Uint8Array>, signal: AbortSignal): Promise<void>;
  open(files: Map<string, Uint8Array>, signal: AbortSignal): Promise<string>;
  write(path: string, content: Uint8Array | null): Promise<void>;
  validate(signal: AbortSignal): Promise<void>;
  stop(): void;
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
