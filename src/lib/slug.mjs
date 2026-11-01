/** @param {string} id */
export function normalizeSlug(id) {
  return id
    .replace(/\\/g, "/")
    .replace(/\.(md|mdx)$/i, "")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
}
