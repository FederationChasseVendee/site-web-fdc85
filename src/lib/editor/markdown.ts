import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkSmartypants from "remark-smartypants";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import type { Root, Element } from "hast";
import { resolveUrl } from "../urls";

export function safeUrl(value: string, base: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed || /[\u0000-\u001f\u007f]/.test(trimmed) || trimmed.includes("\\")) return undefined;
  if (trimmed === "about:blank") return trimmed;
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed) || trimmed.startsWith("//")) return undefined;
  if (trimmed.startsWith("#")) return trimmed;
  const normalizedBase = `/${base.replace(/^\/+|\/+$/g, "")}/`.replace(/\/{2,}/g, "/");
  if (trimmed.startsWith(normalizedBase) && normalizedBase !== "/") return trimmed;
  const internal = trimmed.replace(/^\/site-web(?:\/|$)/, "/");
  return resolveUrl(internal, normalizedBase);
}

function urls(base: string) {
  return () => (tree: Root) => {
    function visit(node: Root | Element) {
      for (const child of node.children) {
        if (child.type !== "element") continue;
        if (child.tagName === "a" || child.tagName === "img") {
          const property = child.tagName === "a" ? "href" : "src";
          const value = child.properties[property];
          if (typeof value === "string") {
            const resolved = safeUrl(value, base);
            if (resolved) child.properties[property] = resolved;
            else delete child.properties[property];
          }
        }
        visit(child);
      }
    }
    visit(tree);
  };
}

export function renderMarkdown(body: string, base: string): string {
  return String(unified()
    .use(remarkParse).use(remarkGfm).use(remarkSmartypants)
    .use(remarkRehype, { allowDangerousHtml: true }).use(rehypeRaw)
    .use(rehypeSanitize, {
      ...defaultSchema,
      protocols: { ...defaultSchema.protocols, href: ["http", "https", "mailto", "tel", "about"] },
      attributes: {
        ...defaultSchema.attributes,
        img: [...(defaultSchema.attributes?.img ?? []), "loading", "decoding", "width", "height"],
      },
    })
    .use(rehypeSlug).use(urls(base)).use(rehypeStringify).processSync(body));
}
