import test from "node:test";
import assert from "node:assert/strict";
import { products, catalogueBasePrice, weightKey, unitPrice } from "@cake-galaxy/catalog";
import { validateDeliverySlot, HttpError } from "../src/validation.js";

test("catalogue uses approved exact variant prices and proportional fallback", () => {
  const product = { ...products[0], variantPrices: { w_0_5: 69000, w_1: 129900 } };
  assert.equal(weightKey(0.5), "w_0_5");
  assert.equal(catalogueBasePrice({ size: 0.5 }, product), 69000);
  assert.equal(catalogueBasePrice({ size: 1 }, product), 129900);
  assert.equal(catalogueBasePrice({ size: 1.5 }, product), Math.round(product.price * 1.5 / 0.5));
  assert.equal(unitPrice({ size: 0.5, eggless: false, addons: [] }, product), 69000);
  assert.equal(unitPrice({ size: 1, eggless: false, addons: [] }, product), 116910); // 10% off the configured ₹1,299 cake base.
});

test("same-day past delivery slot is unavailable; tomorrow remains valid", () => {
  const now = new Date("2026-10-22T11:30:00+05:30");
  assert.throws(() => validateDeliverySlot("2026-10-22", "10 AM – 1 PM", now), HttpError);
  assert.equal(validateDeliverySlot("2026-10-22", "1 PM – 4 PM", now), "1 PM – 4 PM");
  assert.equal(validateDeliverySlot("2026-10-23", "10 AM – 1 PM", now), "10 AM – 1 PM");
  assert.throws(() => validateDeliverySlot("2026-10-22", "10 AM – 1 PM", now, 120), HttpError);
  assert.throws(() => validateDeliverySlot("2026-10-23", "unknown", now), HttpError);
});
