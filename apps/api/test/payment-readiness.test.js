import test from "node:test";
import assert from "node:assert/strict";
import { paymentReadiness } from "../src/paymentReadiness.js";

async function withEnv(vars, fn) {
  const existing = Object.fromEntries(Object.keys(vars).map(k => [k, process.env[k]]));
  try {
    for (const [key, value] of Object.entries(vars)) {
      if (value === null) delete process.env[key];
      else process.env[key] = value;
    }
    await fn();
  } finally {
    for (const [key,value] of Object.entries(existing)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const safeNonGst = {
  RAZORPAY_KEY_ID: "rzp_test_dummy",
  RAZORPAY_KEY_SECRET: "dummy-private-key",
  RAZORPAY_WEBHOOK_SECRET: "dummy-webhook-secret",
  MERCHANT_GST_REGISTERED: "false",
  MERCHANT_GSTIN: null,
  MERCHANT_LEGAL_NAME: "Cake Galaxy",
  GST_RATE_PERCENT: "0",
  CATALOG_APPROVED: "true",
  POLICIES_APPROVED: "true"
};

test("reports all readiness gates for configured non-GST checkout without leaking secrets", async () => {
  await withEnv(safeNonGst, async () => {
    assert.deepEqual(paymentReadiness(), { ready: true, missing: [] });
    assert.equal(JSON.stringify(paymentReadiness()).includes("dummy"), false);
  });
});

test("payment stays off when activation approvals or payment secrets are missing", async () => {
  await withEnv({ ...safeNonGst, CATALOG_APPROVED:"false", POLICIES_APPROVED:"false", RAZORPAY_WEBHOOK_SECRET:"" }, async () => {
    const status = paymentReadiness();
    assert.equal(status.ready, false);
    assert.deepEqual(status.missing, ["razorpay_webhook", "catalogue_approved", "policies_approved"]);
  });
});

test("unregistered GST mode cannot mask invalid merchant receipt configuration", async () => {
  await withEnv({ ...safeNonGst, MERCHANT_LEGAL_NAME:"", MERCHANT_GSTIN:"fake-gstin", GST_RATE_PERCENT:"18" }, async () => {
    const status = paymentReadiness();
    assert.equal(status.ready, false);
    assert.deepEqual(status.missing, ["merchant_legal_name", "receipt_or_tax_invoice_configuration"]);
  });
});
