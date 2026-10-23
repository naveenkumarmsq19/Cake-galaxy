import test from "node:test";
import assert from "node:assert/strict";
import { sendOtp } from "../src/providers.js";

async function withProviderEnv(overrides, fn) {
  const prior = Object.fromEntries(Object.keys(overrides).map(key => [key, process.env[key]]));
  const previousFetch = globalThis.fetch;
  try {
    Object.assign(process.env, overrides);
    return await fn();
  } finally {
    globalThis.fetch = previousFetch;
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const baseEnv = {
  NODE_ENV: "production",
  DEV_OTP_ENABLED: "false",
  TEST_MODE_ENABLED: "false",
  CUSTOMER_OTP_CHANNEL: "whatsapp",
  MSG91_AUTH_KEY: "fake-authkey-never-live",
  MSG91_SMS_OTP_TEMPLATE_ID: "legacy-sms-template-ignored",
  MSG91_WHATSAPP_NUMBER: "918686260603",
  MSG91_WHATSAPP_OTP_TEMPLATE_NAME: "cake_galaxy_login_otp",
  MSG91_WHATSAPP_OTP_TEMPLATE_LANGUAGE: "en"
};

test("WhatsApp login sends proper MSG91 authentication Copy Code components, not SMS", async () => {
  await withProviderEnv(baseEnv, async () => {
    let request;
    globalThis.fetch = async (url, options) => {
      request = { url: String(url), options };
      return new Response(JSON.stringify({
        status: "success", hasError: false, errors: null, request_id: "mock-request-123"
      }), { status: 200 });
    };

    const result = await sendOtp("9876543210");
    assert.equal(result.channel, "whatsapp");
    assert.match(result.code, /^\d{6}$/);
    assert.equal(request.url, "https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/");
    assert.equal(request.options.method, "POST");
    assert.equal(request.options.headers.authkey, "fake-authkey-never-live");
    const payload = JSON.parse(request.options.body);
    assert.equal(payload.integrated_number, "918686260603");
    assert.equal(payload.content_type, "template");
    assert.equal(payload.payload.messaging_product, "whatsapp");
    assert.equal(payload.payload.type, "template");
    assert.equal(payload.payload.template.name, "cake_galaxy_login_otp");
    assert.deepEqual(payload.payload.template.language, { code: "en", policy: "deterministic" });
    assert.deepEqual(payload.payload.template.to_and_components, [{
      to: ["919876543210"],
      components: {
        body_1: { type: "text", value: result.code },
        button_1: { subtype: "url", type: "text", value: result.code }
      }
    }]);
    assert.equal(JSON.stringify(result).includes("fake-authkey"), false);
    assert.equal(JSON.stringify(payload).includes("legacy-sms-template-ignored"), false);
  });
});

test("Reject MSG91 HTTP-200 application errors instead of issuing valid OTP challenges", async () => {
  await withProviderEnv(baseEnv, async () => {
    const errors = [
      { status: "error", hasError: true, errors: [{ message: "Template not approved" }] },
      { status: "success", hasError: true, errors: null },
      { type: "error", message: "Wrong authkey" }
    ];
    for (const body of errors) {
      globalThis.fetch = async () => new Response(JSON.stringify(body), { status: 200 });
      await assert.rejects(sendOtp("9876543210"), e => e.status === 502 && /WhatsApp verification/.test(e.message));
    }
    globalThis.fetch = async () => new Response("Bad gateway", { status: 502 });
    await assert.rejects(sendOtp("9876543210"), e => e.status === 502);
    globalThis.fetch = async () => { throw new Error("Timeout"); };
    await assert.rejects(sendOtp("9876543210"), e => e.status === 502);
  });
});

test("Missing private credentials fail closed and never call MSG91", async () => {
  const env = { ...baseEnv, MSG91_AUTH_KEY: "", MSG91_WHATSAPP_NUMBER: "bad-number" };
  await withProviderEnv(env, async () => {
    globalThis.fetch = async () => { throw new Error("Should not send"); };
    await assert.rejects(sendOtp("9876543210"), e => e.status === 503);
  });
});
