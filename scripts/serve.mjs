import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
const port = Number(process.env.PORT || 3000);
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml" };

const server = http.createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (req.method !== "GET" && req.method !== "HEAD" && !req.url.startsWith("/api/")) {
    res.writeHead(405).end();
    return;
  }
  if (req.url.startsWith("/api/")) {
    res.writeHead(503, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ message: "Online ordering is not activated yet. No payment has been taken." }));
    return;
  }
  try {
    const url = new URL(req.url, "http://localhost");
    const pathname = decodeURIComponent(url.pathname);
    const requested = resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
    if (requested !== root && !requested.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    const content = await readFile(requested);
    res.writeHead(200, { "Content-Type": types[extname(requested)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(req.method === "HEAD" ? undefined : content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log("Cake Galaxy running at http://localhost:" + port);
});
