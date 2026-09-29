import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { AdminSession, AdminUser, Branch, CustomRequest, Order, Product, ServiceArea, Session } from "../src/models.js";
import { hashPassword } from "../src/admin.js";
import { bootstrapSuperAdmin, ensureBaseServiceAreas, resetSuperAdminPassword } from "../src/bootstrap.js";

test("invalid bootstrap credentials never prevent startup or create an admin", async () => {
  let created = null;
  const store = { exists: async () => false, create: async (user) => { created = user; } };
  assert.equal(await bootstrapSuperAdmin(store, "owner@example.com", "short"), "invalid");
  assert.equal(created, null);
  assert.equal(await bootstrapSuperAdmin(store, "owner@example.com", "secure-password-1234"), "created");
  assert.equal(created.email, "owner@example.com");
  assert.match(created.passwordHash, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
  assert.equal(await bootstrapSuperAdmin({ exists: async () => true, create: async () => { throw new Error("Must not reset admin"); } }, "owner@example.com", "short"), "existing");
});

test("reset updates only an existing Super Admin and revokes their sessions", async () => {
  let update = null;
  let revoked = null;
  const store = {
    findOne: async (filter) => filter.email === "owner@example.com" && filter.role === "super_admin" ? { _id: "admin-id" } : null,
    updateOne: async (filter, change) => { update = { filter, change }; return { matchedCount: 1 }; }
  };
  const sessions = { deleteMany: async (filter) => { revoked = filter; } };
  await assert.rejects(resetSuperAdminPassword(store, sessions, "other@example.com", "new-password-1234"), /not found/);
  assert.equal(update, null);
  await resetSuperAdminPassword(store, sessions, "owner@example.com", "new-password-1234");
  assert.deepEqual(update.filter, { _id: "admin-id", role: "super_admin" });
  assert.match(update.change.$set.passwordHash, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
  assert.deepEqual(revoked, { userId: "admin-id" });
});

test("existing branch base pincode is added without changing a paused mapping", async () => {
  const rows = new Map([["560058", { branchId: "other", active: false, deliveryFee: 2500 }]]);
  const areas = { updateOne: async ({ pincode }, { $setOnInsert }, options) => {
    assert.equal(options.upsert, true);
    if (!rows.has(pincode)) rows.set(pincode, $setOnInsert);
  } };
  await ensureBaseServiceAreas([{ _id: "first", basePincode: "560058" }, { _id: "third", basePincode: "560072" }], areas, 4900);
  assert.deepEqual(rows.get("560058"), { branchId: "other", active: false, deliveryFee: 2500 });
  assert.deepEqual(rows.get("560072"), { pincode: "560072", branchId: "third", active: true, deliveryFee: 4900 });
});

test("approved Pages and custom domains both receive credentialed CORS headers", async () => {
  const old = process.env.WEB_ORIGINS;
  process.env.WEB_ORIGINS = "https://cake-galaxy.pages.dev, https://www.cakegalaxy.example/";
  try {
    await withServer(async (base) => {
      for (const origin of ["https://cake-galaxy.pages.dev", "https://www.cakegalaxy.example"]) {
        const response = await fetch(base + "/api/health", { headers: { Origin: origin } });
        assert.equal(response.headers.get("access-control-allow-origin"), origin);
        assert.equal(response.headers.get("access-control-allow-credentials"), "true");
      }
      const blocked = await fetch(base + "/api/health", { headers: { Origin: "https://other.example" } });
      assert.equal(blocked.headers.get("access-control-allow-origin"), null);
    });
  } finally {
    if (old === undefined) delete process.env.WEB_ORIGINS;
    else process.env.WEB_ORIGINS = old;
  }
});

async function withServer(run) {
  const server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  try { await run("http://127.0.0.1:" + server.address().port); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test("admin rejects anonymous access and weak bootstrap passwords", async () => {
  await assert.rejects(hashPassword("weak"), /12/);
  assert.match(await hashPassword("a-long-unique-password"), /^[0-9a-f]{32}:[0-9a-f]{128}$/);
  await withServer(async (base) => {
    const response = await fetch(base + "/api/admin/orders");
    assert.equal(response.status, 401);
  });
});

test("branch manager order reads and writes are scoped to their branch", async () => {
  const id = new mongoose.Types.ObjectId();
  const raw = "a".repeat(64);
  const csrf = "b".repeat(48);
  const session = { _id: new mongoose.Types.ObjectId(), userId: new mongoose.Types.ObjectId(), tokenHash: createHash("sha256").update(raw).digest("hex"), csrfToken: csrf };
  const manager = { _id: session.userId, role: "branch_manager", branchId: id, active: true, name: "Manager", email: "manager@example.com" };
  const original = { session: AdminSession.findOne, user: AdminUser.findById, find: Order.find, update: Order.findOneAndUpdate };
  let readFilter; let writeFilter;
  AdminSession.findOne = () => ({ lean: async () => session });
  AdminUser.findById = () => ({ lean: async () => manager });
  Order.find = (filter) => { readFilter = filter; return { sort: () => ({ limit: () => ({ lean: async () => [] }) }) }; };
  Order.findOneAndUpdate = async (filter) => { writeFilter = filter; return null; };
  try {
    await withServer(async (base) => {
      const headers = { Cookie: "cg_admin_session=" + raw };
      const list = await fetch(base + "/api/admin/orders?branchId=" + new mongoose.Types.ObjectId(), { headers });
      assert.equal(list.status, 200);
      assert.equal(String(readFilter.branchId), String(id));
      const denied = await fetch(base + "/api/admin/branches", { method: "POST", headers: { ...headers, "X-CSRF-Token": csrf, "Content-Type": "application/json" }, body: JSON.stringify({ code: "OTHER" }) });
      assert.equal(denied.status, 403);
      const noCsrf = await fetch(base + "/api/admin/orders/CG1/status", { method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ status: "preparing" }) });
      assert.equal(noCsrf.status, 403);
      const update = await fetch(base + "/api/admin/orders/CG1/status", { method: "PATCH", headers: { ...headers, "X-CSRF-Token": csrf, "Content-Type": "application/json" }, body: JSON.stringify({ status: "preparing" }) });
      assert.equal(update.status, 409);
      assert.equal(String(writeFilter.branchId), String(id));
      assert.equal(writeFilter.paymentStatus, "paid");
    });
  } finally {
    AdminSession.findOne = original.session; AdminUser.findById = original.user;
    Order.find = original.find; Order.findOneAndUpdate = original.update;
  }
});

test("delivery is unavailable without an active assigned branch", async () => {
  const branchId = new mongoose.Types.ObjectId();
  const originalArea = ServiceArea.findOne;
  const originalBranch = Branch.findOne;
  let area = { pincode: "560058", deliveryFee: 4900, branchId: null };
  ServiceArea.findOne = () => ({ lean: async () => area });
  Branch.findOne = () => ({ lean: async () => ({ _id: branchId, active: true }) });
  try {
    await withServer(async (base) => {
      const endpoint = base + "/api/delivery?pincode=560058";
      assert.deepEqual(await (await fetch(endpoint)).json(), { available: false });
      area = { ...area, branchId };
      assert.deepEqual(await (await fetch(endpoint)).json(), { available: true, deliveryFee: 4900, slots: ["10 AM – 1 PM", "1 PM – 4 PM", "4 PM – 7 PM", "7 PM – 10 PM"] });
    });
  } finally { ServiceArea.findOne = originalArea; Branch.findOne = originalBranch; }
});

test("custom cake request saves the branch selected from the delivery pincode", async () => {
  const branchId = new mongoose.Types.ObjectId();
  const token = "c".repeat(64);
  const csrf = "d".repeat(48);
  const originals = { session: Session.findOne, area: ServiceArea.findOne, branch: Branch.findOne, create: CustomRequest.create };
  let saved;
  Session.findOne = () => ({ lean: async () => ({ phone: "9876543210", csrfToken: csrf }) });
  ServiceArea.findOne = () => ({ lean: async () => ({ pincode: "560073", deliveryFee: 4900, branchId }) });
  Branch.findOne = () => ({ lean: async () => ({ _id: branchId, active: true }) });
  CustomRequest.create = async (value) => { saved = value; return value; };
  try {
    await withServer(async (base) => {
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      const response = await fetch(base + "/api/custom-requests", { method: "POST", headers: { Cookie: "cg_session=" + token, "X-CSRF-Token": csrf, "Content-Type": "application/json" }, body: JSON.stringify({ customPincode: "560073", customPhone: "9876543210", sample: "Floral", occasion: "Birthday", weight: "1 kg", flavour: "Vanilla", requiredDate: today }) });
      assert.equal(response.status, 201);
      assert.equal(String(saved.branchId), String(branchId));
    });
  } finally {
    Session.findOne = originals.session; ServiceArea.findOne = originals.area;
    Branch.findOne = originals.branch; CustomRequest.create = originals.create;
  }
});

test("checkout verifies the sender while preserving a different recipient phone", async () => {
  const keys = ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "MERCHANT_LEGAL_NAME", "MERCHANT_GSTIN", "GST_RATE_PERCENT", "CATALOG_APPROVED", "POLICIES_APPROVED"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, { RAZORPAY_KEY_ID: "test_key", RAZORPAY_KEY_SECRET: "test_secret", MERCHANT_LEGAL_NAME: "Cake Galaxy", MERCHANT_GSTIN: "29ABCDE1234F1Z5", GST_RATE_PERCENT: "0", CATALOG_APPROVED: "true", POLICIES_APPROVED: "true" });
  const originals = { session: Session.findOne, order: Order.findOne, create: Order.create, area: ServiceArea.findOne, branch: Branch.findOne, products: Product.find, fetch: globalThis.fetch };
  const branchId = new mongoose.Types.ObjectId();
  const csrf = "d".repeat(48);
  let saved;
  Session.findOne = () => ({ lean: async () => ({ phone: "9876543210", csrfToken: csrf }) });
  Order.findOne = async () => null;
  ServiceArea.findOne = () => ({ lean: async () => ({ pincode: "560073", deliveryFee: 4900, branchId }) });
  Branch.findOne = () => ({ lean: async () => ({ _id: branchId, active: true }) });
  Product.find = () => ({ lean: async () => [{ id: "chocolate-truffle", name: "Chocolate Truffle", price: 74900, weights: [0.5], flavour: "Chocolate", unit: "kg", active: true, eggless: false, photo: false }] });
  Order.create = async (value) => { saved = value; return { ...value, save: async () => {} }; };
  globalThis.fetch = async (url, options) => String(url).startsWith("https://api.razorpay.com/")
    ? new Response(JSON.stringify({ id: "order_test", amount: 79800, currency: "INR" }), { status: 200, headers: { "Content-Type": "application/json" } })
    : originals.fetch(url, options);
  try {
    await withServer(async (base) => {
      const body = { idempotencyKey: randomUUID(), items: [{ productId: "chocolate-truffle", size: 0.5, quantity: 1, flavour: "Chocolate", eggless: false }], sender: { name: "Naveen", phone: "9876543210" }, address: { name: "Friend", phone: "9123456789", line1: "1 Main Road", city: "Bengaluru", pincode: "560073", whatsapp: true }, delivery: { date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()), slot: "10 AM – 1 PM" } };
      const headers = { Cookie: "cg_session=" + "c".repeat(64), "X-CSRF-Token": csrf, "Content-Type": "application/json" };
      const response = await originals.fetch(base + "/api/checkout/orders", { method: "POST", headers, body: JSON.stringify(body) });
      assert.equal(response.status, 201);
      assert.equal(saved.customerPhone, "9876543210");
      assert.deepEqual(saved.sender, { name: "Naveen", phone: "9876543210" });
      assert.equal(saved.address.name, "Friend");
      assert.equal(saved.address.phone, "9123456789");
      const wrongSender = await originals.fetch(base + "/api/checkout/orders", { method: "POST", headers, body: JSON.stringify({ ...body, sender: { name: "Naveen", phone: "9123456789" } }) });
      assert.equal(wrongSender.status, 400);
    });
  } finally {
    Session.findOne = originals.session; Order.findOne = originals.order; Order.create = originals.create;
    ServiceArea.findOne = originals.area; Branch.findOne = originals.branch; Product.find = originals.products; globalThis.fetch = originals.fetch;
    for (const key of keys) if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
  }
});
