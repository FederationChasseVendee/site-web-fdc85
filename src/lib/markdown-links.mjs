import { resolvePublicUrl } from "./routes.mjs";

/** @typedef {{type?: string, url?: string, children?: MarkdownNode[]}} MarkdownNode */

/** @param {{base: string}} options */
export function remarkLocalLinks({ base }) {
  const normalizedBase = `/${base.replace(/^\/+|\/+$/g, "")}/`.replace(/\/{2,}/g, "/");
  /** @param {MarkdownNode} node */
  function visit(node) {
    if (node.url?.startsWith("/") && !node.url.startsWith("//")) {
      node.url = resolvePublicUrl(node.url, normalizedBase);
    }
    node.children?.forEach(visit);
  }
  return visit;
}
