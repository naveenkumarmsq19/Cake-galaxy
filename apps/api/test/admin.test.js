import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { AdminSession, AdminUser, Branch, CustomRequest, Order, ServiceArea, Session } from "../src/models.js";
import { hashPassword } from "../src/admin.js";
import { bootstrapSuperAdmin } from "../src/bootstrap.js";

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
