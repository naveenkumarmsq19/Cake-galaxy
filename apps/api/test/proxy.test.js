import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../../../functions/api/[[path]].js";

test("Pages API proxy keeps the request and session cookie on the storefront origin", async () => {
  const original = globalThis.fetch;
  let upstream;
  globalThis.fetch = async (request) => {
    upstream = request;
    return new Response(JSON.stringify({ authenticated: true }), { headers: { "Content-Type": "application/json", "Set-Cookie": "cg_session=token; HttpOnly; Secure; SameSite=Lax; Path=/" } });
  };
  try {
    const response = await onRequest({ request: new Request("https://cake-galaxy-web.pages.dev/api/auth/verify?source=checkout", { method: "POST", headers: { Cookie: "cg_session=old", Origin: "https://cake-galaxy-web.pages.dev" }, body: "{}" }) });
    assert.equal(upstream.url, "https://cake-galaxy.onrender.com/api/auth/verify?source=checkout");
    assert.equal(upstream.method, "POST");
    assert.equal(upstream.headers.get("cookie"), "cg_session=old");
    assert.equal(upstream.headers.get("origin"), "https://cake-galaxy-web.pages.dev");
    assert.match(response.headers.get("set-cookie"), /cg_session=token/);
  } finally { globalThis.fetch = original; }
});
