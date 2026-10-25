import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { designCakeStartingPrice, designCakeTier, unitPrice, approvedCakePrices } from "@cake-galaxy/catalog";
import { Session, ServiceArea, Branch, Product, Upload, CustomRequest, AdminSession, AdminUser } from "../src/models.js";

test("Design Cake tiers use starting-size LIST prices: below ₹600 / ₹600-₹1000 / above ₹1000", () => {
  const product = (price) => ({ price, weights: [0.5, 1, 1.5], unit: "kg", variantPrices: {} });
  assert.deepEqual(designCakeStartingPrice(product(59900)), { size: 0.5, price: 59900 });
  assert.equal(designCakeTier(product(59900)), "basic");
  assert.equal(designCakeTier(product(60000)), "standard");
  assert.equal(designCakeTier(product(100000)), "standard");
  assert.equal(designCakeTier(product(100001)), "premium");
  assert.equal(designCakeTier({ ...product(59900), unit: "pieces" }), null);
  assert.equal(designCakeTier({ ...product(59900), weights: [] }), null);
  assert.equal(designCakeTier({ ...product(59900), price: 0 }), null);
  const variant = { ...product(100000), variantPrices: { w_0_5: 110000 } };
  assert.equal(designCakeTier(variant), "premium");
  for (const cake of approvedCakePrices) {
    const item = { ...product(cake.halfKg * 100), id: cake.id };
    const expected = cake.halfKg < 600 ? "basic" : cake.halfKg <= 1000 ? "standard" : "premium";
    assert.equal(designCakeTier(item), expected);
    assert.equal(unitPrice({ productId: item.id, size: 1, eggless: false, addons: [] }, item), cake.halfKg * 180);
  }
});

test("Design Cake request requires a verified uploaded image and calculates price from active catalogue", async () => {
  const saved = [];
  const phone = "9876543210";
  const csrf = "design-csrf-token";
  const product = {
    id: "menu-black-forest", name: "Black Forest Cake", unit: "kg",
    price: 39900, weights: [0.5, 1, 1.5], active: true, deletedAt: null, variantPrices: {}
  };
  const originals = {
    session: Session.findOne,
    area: ServiceArea.findOne,
    branch: Branch.findOne,
    product: Product.findOne,
    upload: Upload.findOne,
    request: CustomRequest.create
  };
  Session.findOne = () => ({ lean: async () => ({ phone, csrfToken: csrf }) });
  ServiceArea.findOne = () => ({ lean: async () => ({ branchId: "branch01", deliveryFee: 4900 }) });
  Branch.findOne = () => ({ lean: async () => ({ _id: "branch01", active: true }) });
  Product.findOne = async (filter) => filter.id === product.id ? product : null;
  Upload.findOne = async (filter) => filter.id === "upload-1" && filter.ownerPhone === phone ? { id: "upload-1" } : null;
  CustomRequest.create = async (payload) => { saved.push(payload); return payload; };
  const server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const url = "http://127.0.0.1:" + server.address().port + "/api/custom-requests";
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const request = async (changes = {}) => fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf, "Cookie": "cg_session=session-cookie" },
    body: JSON.stringify({
      productId: product.id, weightKg: 1, flavourTier: "basic", uploadId: "upload-1",
      customPincode: "560058", customPhone: phone, occasion: "Birthday",
      notes: "Spider-Man theme", requiredDate: date, budget: 1000,
      flavour: "Premium flavour injected", estimatedCakePrice: 1, quotedPrice: 1, ...changes
    })
  });
  try {
    const response = await request();
    assert.equal(response.status, 201);
    const result = await response.json();
    assert.match(result.reference, /^CGC[A-F0-9]{10}$/);
    assert.equal(Object.hasOwn(result, "estimatedCakePrice"), false, "Customer response must not expose a price");
    assert.equal(saved.length, 1);
    assert.equal(saved[0].flavourTier, "basic");
    assert.equal(saved[0].flavour, "Black Forest Cake");
    assert.equal(saved[0].weight, "1 kg");
    assert.equal(saved[0].weightKg, 1);
    assert.equal(saved[0].estimatedCakePrice, 71820, "Internal admin reference is still calculated");
    assert.equal(Object.hasOwn(saved[0], "budget"), false, "Customer budget is no longer recorded");
    assert.equal(Object.hasOwn(saved[0], "quotedPrice"), false, "Customer cannot set a final quote");
    assert.equal(saved[0].uploadId, "upload-1");
    assert.equal(saved[0].status, undefined); // Schema supplies requested.
    for (const changes of [
      { flavourTier: "premium" }, { productId: "unknown" }, { weightKg: 0.5 },
      { weightKg: 2 }, { weightKg: "1" }, { uploadId: "" }, { uploadId: "not-owned" },
      { customPhone: "9999999999" }
    ]) {
      const invalid = await request(changes);
      assert.equal(invalid.status, 400, JSON.stringify(changes));
    }
    assert.equal(saved.length, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    Session.findOne = originals.session;
    ServiceArea.findOne = originals.area;
    Branch.findOne = originals.branch;
    Product.findOne = originals.product;
    Upload.findOne = originals.upload;
    CustomRequest.create = originals.request;
  }
});


