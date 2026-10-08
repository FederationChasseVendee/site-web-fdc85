import { Unzip, UnzipInflate } from "fflate";
import { isRecord, type FileChange, type ChatMessage } from "./contracts.ts";
import { decodeFile, encodeFile, editablePath, fileHash, isSha, maxFileBytes, maxWorkspaceBytes, maxWorkspaceFiles, readablePath, validPath, workspacePath } from "./policy.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const zipTailBytes = 4 * 1024 * 1024;
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of bytes) value = (value >>> 8) ^ crcTable[(value ^ byte) & 255];
  return (value ^ 0xffffffff) >>> 0;
}

function joinBytes(chunks: Uint8Array[], size: number): Uint8Array {
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

function archivePath(name: string): string | null {
  if (name.endsWith("/")) {
    if (!validPath(name.slice(0, -1))) throw new Error("Répertoire ZIP invalide.");
    return null;
  }
  if (!validPath(name)) throw new Error("Chemin ZIP invalide.");
  const slash = name.indexOf("/");
  if (slash < 1) throw new Error("L'archive n'a pas de répertoire racine GitHub.");
  const path = name.slice(slash + 1);
  if (!validPath(path)) throw new Error("Chemin ZIP hors du workspace.");
  return path;
}

export function validateZipTail(tail: Uint8Array, totalSize: number, files: Map<string, Uint8Array>): void {
  const view = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  let end = tail.length - 22;
  while (end >= Math.max(0, tail.length - 65557)) {
    if (view.getUint32(end, true) === 0x06054b50 && end + 22 + view.getUint16(end + 20, true) === tail.length) break;
    end--;
  }
  if (end < 0 || view.getUint32(end, true) !== 0x06054b50) throw new Error("Archive ZIP incomplète.");
  if (view.getUint16(end + 4, true) !== 0 || view.getUint16(end + 6, true) !== 0) throw new Error("Archives ZIP multi-disques non supportées.");
  const entries = view.getUint16(end + 10, true);
  const directorySize = view.getUint32(end + 12, true);
  let offset = view.getUint32(end + 16, true) - (totalSize - tail.length);
  if (entries === 65535 || offset < 0 || directorySize > zipTailBytes || offset + directorySize !== end) {
    throw new Error("Archive ZIP trop complexe ou ZIP64 non supporté.");
  }
  const seen = new Set<string>();
  for (let index = 0; index < entries; index++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) throw new Error("Index ZIP invalide.");
    const nameSize = view.getUint16(offset + 28, true);
    const extraSize = view.getUint16(offset + 30, true);
    const commentSize = view.getUint16(offset + 32, true);
    const next = offset + 46 + nameSize + extraSize + commentSize;
    if (next > end) throw new Error("Entrée ZIP tronquée.");
    const kind = (view.getUint32(offset + 38, true) >>> 16) & 0xf000;
    if (kind !== 0 && kind !== 0x8000 && kind !== 0x4000) throw new Error("Liens symboliques et fichiers spéciaux interdits dans le workspace.");
    const name = decoder.decode(tail.subarray(offset + 46, offset + 46 + nameSize));
    const path = archivePath(name);
    if (path !== null && workspacePath(path)) {
      if (seen.has(path)) throw new Error("Fichier dupliqué dans le ZIP.");
      seen.add(path);
      const bytes = files.get(path);
      if (!bytes || bytes.length !== view.getUint32(offset + 24, true) || crc32(bytes) !== view.getUint32(offset + 16, true)) {
        throw new Error(`Intégrité de l'archive invalide : ${path}.`);
      }
    }
    offset = next;
  }
  if (offset !== end || seen.size !== files.size) throw new Error("Le ZIP ne correspond pas aux fichiers extraits.");
}

