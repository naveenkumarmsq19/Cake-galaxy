import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { discountAmount, egglessSurcharge, products } from "@cake-galaxy/catalog";
import { createApp } from "../src/app.js";
import { deliveryDate, HttpError, phoneNumber, priceItem } from "../src/validation.js";
import { sendOtp, validPaymentSignature, validWebhookSignature } from "../src/providers.js";

test("checkout pricing uses catalogue prices, valid options and quantities", () => {
  const cake = { ...products[0], active: true };
  const chosen = { size: 1, quantity: 2, flavour: cake.flavour, eggless: true, addons: ["candles"], message: "Happy birthday" };
  const line = priceItem({ ...chosen, price: 1, lineTotal: 1 }, cake);
  assert.equal(line.originalUnitPrice, 163700);
  assert.equal(line.discountPerUnit, 0);
  assert.equal(line.unitPrice, 163700);
  assert.equal(line.lineTotal, 327400);
  assert.equal(line.unit, "kg");
  for (const tampered of [
    { ...chosen, quantity: -1 }, { ...chosen, size: 9 },
    { ...chosen, addons: ["unknown"] }, { ...chosen, addons: ["candles", "candles"] },
    { ...chosen, flavour: "Strawberry" }, { ...chosen, message: "x".repeat(31) }
  ]) assert.throws(() => priceItem(tampered, cake), HttpError);
});

test("eggless surcharge scales by weight and cakes over 1 kg receive a 10% discount", () => {
  const cake = { ...products[0], active: true };
  assert.equal(egglessSurcharge({ size: 0.5, eggless: true }, cake), 5000);
  assert.equal(egglessSurcharge({ size: 1, eggless: true }, cake), 10000);
  assert.equal(egglessSurcharge({ size: 1.5, eggless: true }, cake), 15000);

  const line = priceItem({ size: 1.5, quantity: 1, flavour: cake.flavour, eggless: false, addons: [] }, cake);
  assert.equal(line.originalUnitPrice, 224700);
  assert.equal(line.discountPerUnit, 22500);
  assert.equal(line.discountPercent, 10);
  assert.equal(line.unitPrice, 202200);
  assert.equal(line.lineTotal, 202200);
});

test("phone and delivery validators reject malformed inputs", () => {
  assert.equal(phoneNumber("+919876543210"), "9876543210");
  assert.throws(() => phoneNumber("1234567890"), HttpError);
  assert.equal(deliveryDate("2026-09-26", "2026-09-25"), "2026-09-26");
  for (const bad of ["2026-09-24", "2026-09-31", "2026-11-01", "yesterday"]) assert.throws(() => deliveryDate(bad, "2026-09-25"), HttpError);
});

test("OTP uses the configured MSG91 WhatsApp template rather than the SMS send endpoint", async () => {
  const keys = ["NODE_ENV", "DEV_OTP_ENABLED", "MSG91_AUTH_KEY", "MSG91_WHATSAPP_NUMBER", "MSG91_WHATSAPP_OTP_TEMPLATE_NAME", "MSG91_WHATSAPP_OTP_TEMPLATE_LANGUAGE"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  let request;
  Object.assign(process.env, {
    NODE_ENV: "production",
    DEV_OTP_ENABLED: "false",
    MSG91_AUTH_KEY: "test-auth-key",
    MSG91_WHATSAPP_NUMBER: "919999999999",
    MSG91_WHATSAPP_OTP_TEMPLATE_NAME: "cake_galaxy_login_otp",
    MSG91_WHATSAPP_OTP_TEMPLATE_LANGUAGE: "en"
  });
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options };
    return new Response(JSON.stringify({ type: "success" }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const sent = await sendOtp("9876543210");
    assert.equal(sent.channel, "whatsapp");
    assert.match(sent.code, /^[0-9]{6}$/);
    assert.equal(request.url, "https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/");
    const body = JSON.parse(request.options.body);
    assert.deepEqual(body.payload.to_and_components[0].to, ["919876543210"]);
    assert.equal(body.payload.to_and_components[0].components.body_1.value, sent.code);
    assert.equal(body.payload.template.name, "cake_galaxy_login_otp");
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of keys) if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
  }
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
    assert.deepEqual(await config.json(), { paymentsEnabled: false, testCodEnabled: false, keyId: "", taxRate: null });
    const badWebhook = await fetch(base + "/api/webhooks/razorpay", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    assert.equal(badWebhook.status, 401);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