test("Only branch admins can save final quote amounts; a Quoted status always needs a valid amount", async () => {
  const branchId = new mongoose.Types.ObjectId();
  const adminId = new mongoose.Types.ObjectId();
  const raw = "a".repeat(64);
  const csrf = "b".repeat(48);
  const originals = {
    session: AdminSession.findOne, user: AdminUser.findById,
    update: CustomRequest.findOneAndUpdate
  };
  const stored = { reference: "CGC123", branchId, status: "requested" };
  let requestFilter;
  AdminSession.findOne = () => ({ lean: async () => ({
    tokenHash: createHash("sha256").update(raw).digest("hex"), csrfToken: csrf, userId: adminId
  }) });
  AdminUser.findById = () => ({ lean: async () => ({
    _id: adminId, name: "Test Manager", email: "manager@example.com",
    role: "branch_manager", branchId, active: true
  }) });
  CustomRequest.findOneAndUpdate = async (filter, update) => {
    requestFilter = filter;
    if (filter.reference !== stored.reference || String(filter.branchId) !== String(branchId)) return null;
    Object.assign(stored, update.$set);
    return { ...stored };
  };

  const server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const path = "http://127.0.0.1:" + server.address().port + "/api/admin/custom-requests/" + stored.reference;
  const patch = async (body, options = {}) => {
    const response = await fetch(path, {
      method: "PATCH", headers: {
        "Content-Type": "application/json",
        ...(options.anonymous ? {} : { Cookie: "cg_admin_session=" + raw }),
        ...(options.noCsrf ? {} : { "X-CSRF-Token": csrf })
      },
      body: JSON.stringify(body)
    });
    return response;
  };
  try {
    assert.equal((await patch({ status: "quoted", quotedPrice: 10000 }, { anonymous: true })).status, 401);
    assert.equal((await patch({ status: "quoted", quotedPrice: 10000 }, { noCsrf: true })).status, 403);
    for (const changes of [
      { status: "quoted" },
      { status: "quoted", quotedPrice: 0 },
      { status: "quoted", quotedPrice: 99 },
      { status: "quoted", quotedPrice: 300.5 },
      { status: "quoted", quotedPrice: "30000" },
      { status: "quoted", quotedPrice: 100_000_001 },
      { status: "quoted", quotedPrice: 10000, quoteNotes: "x".repeat(501) },
      { status: "reviewing", quotedPrice: 10000 }
    ]) {
      assert.equal((await patch(changes)).status, 400, JSON.stringify(changes).slice(0, 120));
    }
    assert.equal(stored.quotedPrice, undefined);
    const reviewing = await patch({ status: "reviewing" });
    assert.equal(reviewing.status, 200);
    assert.equal(stored.status, "reviewing");
    const response = await patch({
      status: "quoted", quotedPrice: 185050, quoteNotes: "Fondant decoration included, delivery confirmed separately"
    });
    assert.equal(response.status, 200);
    const updated = (await response.json()).request;
    assert.equal(updated.quotedPrice, 185050);
    assert.equal(updated.quoteNotes, "Fondant decoration included, delivery confirmed separately");
    assert.equal(updated.status, "quoted");
    assert.equal(String(updated.quotedBy), String(adminId));
    assert.equal(String(requestFilter.branchId), String(branchId));
    assert.ok(updated.quotedAt);

    const edited = await patch({ status: "quoted", quotedPrice: 192500, quoteNotes: "Updated design" });
    assert.equal(edited.status, 200);
    assert.equal(stored.quotedPrice, 192500);
    const closed = await patch({ status: "closed" });
    assert.equal(closed.status, 200);
    assert.equal(stored.quotedPrice, 192500, "Closing a request preserves the latest admin quotation");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    AdminSession.findOne = originals.session;
    AdminUser.findById = originals.user;
    CustomRequest.findOneAndUpdate = originals.update;
  }
});
