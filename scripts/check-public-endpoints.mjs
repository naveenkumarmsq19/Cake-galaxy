// Safe, sequential GET-only availability/header/latency smoke check.
import { performance } from "node:perf_hooks";
const root = process.argv[2];
if (!root || !/^https:\/\/[a-z0-9.-]+(?::443)?\/?$/i.test(root)) {
  console.error("Usage: node scripts/check-public-endpoints.mjs https://cakegalaxy.in");
  process.exit(2);
}
const base = root.replace(/\/$/, "");
for (const path of ["/", "/api/health", "/api/catalog", "/api/session"]) {
  const started = performance.now();
  try {
    const response = await fetch(base + path, { redirect: "manual", signal: AbortSignal.timeout(15000) });
    const elapsed = Math.round(performance.now() - started);
    console.log(JSON.stringify({
      path, status: response.status, firstResponseMs: elapsed,
      cacheControl: response.headers.get("cache-control"),
      contentType: response.headers.get("content-type"),
      frameOptions: response.headers.get("x-frame-options")
    }));
  } catch (error) {
    console.error(JSON.stringify({ path, error: error.message }));
  }
}
