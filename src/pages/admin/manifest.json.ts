import type { APIRoute } from "astro";
import { getAdminManifest } from "../../lib/admin-manifest";

export const GET: APIRoute = async () => new Response(JSON.stringify(await getAdminManifest()), {
  headers: { "Content-Type": "application/json; charset=utf-8" },
});
