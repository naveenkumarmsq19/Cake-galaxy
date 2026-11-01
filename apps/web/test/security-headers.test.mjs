import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Cloudflare Pages publishes framing, HSTS and private-safe asset cache rules", () => {
  const rules = readFileSync(new URL("../public/_headers", import.meta.url), "utf8");
  for (const policy of [
    "X-Frame-Options: DENY",
    "Content-Security-Policy: frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
    "Strict-Transport-Security: max-age=15552000",
    "/_next/static/*",
    "Cache-Control: public, max-age=31536000, immutable"
  ]) assert.ok(rules.includes(policy), policy);
});
