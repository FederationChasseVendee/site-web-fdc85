import type { APIRoute } from "astro";
import { getCatalog } from "../../lib/editor/catalog.server";

export const GET: APIRoute = () => new Response(JSON.stringify(getCatalog()), {
  headers: { "Content-Type": "application/json; charset=utf-8" },
});
