import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { Branch, Customer, LoginChallenge, Order, Product, ServiceArea, Session } from "../src/models.js";

async function withServer(run) {
  const server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  try { await run("http://127.0.0.1:" + server.address().port); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

function setTestEnv() {
  const keys = ["NODE_ENV", "TEST_MODE_ENABLED", "TEST_PHONE", "TEST_OTP_CODE", "GST_RATE_PERCENT", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"];
  const old = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, { NODE_ENV: "production", TEST_MODE_ENABLED: "true", TEST_PHONE: "9876543210", TEST_OTP_CODE: "438619", GST_RATE_PERCENT: "0" });
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
  return () => { for (const key of keys) if (old[key] === undefined) delete process.env[key]; else process.env[key] = old[key]; };
}

test("test code works only for the configured phone, and is disabled immediately with test mode", async () => {
  const restoreEnv = setTestEnv();
  const originals = { count: LoginChallenge.countDocuments, find: LoginChallenge.findOne, create: LoginChallenge.create, update: LoginChallenge.findOneAndUpdate, delete: LoginChallenge.deleteOne, customer: Customer.updateOne, session: Session.create };
  const challenges = new Map();
  LoginChallenge.countDocuments = async () => 0;
  LoginChallenge.findOne = async () => null;
  LoginChallenge.create = async (value) => { challenges.set(value.requestId, { ...value, _id: value.requestId, attempts: 0 }); return value; };
  LoginChallenge.findOneAndUpdate = async ({ requestId }) => { const challenge = challenges.get(requestId); if (!challenge || challenge.attempts++ >= 5) return null; return challenge; };
  LoginChallenge.deleteOne = async ({ _id }) => ({ deletedCount: Number(challenges.delete(_id)) });
  Customer.updateOne = async () => ({});
  Session.create = async () => ({});
  try {
    await withServer(async (base) => {
      const headers = { "Content-Type": "application/json" };
      const send = async (phone) => fetch(base + "/api/auth/otp", { method: "POST", headers, body: JSON.stringify({ phone }) });
      const first = await send("9876543210");
      assert.equal(first.status, 201);
      const { requestId, testMode, ...payload } = await first.json();
      assert.equal(testMode, true);
      assert.equal(JSON.stringify(payload).includes("438619"), false);
      assert.equal((await fetch(base + "/api/auth/verify", { method: "POST", headers, body: JSON.stringify({ requestId, otp: "111111" }) })).status, 400);
      const valid = await fetch(base + "/api/auth/verify", { method: "POST", headers, body: JSON.stringify({ requestId, otp: "438619" }) });
      assert.equal(valid.status, 200);
      assert.match(valid.headers.get("set-cookie"), /cg_session=/);
      const next = await send("9876543210");
      const nextId = (await next.json()).requestId;
      process.env.TEST_MODE_ENABLED = "false";
      assert.equal((await fetch(base + "/api/auth/verify", { method: "POST", headers, body: JSON.stringify({ requestId: nextId, otp: "438619" }) })).status, 400);
    });
  } finally {
    Object.assign(LoginChallenge, { countDocuments: originals.count, findOne: originals.find, create: originals.create, findOneAndUpdate: originals.update, deleteOne: originals.delete });
    Customer.updateOne = originals.customer; Session.create = originals.session; restoreEnv();
  }
});

test("test COD bypasses Razorpay, keeps branch assignment, and cannot be used by another phone", async () => {
  const restoreEnv = setTestEnv();
  const branchId = new mongoose.Types.ObjectId();
  const original = { session: Session.findOne, order: Order.findOne, create: Order.create, area: ServiceArea.findOne, branch: Branch.findOne, products: Product.find, fetch: globalThis.fetch };
  const saved = [];
  let sessionPhone = "9876543210";
  Session.findOne = () => ({ lean: async () => ({ phone: sessionPhone, csrfToken: "csrf-test" }) });
  Order.findOne = async ({ idempotencyKey }) => saved.find((order) => order.idempotencyKey === idempotencyKey) || null;
  Order.create = async (data) => { saved.push(data); return data; };
  ServiceArea.findOne = () => ({ lean: async () => ({ branchId, deliveryFee: 4900 }) });
  Branch.findOne = () => ({ lean: async () => ({ _id: branchId, active: true }) });
  Product.find = () => ({ lean: async () => [{ id: "chocolate-truffle", name: "Chocolate Truffle", price: 74900, weights: [0.5], flavour: "Chocolate", unit: "kg", active: true, eggless: false, photo: false }] });
  globalThis.fetch = async (url, options) => {
    if (String(url).includes("api.razorpay.com")) throw new Error("Test COD must never contact Razorpay");
    return original.fetch(url, options);
  };
  try {
    await withServer(async (base) => {
      const headers = { Cookie: "cg_session=" + "c".repeat(64), "X-CSRF-Token": "csrf-test", "Content-Type": "application/json" };
      const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      const body = { idempotencyKey: randomUUID(), preferredMethod: "test_cod", items: [{ productId: "chocolate-truffle", size: 0.5, quantity: 1, flavour: "Chocolate", eggless: false }], sender: { name: "Tester", phone: "9876543210" }, address: { name: "Friend", phone: "9123456789", line1: "1 Main Road", city: "Bengaluru", pincode: "560073", whatsapp: true }, delivery: { date, slot: "10 AM – 1 PM" } };
      const config = await (await original.fetch(base + "/api/checkout/config", { headers })).json();
      assert.equal(config.testCodEnabled, true);
      assert.equal(config.paymentsEnabled, false);
      const submit = () => original.fetch(base + "/api/checkout/orders", { method: "POST", headers, body: JSON.stringify(body) });
      const first = await submit();
      assert.equal(first.status, 201);
      const result = await first.json();
      assert.equal(result.order.paymentStatus, "test_cod");
      assert.equal(result.order.testOrder, true);
      assert.equal(result.amount, 79800);
      assert.equal(String(saved[0].branchId), String(branchId));
      assert.equal(saved[0].address.phone, "9123456789");
      assert.equal(saved[0].whatsappConsent, false);
      assert.equal(saved[0].notificationStatus, "skipped");
      assert.equal((await submit()).status, 200);
      assert.equal(saved.length, 1);
      sessionPhone = "9123456789";
      assert.equal((await submit()).status, 503);
      assert.equal((await (await original.fetch(base + "/api/checkout/config", { headers })).json()).testCodEnabled, false);
    });
  } finally {
    Session.findOne = original.session; Order.findOne = original.order; Order.create = original.create;
    ServiceArea.findOne = original.area; Branch.findOne = original.branch; Product.find = original.products;
    globalThis.fetch = original.fetch; restoreEnv();
  }
});
