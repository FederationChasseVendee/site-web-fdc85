import { h } from "preact";
import renderToString from "preact-render-to-string";
import SiteContent from "../../components/rendering/SiteContent";
import type { RenderContext, RenderEntry } from "./model";

export function previewTarget(entry: RenderEntry, context: RenderContext, slug?: string): RenderEntry | undefined {
  if (!["documents", "faqs", "glossary", "directories"].includes(entry.collection)) return entry;
  return context.entries.find((candidate) =>
    candidate.collection === "indexes" && candidate.data.source === entry.collection && (!slug || candidate.slug === slug));
}

export function previewMarkup(entry: RenderEntry, context: RenderContext): string {
  return renderToString(h(SiteContent, { entry, context }));
}

export function updatePreview(document: Document, markup: string): void {
  const main = document.getElementById("contenu");
  if (!main) throw new Error("Cadre invalide : la zone principale du site est absente.");
  main.innerHTML = markup;
  document.querySelectorAll("script").forEach((script) => script.remove());
  document.querySelectorAll("a").forEach((link) => {
    link.dataset.previewHref = link.getAttribute("href") ?? "";
    link.removeAttribute("href");
    link.setAttribute("aria-disabled", "true");
    link.tabIndex = -1;
  });
  document.querySelectorAll("img").forEach((image) => image.setAttribute("referrerpolicy", "no-referrer"));
}
