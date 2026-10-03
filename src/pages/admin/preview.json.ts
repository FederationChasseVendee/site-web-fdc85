import type { APIRoute } from "astro";
import { getPreviewManifest } from "../../lib/preview-manifest";

export const GET: APIRoute = async () => new Response(
  JSON.stringify(await getPreviewManifest(import.meta.env.BASE_URL)),
  { headers: { "Content-Type": "application/json; charset=utf-8" } },
);
