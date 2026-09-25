import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { products } from "@cake-galaxy/catalog";
import { createApp } from "../src/app.js";
import { deliveryDate, HttpError, phoneNumber, priceItem } from "../src/validation.js";
import { validPaymentSignature, validWebhookSignature } from "../src/providers.js";

test("checkout pricing uses catalogue prices, valid options and quantities", () => {
  const cake = { ...products[0], active: true };
  const chosen = { size: 1, quantity: 2, flavour: cake.flavour, eggless: true, addons: ["candles"], message: "Happy birthday" };
  const line = priceItem({ ...chosen, price: 1, lineTotal: 1 }, cake);
  assert.equal(line.unitPrice, 158700);
  assert.equal(line.lineTotal, 317400);
  assert.equal(line.unit, "kg");
  for (const tampered of [
    { ...chosen, quantity: -1 }, { ...chosen, size: 9 },
    { ...chosen, addons: ["unknown"] }, { ...chosen, addons: ["candles", "candles"] },
    { ...chosen, flavour: "Strawberry" }, { ...chosen, message: "x".repeat(31) }
  ]) assert.throws(() => priceItem(tampered, cake), HttpError);
});

test("phone and delivery validators reject malformed inputs", () => {
  assert.equal(phoneNumber("+919876543210"), "9876543210");
  assert.throws(() => phoneNumber("1234567890"), HttpError);
  assert.equal(deliveryDate("2026-09-26", "2026-09-25"), "2026-09-26");
  for (const bad of ["2026-09-24", "2026-09-31", "2026-11-01", "yesterday"]) assert.throws(() => deliveryDate(bad, "2026-09-25"), HttpError);
});

test("Razorpay callback and webhook signatures use server secrets", () => {
  const order = "order_store_owned"; const payment = "pay_123"; const secret = "server_secret";
  const signature = createHmac("sha256", secret).update(order + "|" + payment).digest("hex");
  assert.equal(validPaymentSignature(order, payment, signature, secret), true);
  assert.equal(validPaymentSignature("order_changed", payment, signature, secret), false);
  assert.equal(validPaymentSignature(order, payment, "bad", secret), false);
  const old = process.env.RAZORPAY_WEBHOOK_SECRET;
  try {
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;
    const raw = Buffer.from('{"event":"payment.captured"}');
    assert.equal(validWebhookSignature(raw, createHmac("sha256", secret).update(raw).digest("hex")), true);
    assert.equal(validWebhookSignature(Buffer.from("{}"), createHmac("sha256", secret).update(raw).digest("hex")), false);
  } finally {
    if (old === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
    else process.env.RAZORPAY_WEBHOOK_SECRET = old;
  }
});

test("HTTP health works and checkout stays disabled without business/provider configuration", async () => {
  const server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const base = "http://127.0.0.1:" + server.address().port;
    const health = await fetch(base + "/api/health");
    assert.deepEqual(await health.json(), { ok: true });
    const config = await fetch(base + "/api/checkout/config");
    assert.deepEqual(await config.json(), { paymentsEnabled: false, keyId: "" });
    const badWebhook = await fetch(base + "/api/webhooks/razorpay", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    assert.equal(badWebhook.status, 401);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
