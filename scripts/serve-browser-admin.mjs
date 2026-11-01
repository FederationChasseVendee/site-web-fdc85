import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";

const root = resolve("dist");
const rules = (await readFile(resolve(root, "_headers"), "utf8")).trim().split(/\n\s*\n/).map((block) => {
  const [path, ...headers] = block.split("\n");
  return { path, headers: headers.map((header) => {
    const colon = header.indexOf(":");
    return [header.slice(0, colon).trim(), header.slice(colon + 1).trim()];
  }) };
});
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".svg": "image/svg+xml", ".webp": "image/webp", ".pdf": "application/pdf" };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    let path = resolve(root, `.${pathname}`);
    if (path !== root && !path.startsWith(`${root}${sep}`)) { response.writeHead(403).end(); return; }
    if ((await stat(path)).isDirectory()) path = resolve(path, "index.html");
    for (const rule of rules) {
      if (rule.path === pathname || (rule.path.endsWith("*") && pathname.startsWith(rule.path.slice(0, -1)))) {
        for (const [name, value] of rule.headers) response.setHeader(name, value);
      }
    }
    response.setHeader("Content-Type", types[extname(path)] ?? "application/octet-stream");
    response.end(await readFile(path));
  } catch (error) {
    if (error.code === "ENOENT") response.writeHead(404).end("Not found");
    else {
      console.error("Static test server:", error);
      response.writeHead(500).end("Static test server error");
    }
  }
});
server.listen(4358, "127.0.0.1", () => console.log("Built experiment: http://127.0.0.1:4358/admin/"));
