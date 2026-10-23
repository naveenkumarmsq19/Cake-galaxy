import test from "node:test";
import assert from "node:assert/strict";
import { deliverySlots, availableDeliverySlots } from "../../web/src/components/deliverySchedule.js";
import { validateDeliverySlot } from "../src/validation.js";
import { catalogueBasePrice, unitPrice } from "@cake-galaxy/catalog";
import { defaultCategories, suggestCategory } from "../src/categoryService.js";
import { imagekitPhotoCounts } from "../src/imageKitProduct.js";

// Diagnostic tests intentionally confirm CURRENT behavior and make discrepancies
// reproducible. They do not mutate products/orders or make network requests.
test("QA diagnostic: browser accepts a slot that server rejects with MIN_PREP_MINUTES=120", () => {
  const now = new Date("2026-10-24T06:00:00.000Z"); // 11:30 IST
  const slot = deliverySlots[1]; // 1PM, only 90 minutes away
  assert.ok(availableDeliverySlots("2026-10-24", now).includes(slot));
  assert.throws(
    () => validateDeliverySlot("2026-10-24", slot, now, 120),
    error => error.status === 400 && /preparation time|already started/.test(error.message)
  );
});

test("QA diagnostic: unsorted admin cake weights make default weight more expensive than lowest price", () => {
  const product = {
    id: "test-unsorted-weights", active: true, price: 50000, unit: "kg",
    weights: [1, .5, 2], variantPrices: {}, eggless: false
  };
  const item = size => ({ productId: product.id, size, eggless: false, addons: [] });
  assert.equal(catalogueBasePrice(item(product.weights[0]), product), 50000);
  assert.equal(catalogueBasePrice(item(0.5), product), 25000);
  assert.ok(unitPrice(item(product.weights[0]), product) > unitPrice(item(0.5), product));
});

test("QA diagnostic: auto-classifier gives fruit category priority for Chocolate Strawberry cake", () => {
  assert.equal(
    suggestCategory({ name: "Chocolate Strawberry Cake", flavour: "Chocolate" }, defaultCategories),
    "Fruit Cakes"
  );
});

test("QA diagnostic: imported ImageKit mapping references only 198 photos across 30 gallery names", () => {
  assert.equal(Object.keys(imagekitPhotoCounts).length, 30);
  assert.equal(Object.values(imagekitPhotoCounts).reduce((sum,count) => sum+count,0), 198);
});
