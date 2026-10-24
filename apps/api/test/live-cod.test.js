import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { AdminSession, AdminUser, Branch, Order, Product, ServiceArea, Session } from "../src/models.js";

async function withServer(run) {
  const server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  try { await run("http://127.0.0.1:" + server.address().port); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test("live COD creates one unpaid order, skips Razorpay, and requires cash on delivery", async () => {
  const envKeys = [
    "NODE_ENV", "COD_ENABLED", "MERCHANT_GST_REGISTERED", "MERCHANT_GSTIN",
    "MERCHANT_LEGAL_NAME", "GST_RATE_PERCENT", "CATALOG_APPROVED", "POLICIES_APPROVED",
    "TEST_MODE_ENABLED", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"
  ];
  const env = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    NODE_ENV: "production", COD_ENABLED: "true", MERCHANT_GST_REGISTERED: "false",
    MERCHANT_LEGAL_NAME: "Cake Galaxy", GST_RATE_PERCENT: "0",
    CATALOG_APPROVED: "true", POLICIES_APPROVED: "true", TEST_MODE_ENABLED: "false"
  });
  delete process.env.MERCHANT_GSTIN;
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
  const originals = {
    session: Session.findOne, adminSession: AdminSession.findOne, adminUser: AdminUser.findById,
    find: Order.findOne, create: Order.create, update: Order.findOneAndUpdate,
    area: ServiceArea.findOne, branch: Branch.findOne, products: Product.find, fetch: globalThis.fetch
  };
  const branchId = new mongoose.Types.ObjectId();
  const adminId = new mongoose.Types.ObjectId();
  const saved = [];
  Session.findOne = () => ({ lean: async () => ({ phone: "9876543210", csrfToken: "csrf-test" }) });
  AdminSession.findOne = () => ({ lean: async () => ({ userId: adminId, csrfToken: "b".repeat(48) }) });
  AdminUser.findById = () => ({ lean: async () => ({ _id: adminId, branchId, role: "branch_manager", active: true }) });
  Order.findOne = async ({ idempotencyKey }) => saved.find((order) => order.idempotencyKey === idempotencyKey) || null;
  Order.create = async (data) => { const record = { ...data, _id: new mongoose.Types.ObjectId() }; saved.push(record); return record; };
  Order.findOneAndUpdate = async (filter, update) => {
    const order = saved.find((record) => record.reference === filter.reference &&
      String(record.branchId) === String(filter.branchId) &&
      record.status === filter.status &&
      (!filter.paymentMethod || record.paymentMethod === filter.paymentMethod) &&
      (!filter.paymentStatus || (filter.paymentStatus.$in
        ? filter.paymentStatus.$in.includes(record.paymentStatus)
        : record.paymentStatus === filter.paymentStatus)));
    if (!order) return null;
    Object.assign(order, update.$set);
    return order;
  };
  ServiceArea.findOne = () => ({ lean: async () => ({ branchId, deliveryFee: 4900 }) });
  Branch.findOne = () => ({ lean: async () => ({ _id: branchId, active: true }) });
  Product.find = () => ({ lean: async () => [{ id: "chocolate-truffle", name: "Chocolate Truffle", price: 74900, weights: [0.5], flavour: "Chocolate", unit: "kg", active: true, eggless: false, photo: false }] });
  globalThis.fetch = async (url, options) => {
    if (String(url).includes("api.razorpay.com")) throw new Error("COD must never contact Razorpay.");
    return originals.fetch(url, options);
  };
  try {
    await withServer(async (base) => {
      const headers = { Cookie: "cg_session=" + "c".repeat(64), "X-CSRF-Token": "csrf-test", "Content-Type": "application/json" };
      const adminHeaders = { Cookie: "cg_admin_session=" + "a".repeat(64), "X-CSRF-Token": "b".repeat(48), "Content-Type": "application/json" };
      const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + 172800000));
      const body = {
        idempotencyKey: randomUUID(), preferredMethod: "cod",
        items: [{ productId: "chocolate-truffle", size: 0.5, quantity: 1, flavour: "Chocolate", eggless: false }],
        sender: { name: "Customer", phone: "9876543210" },
        address: { name: "Friend", phone: "9123456789", line1: "1 Main Road", city: "Bengaluru", pincode: "560073" },
        delivery: { date, slot: "10 AM – 1 PM" }
      };
      const config = await (await originals.fetch(base + "/api/checkout/config", { headers })).json();
      assert.equal(config.paymentsEnabled, false);
      assert.equal(config.codEnabled, true);
      assert.equal(config.taxRate, 0);
      const submit = (payload) => originals.fetch(base + "/api/checkout/orders", { method: "POST", headers, body: JSON.stringify(payload) });
      const first = await submit(body);
      assert.equal(first.status, 201);
      const order = (await first.json()).order;
      assert.equal(order.paymentStatus, "cod_pending");
      assert.equal(order.paymentMethod, "cod");
      assert.equal(order.status, "confirmed");
      assert.equal(saved[0].amount, 79800);
      assert.equal(saved[0].razorpayOrderId, undefined);
      assert.equal((await submit(body)).status, 200);
      assert.equal(saved.length, 1);
      assert.equal((await submit({ ...body, preferredMethod: "bitcoin" })).status, 400);
      const admin = (status, codCollected) => originals.fetch(base + "/api/admin/orders/" + saved[0].reference + "/status", {
        method: "PATCH", headers: adminHeaders, body: JSON.stringify({ status, ...(codCollected ? { codCollected: true } : {}) })
      });
      assert.equal((await admin("delivered", true)).status, 409);
      assert.equal((await admin("preparing")).status, 200);
      assert.equal((await admin("out_for_delivery")).status, 200);
      assert.equal((await admin("delivered")).status, 409);
      assert.equal(saved[0].paymentStatus, "cod_pending");
      assert.equal((await admin("delivered", true)).status, 200);
      assert.equal(saved[0].status, "delivered");
      assert.equal(saved[0].paymentStatus, "cod_paid");
      assert.ok(saved[0].codCollectedAt instanceof Date);
      assert.equal(String(saved[0].codCollectedBy), String(adminId));
      assert.equal((await admin("delivered", true)).status, 409);
      process.env.COD_ENABLED = "false";
      assert.equal((await (await originals.fetch(base + "/api/checkout/config", { headers })).json()).codEnabled, false);
      assert.equal((await submit({ ...body, idempotencyKey: randomUUID() })).status, 503);
    });
  } finally {
    Session.findOne = originals.session; AdminSession.findOne = originals.adminSession; AdminUser.findById = originals.adminUser;
    Order.findOne = originals.find; Order.create = originals.create; Order.findOneAndUpdate = originals.update;
    ServiceArea.findOne = originals.area; Branch.findOne = originals.branch; Product.find = originals.products;
    globalThis.fetch = originals.fetch;
    for (const key of envKeys) if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key];
  }
});
