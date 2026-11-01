import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";

test("protected API responses cannot be cached and apply browser security headers", async () => {
  const server = createApp().listen(0);
  await new Promise(resolve => server.once("listening", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  try {
    for (const path of ["/api/session", "/api/checkout/config"]) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200, path);
      assert.match(response.headers.get("cache-control") || "", /(?:^|[, ]+)no-store(?:$|[, ]+)/, path);
      assert.equal(response.headers.get("x-content-type-options"), "nosniff", path);
      assert.equal(response.headers.get("x-frame-options"), "DENY", path);
      assert.match(response.headers.get("content-security-policy") || "", /frame-ancestors 'none'/, path);
    }
    const health = await fetch(base + "/api/health");
    assert.equal(health.status, 200);
    assert.equal(health.headers.get("x-frame-options"), "DENY");
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
