import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const host = "127.0.0.1";
const port = Number.parseInt(process.env.PORT ?? "4174", 10);
const base = "/site-web/poc-silex/";
const root = resolve(import.meta.dirname, "..", "export");
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
]);

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);
  if (url.pathname === "/") {
    response.writeHead(302, { Location: base });
    response.end();
    return;
  }
  if (!url.pathname.startsWith(base)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  const requested = decodeURIComponent(url.pathname.slice(base.length)) || "index.html";
  const candidate = normalize(join(root, requested));
  if (!candidate.startsWith(`${root}${sep}`) && candidate !== root) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  const file = existsSync(candidate) && statSync(candidate).isDirectory()
    ? join(candidate, "index.html")
    : candidate;
  if (!existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": contentTypes.get(extname(file)) ?? "application/octet-stream",
    "Cache-Control": "no-store",
  });
  createReadStream(file).pipe(response);
});

server.listen(port, host, () => {
  console.log(`POC Silex disponible sur http://${host}:${port}${base}`);
});
