import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";

// Safe isolated local HTTP tests only. Never target production or need a real database.
async function localServer(fn) {
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise(resolve=>server.once("listening", resolve));
  try { await fn("http://127.0.0.1:" + server.address().port); }
  finally { await new Promise(resolve=>server.close(resolve)); }
}

test("unauthenticated customer and admin data endpoints reject requests", async () => {
  await localServer(async base => {
    for (const path of ["/api/orders","/api/orders/CGDEMO","/api/admin/orders","/api/admin/summary","/api/admin/products"]) {
      const res=await fetch(base+path);
      assert.equal(res.status,401,`Unexpected anonymous access: ${path}`);
    }
  });
});

test("anonymous order, image upload, custom order and admin writes cannot execute", async () => {
  await localServer(async base => {
    for (const path of ["/api/checkout/orders","/api/uploads","/api/custom-requests","/api/admin/products"]) {
      const res=await fetch(base+path,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({items:[],preferredMethod:"cod",idempotencyKey:"00000000-0000-4000-8000-000000000000"})
      });
      assert.equal(res.status,401,`Unexpected anonymous write: ${path}`);
    }
  });
});

test("unsafe unknown-origin requests are blocked without forwarding to business logic", async () => {
  await localServer(async base => {
    const res=await fetch(base+"/api/admin/login",{
      method:"POST",
      headers:{"Origin":"https://untrusted.example","Content-Type":"application/json"},
      body:JSON.stringify({email:"fake@example.com",password:"fake"})
    });
    assert.equal(res.status,403);
    assert.equal(res.headers.get("access-control-allow-origin"),null);
  });
});

test("unauthenticated webhook cannot acknowledge an unsigned fake payment", async () => {
  await localServer(async base => {
    const res=await fetch(base+"/api/webhooks/razorpay",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({event:"payment.captured"})
    });
    assert.equal(res.status,401);
  });
});

test("public responses include basic hardening headers",async()=>{
  await localServer(async base=>{
    const res=await fetch(base+"/api/health");
    assert.equal(res.status,200);
    assert.equal(res.headers.get("x-content-type-options"),"nosniff");
    assert.equal(res.headers.get("referrer-policy"),"strict-origin-when-cross-origin");
    assert.equal(res.headers.get("x-powered-by"),null);
  });
});

test("oversized JSON bodies are blocked before reaching application handlers",async()=>{
  await localServer(async base=>{
    const res=await fetch(base+"/api/admin/login",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({email:"fake@example.com",password:"x".repeat(70*1024)})
    });
    assert.equal(res.status,413);
  });
});