export async function readArchive(response: Response, signal: AbortSignal, progress: (message: string) => void): Promise<Map<string, Uint8Array>> {
  if (!response.body) throw new Error("Archive sans contenu.");
  const files = new Map<string, Uint8Array>();
  let totalDecoded = 0;
  let totalReceived = 0;
  let root = "";
  let count = 0;
  let tail = new Uint8Array(0);
  const unzip = new Unzip((file) => {
    const path = archivePath(file.name);
    const entryRoot = file.name.split("/")[0];
    if (root && root !== entryRoot) throw new Error("L'archive mélange plusieurs dépôts.");
    root = entryRoot;
    if (++count > maxWorkspaceFiles * 2) throw new Error("Trop de fichiers dans le dépôt.");
    if (path === null || !workspacePath(path)) return;
    if (files.has(path) || file.originalSize !== undefined && file.originalSize > maxFileBytes) {
      throw new Error(`Fichier dupliqué ou trop volumineux : ${path}.`);
    }
    const chunks: Uint8Array[] = [];
    let size = 0;
    file.ondata = (error, chunk, final) => {
      if (error) throw error;
      signal.throwIfAborted();
      size += chunk.length;
      totalDecoded += chunk.length;
      if (size > maxFileBytes || totalDecoded > maxWorkspaceBytes) throw new Error("Le dépôt dépasse les limites de mémoire de l'éditeur.");
      chunks.push(chunk);
      if (final) {
        const content = joinBytes(chunks, size);
        if (encoder.encode("version https://git-lfs.github.com/spec/v1").every((byte, index) => content[index] === byte)) {
          throw new Error(`Git LFS n'est pas supporté : ${path}.`);
        }
        files.set(path, content);
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  const reader = response.body.getReader();
  try {
    while (true) {
      signal.throwIfAborted();
      const result = await reader.read();
      if (result.done) break;
      totalReceived += result.value.length;
      if (totalReceived > maxWorkspaceBytes) throw new Error("Archive trop volumineuse.");
      const combined = joinBytes([tail, result.value], tail.length + result.value.length);
      tail = combined.slice(Math.max(0, combined.length - zipTailBytes));
      unzip.push(result.value);
      progress(`Dépôt : ${(totalReceived / 1048576).toFixed(1)} Mo reçus, ${files.size} fichiers.`);
    }
    unzip.push(new Uint8Array(), true);
    validateZipTail(tail, totalReceived, files);
    if (!files.has("package.json") || !files.has("package-lock.json") || !files.has("src/pages/index.astro")) {
      throw new Error("Le dépôt reçu n'est pas un projet Astro complet.");
    }
    return files;
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}

function bytesEqual(a: Uint8Array | undefined, b: Uint8Array | undefined): boolean {
  return a === b || a !== undefined && b !== undefined && a.length === b.length && a.every((byte, index) => byte === b[index]);
}

export function applyChanges(files: Map<string, Uint8Array>, changes: FileChange[], editableOnly = false): Map<string, Uint8Array> {
  const next = new Map(files);
  for (const change of changes) {
    if (!(editableOnly ? editablePath(change.path) : workspacePath(change.path))) throw new Error(`Fichier interdit : ${change.path}.`);
    if (change.content === null) next.delete(change.path);
    else {
      const bytes = decodeFile({ content: change.content, encoding: change.encoding });
      if (bytes.length > maxFileBytes) throw new Error(`Fichier trop volumineux : ${change.path}.`);
      next.set(change.path, bytes);
    }
  }
  return next;
}

function difference(before: Map<string, Uint8Array>, after: Map<string, Uint8Array>): FileChange[] {
  const result: FileChange[] = [];
  for (const path of new Set([...before.keys(), ...after.keys()])) {
    if (bytesEqual(before.get(path), after.get(path))) continue;
    if (!editablePath(path)) throw new Error(`Modification hors périmètre : ${path}.`);
    const bytes = after.get(path);
    result.push(bytes ? { path, ...encodeFile(bytes) } : { path, content: null, encoding: "utf8" });
  }
  return result;
}

export class LocalWorkspace {
  files: Map<string, Uint8Array>;
  sha: string;
  messages: ChatMessage[] = [];
  history: FileChange[][] = [];
  private baseline: Map<string, Uint8Array>;

  constructor(sha: string, files: Map<string, Uint8Array>) {
    if (!isSha(sha)) throw new Error("SHA de workspace invalide.");
    this.sha = sha;
    this.files = new Map(files);
    this.baseline = new Map(files);
  }
  get dirty() { return this.changes().length > 0; }
  changes() { return difference(this.baseline, this.files); }
  checkpoint() { return new Map(this.files); }
  finish(checkpoint: Map<string, Uint8Array>) {
    const inverse = difference(this.files, checkpoint);
    if (inverse.length) this.history.push(inverse);
  }
  restore(checkpoint: Map<string, Uint8Array>): FileChange[] {
    const changes = difference(this.files, checkpoint);
    this.files = new Map(checkpoint);
    return changes;
  }
  undo(): FileChange[] {
    const inverse = this.history.pop();
    if (!inverse) throw new Error("Aucune modification à annuler.");
    this.files = applyChanges(this.files, inverse, true);
    return inverse;
  }
  markSaved(sha: string) {
    if (!isSha(sha)) throw new Error("SHA de sauvegarde invalide.");
    this.sha = sha;
    this.baseline = new Map(this.files);
  }
  text(path: string): string {
    if (!readablePath(path)) throw new Error("Ce fichier n'est pas accessible à l'assistant.");
    const bytes = this.files.get(path);
    if (!bytes) throw new Error(`Fichier introuvable : ${path}.`);
    return decoder.decode(bytes);
  }
  async writeText(path: string, content: string | null, expectedHash: string | null): Promise<void> {
    if (!editablePath(path) || !/\.(md|json|astro|css|ts)$/.test(path)) throw new Error(`Fichier texte non modifiable : ${path}.`);
    const previous = this.files.get(path);
    const actualHash = previous ? await fileHash(previous) : null;
    if (actualHash !== expectedHash) throw new Error("Le fichier a changé depuis sa lecture. Relisez-le avant de modifier.");
    if (content === null) this.files.delete(path);
    else {
      const bytes = encoder.encode(content);
      if (bytes.length > maxFileBytes) throw new Error("Modification trop volumineuse.");
      this.files.set(path, bytes);
    }
  }
  index(query = ""): string[] {
    const terms = query.toLocaleLowerCase("fr").split(/\s+/).filter(Boolean);
    return [...this.files.keys()].filter((path) => readablePath(path) || editablePath(path)).filter((path) => {
      if (!terms.length) return true;
      const sample = `${path} ${readablePath(path) ? this.text(path).slice(0, 350) : ""}`.toLocaleLowerCase("fr");
      return terms.every((term) => sample.includes(term));
    }).slice(0, 60);
  }
}

interface StoredDraft {
  sha: string;
  changes: FileChange[];
  messages: ChatMessage[];
  history: FileChange[][];
}

function parseChanges(value: unknown): FileChange[] {
  if (!Array.isArray(value) || value.length > 300) throw new Error("Brouillon local invalide.");
  return value.map((change: unknown) => {
    if (!isRecord(change) || typeof change.path !== "string" || !editablePath(change.path)
      || (change.content !== null && typeof change.content !== "string")
      || (change.encoding !== "utf8" && change.encoding !== "base64")) throw new Error("Fichier de brouillon invalide.");
    return { path: change.path, content: change.content, encoding: change.encoding };
  });
}

export class DraftConflictError extends Error {}

export class BrowserStorage {
  private login: string;
  constructor(login: string) {
    if (!/^[a-zA-Z0-9-]{1,39}$/.test(login)) throw new Error("Identité de stockage invalide.");
    this.login = login;
  }
  private async root() {
    if (!navigator.storage?.getDirectory) throw new Error("Le stockage local OPFS n'est pas disponible. Utilisez Chrome ou Edge sur ordinateur.");
    const directory = await navigator.storage.getDirectory();
    return directory.getDirectoryHandle(`fdc85-editor-${this.login}`, { create: true });
  }
  private async file(root: FileSystemDirectoryHandle, path: string, create: boolean) {
    if (!validPath(path)) throw new Error("Chemin de stockage invalide.");
    const parts = path.split("/");
    const name = parts.pop();
    if (!name) throw new Error("Nom de fichier absent.");
    let directory = root;
    for (const part of parts) directory = await directory.getDirectoryHandle(part, { create });
    return directory.getFileHandle(name, { create });
  }
  async cached(sha: string): Promise<Map<string, Uint8Array> | null> {
    if (!isSha(sha)) throw new Error("SHA de cache invalide.");
    const root = await this.root();
    let directory: FileSystemDirectoryHandle;
    let manifestFile: File;
    try {
      directory = await root.getDirectoryHandle(sha);
      manifestFile = await (await directory.getFileHandle("manifest.json")).getFile();
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotFoundError") return null;
      throw error;
    }
    const manifest: unknown = JSON.parse(await manifestFile.text());
    if (!isRecord(manifest) || manifest.sha !== sha || manifest.version !== 1 || !Array.isArray(manifest.files)
      || manifest.files.length > maxWorkspaceFiles) throw new Error("Cache local invalide. Effacez le cache du site avant de réessayer.");
    const files = new Map<string, Uint8Array>();
    for (const item of manifest.files) {
      if (typeof item !== "string" || !workspacePath(item) || files.has(item)) throw new Error("Chemin de cache invalide.");
      const file = await (await this.file(directory, `files/${item}`, false)).getFile();
      files.set(item, new Uint8Array(await file.arrayBuffer()));
    }
    return files;
  }
  async cache(sha: string, files: Map<string, Uint8Array>, signal: AbortSignal): Promise<void> {
    if (!isSha(sha)) throw new Error("SHA de cache invalide.");
    const directory = await (await this.root()).getDirectoryHandle(sha, { create: true });
    for (const [path, bytes] of files) {
      signal.throwIfAborted();
      const file = await this.file(directory, `files/${path}`, true);
      const writable = await file.createWritable();
      try { await writable.write(new Uint8Array(bytes).buffer); await writable.close(); }
      catch (error) { await writable.abort(); throw error; }
    }
    signal.throwIfAborted();
    const manifest = await (await directory.getFileHandle("manifest.json", { create: true })).createWritable();
    try { await manifest.write(JSON.stringify({ version: 1, sha, files: [...files.keys()] })); await manifest.close(); }
    catch (error) { await manifest.abort(); throw error; }
  }
  private async database(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("fdc85-editor-drafts", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("drafts");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Impossible d'ouvrir les brouillons locaux."));
      request.onblocked = () => reject(new Error("Fermez les autres onglets de l'éditeur pour initialiser le stockage."));
    });
  }
  private async draftRecord(ref: string, record?: StoredDraft): Promise<unknown> {
    const db = await this.database();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction("drafts", record ? "readwrite" : "readonly");
        const store = tx.objectStore("drafts");
        const key = `${this.login}:${ref}`;
        const request = record ? store.put(record, key) : store.get(key);
        let result: unknown;
        request.onsuccess = () => { result = request.result; };
        tx.oncomplete = () => resolve(result);
        tx.onabort = tx.onerror = () => reject(tx.error ?? new Error("Le stockage local a échoué. Gardez cet onglet ouvert et sauvegardez sur GitHub."));
      });
    } finally { db.close(); }
  }
  async saveDraft(ref: string, workspace: LocalWorkspace): Promise<void> {
    await this.draftRecord(ref, { sha: workspace.sha, changes: workspace.changes(), messages: workspace.messages, history: workspace.history });
  }
  async restoreDraft(ref: string, workspace: LocalWorkspace): Promise<void> {
    const record = await this.draftRecord(ref);
    if (record === undefined) return;
    if (!isRecord(record) || !isSha(record.sha) || !Array.isArray(record.messages) || !Array.isArray(record.history)) {
      throw new Error("Brouillon local invalide.");
    }
    const changes = parseChanges(record.changes);
    if (record.sha !== workspace.sha && changes.length) {
      throw new DraftConflictError("Un brouillon local correspond à une ancienne version de cette PR. Il est conservé : revenez à sa version ou sauvegardez-le séparément avant de reprendre.");
    }
    if (record.sha === workspace.sha) {
      workspace.files = applyChanges(workspace.files, changes, true);
      workspace.history = record.history.map(parseChanges);
    }
    workspace.messages = record.messages.map((message: unknown) => {
      if (!isRecord(message) || (message.role !== "user" && message.role !== "assistant") || typeof message.text !== "string") throw new Error("Conversation locale invalide.");
      return { role: message.role, text: message.text };
    });
  }
}
