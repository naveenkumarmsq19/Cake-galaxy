import test from "node:test";
import assert from "node:assert/strict";
import { invoiceConfigured, merchantGstRegistered, issueInvoice } from "../src/invoice.js";

async function withEnvironment(config, run) {
  const values = Object.fromEntries(Object.keys(config).map(k => [k, process.env[k]]));
  try {
    for (const [key, value] of Object.entries(config)) {
      if (value === null) delete process.env[key]; else process.env[key] = value;
    }
    await run();
  } finally {
    for (const [key,value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

test("non-GST Cake Galaxy allows payment receipts without a fabricated GSTIN", async () => {
  await withEnvironment({
    MERCHANT_GST_REGISTERED: "false",
    MERCHANT_LEGAL_NAME: "Cake Galaxy",
    MERCHANT_GSTIN: null,
    GST_RATE_PERCENT: "0"
  }, async () => {
    assert.equal(merchantGstRegistered(), false);
    assert.equal(invoiceConfigured(), true);
    const chunks = [];
    const response = {
      headers: {}, setHeader(key,value) { this.headers[key] = value; },
      on() {}, once() {}, emit() {}, removeListener() {}, end() {},
      write(chunk) { chunks.push(Buffer.from(chunk)); return true; }
    };
    const order = {
      reference: "CGNONTEST123", updatedAt: new Date("2026-10-24"),
      gst: null, sender: { name: "Buyer" }, address: { name: "Buyer", line1:"Main Road",city:"Bengaluru",pincode:"560072" },
      items: [{ name:"Chocolate Cake",quantity:1,size:0.5,unit:"kg",lineTotal:50000,unitPrice:50000 }],
      subtotal:50000,deliveryFee:4900,tax:0,amount:54900
    };
    assert.equal(issueInvoice(order, response), true);
    assert.equal(response.headers["Content-Type"], "application/pdf");
  });
});

test("non-GST mode fails closed if it would falsely present GST details or charge GST", async () => {
  const safe = { MERCHANT_GST_REGISTERED:"false", MERCHANT_LEGAL_NAME:"Cake Galaxy", MERCHANT_GSTIN:null, GST_RATE_PERCENT:"0" };
  await withEnvironment(safe, async () => {
    assert.equal(invoiceConfigured(), true);
    process.env.MERCHANT_GSTIN = "FAKEGSTIN123";
    assert.equal(invoiceConfigured(), false);
    delete process.env.MERCHANT_GSTIN;
    process.env.GST_RATE_PERCENT = "5";
    assert.equal(invoiceConfigured(), false);
    process.env.GST_RATE_PERCENT = "0";
    process.env.MERCHANT_LEGAL_NAME = "";
    assert.equal(invoiceConfigured(), false);
  });
});

test("GST-registered merchant still needs valid GSTIN to enable invoices", async () => {
  await withEnvironment({
    MERCHANT_GST_REGISTERED:"true", MERCHANT_LEGAL_NAME:"Registered Baker",
    MERCHANT_GSTIN:"29ABCDE1234F1Z5", GST_RATE_PERCENT:"5"
  }, async () => {
    assert.equal(merchantGstRegistered(), true);
    assert.equal(invoiceConfigured(), true);
    delete process.env.MERCHANT_GSTIN;
    assert.equal(invoiceConfigured(), false);
  });
});
