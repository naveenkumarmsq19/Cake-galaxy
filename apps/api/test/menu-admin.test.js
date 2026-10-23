import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { AdminSession, AdminUser, Product, Category } from "../src/models.js";

test("Super Admin can add disabled products, disable, archive and restore without permanent deletion", async () => {
  const raw = "a".repeat(64), csrf = "b".repeat(48);
  const userId = new mongoose.Types.ObjectId();
  const original = { session: AdminSession.findOne, user: AdminUser.findById,
    create: Product.create, update: Product.findOneAndUpdate, findOne: Product.findOne, categoryFind: Category.find };
  const seen = [];
  AdminSession.findOne = () => ({ lean: async () => ({ _id: new mongoose.Types.ObjectId(), userId, csrfToken: csrf, tokenHash: createHash("sha256").update(raw).digest("hex") }) });
  AdminUser.findById = () => ({ lean: async () => ({ _id: userId, active: true, role: "super_admin", name: "Owner", email: "owner@example.com" }) });
  Category.find = () => ({ lean: async () => [{ name: "Signature Cakes", active: true, keywords: [], sortOrder: 1000 }, { name: "Chocolate Cakes", active: true, keywords: ["chocolate"], sortOrder: 70 }] });
  Product.findOne = () => ({ lean: async () => ({ id: "my-test-cake", name: "Vanilla Cake", flavour: "Vanilla", category: ["Chocolate Cakes"], categoryMode: "manual" }) });
  Product.create = async (v) => { seen.push(["create", v]); return v; };
  Product.findOneAndUpdate = async (filter, update) => {
    seen.push(["update", filter, update]);
    return { id: filter.id, name: "Vanilla Cake", active: update.$set?.active === true, deletedAt: update.$set?.deletedAt ?? null };
  };
  const server = createApp().listen(0);
  await new Promise(resolve => server.once("listening", resolve));
  const base = "http://127.0.0.1:" + server.address().port + "/api/admin/products";
  const headers = { Cookie: "cg_admin_session=" + raw, "X-CSRF-Token": csrf, "Content-Type": "application/json" };
  try {
    const product = { id: "my-test-cake", name: "Vanilla Cake", price: 24900,
      variantPrices: { w_2: 24900, w_3: 39900 },
      variantLabels: { w_2: "Small", w_3: "Medium" },
      weights: [2,3], unit: "menu", category: ["Chocolate Cakes"], categoryMode: "manual", flavour: "Vanilla",
      image: "/images/celebration.jpg", active: true, eggless: false, photo: false };
    const create = await fetch(base, { method: "POST", headers, body: JSON.stringify(product) });
    assert.equal(create.status, 201, await create.text());
    assert.equal(seen[0][1].active, false, "new products must default to disabled");
    const update = await fetch(base + "/my-test-cake", { method:"PATCH", headers, body: JSON.stringify({active:false}) });
    assert.equal(update.status, 200);
    assert.equal(seen[1][2].$set.active, false);
    const remove = await fetch(base + "/my-test-cake", { method:"DELETE", headers });
    assert.equal(remove.status, 200);
    assert.ok(seen[2][2].$set.deletedAt instanceof Date);
    assert.equal(seen[2][2].$set.active, false);
    const restore = await fetch(base + "/my-test-cake/restore", { method:"POST", headers });
    assert.equal(restore.status, 200);
    assert.deepEqual(seen[3][2].$set, { deletedAt: null, active: false });
  } finally {
    await new Promise(resolve=>server.close(resolve));
    AdminSession.findOne = original.session; AdminUser.findById = original.user;
    Product.create = original.create; Product.findOneAndUpdate = original.update; Product.findOne = original.findOne; Category.find = original.categoryFind;
  }
});
