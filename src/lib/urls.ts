export { resolvePublicUrl as resolveUrl } from "./routes.mjs";

const externalPattern = /^https?:\/\//;

export function isExternalUrl(url: string): boolean {
  return externalPattern.test(url);
}
