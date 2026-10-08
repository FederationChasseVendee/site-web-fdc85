export const repositoryName = "FederationChasseVendee/site-web-fdc85";
export const baseBranch = "main";
export const pullPrefix = "[Editor]";
export const maxFileBytes = 16 * 1024 * 1024;
export const maxWorkspaceBytes = 256 * 1024 * 1024;
export const maxWorkspaceFiles = 4000;

export function validPath(path: string): boolean {
  return path.length > 0 && path.length <= 500 && !/[\x00-\x1f\\]/.test(path)
    && !path.startsWith("/") && !path.includes(":")
    && path.split("/").every((part) => part.length > 0 && part !== "." && part !== "..");
}

export function editablePath(path: string): boolean {
  if (!validPath(path) || path.split("/").some((part) => part.startsWith("."))) return false;
  if (path === "src/pages/edit.astro" || path === "src/pages/admin.astro") return false;
  if (/^src\/(content|components|templates|styles|layouts|pages)\//.test(path)) {
    return /\.(md|json|astro|css|ts)$/.test(path);
  }
  return /^public\/assets\//.test(path) && /\.(png|jpe?g|webp|avif|svg|gif|pdf|woff2?)$/i.test(path);
}

export function readablePath(path: string): boolean {
  return editablePath(path) && /\.(md|json|astro|css|ts|svg)$/.test(path)
    || ["src/content.config.ts", "src/lib/urls.ts", "src/lib/content.ts"].includes(path);
}

export function workspacePath(path: string): boolean {
  return validPath(path) && !path.split("/").some((part) =>
    [".git", ".env", ".npmrc", ".yarnrc", "node_modules", "dist", ".astro"].includes(part)
    || part.startsWith(".env."));
}

export function isSha(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
}

export function requestTitle(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 100
    || /[\x00-\x1f]/.test(value)) throw new Error("Donnez un nom de 1 à 100 caractères à la modification.");
  return value.trim();
}

export function decodeFile(change: { content: string; encoding: "utf8" | "base64" }): Uint8Array {
  if (change.encoding === "utf8") return new TextEncoder().encode(change.content);
  return Uint8Array.from(atob(change.content), (character) => character.charCodeAt(0));
}

export function encodeFile(bytes: Uint8Array): { content: string; encoding: "utf8" | "base64" } {
  try {
    return { content: new TextDecoder("utf-8", { fatal: true }).decode(bytes), encoding: "utf8" };
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    let binary = "";
    for (let start = 0; start < bytes.length; start += 8192) {
      binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
    }
    return { content: btoa(binary), encoding: "base64" };
  }
}

export async function fileHash(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
