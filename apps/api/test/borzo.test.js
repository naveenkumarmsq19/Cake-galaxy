import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { buildBorzoRequest, bookBorzoForOrder, handleBorzoCallback, verifyBorzoSignature } from "../src/borzo.js";

const env = {
  BORZO_ENABLED: "true", BORZO_ENV: "test", BORZO_API_TOKEN: "private-test-token",
  BORZO_PICKUP_PHONE: "9876543210", BORZO_PAYMENT_METHOD: "balance",
  BORZO_MAX_COST_PAISE: "15000", BORZO_COD_ENABLED: "true",
  BORZO_APPROVED_BRANCH_CODES: "BR99"
};
const branch = { _id: "branch1", code: "BR99", name: "Cake Galaxy", address: "Nagarbhavi Main Road, Bengaluru, Karnataka 560072" };
const date = "2026-11-10";
const now = new Date("2026-11-09T10:00:00+05:30");
const order = () => ({
  _id: "order1", branchId: branch._id, reference: "CG123456",
  status: "preparing", paymentStatus: "paid", paymentMethod: "online",
  amount: 64900, items: [{ size: 1, unit: "kg", quantity: 1 }],
  delivery: { date, slot: "1 PM – 4 PM" },
  address: { name: "Recipient", phone: "9876543211", line1: "9 Main Street", city: "Bengaluru",
    pincode: "560072", location: { lat: 12.974, lng: 77.551 } }
});

test("maps the Cake Galaxy branch and scheduled customer slot into valid Borzo points", () => {
  const request = buildBorzoRequest(order(), branch, env, now);
  assert.equal(request.points.length, 2);
  assert.equal(request.points[0].contact_person.phone, "919876543210");
  assert.equal(request.points[1].contact_person.phone, "919876543211");
  assert.equal(request.points[1].client_order_id, "CG123456");
  assert.equal(request.points[1].latitude, "12.974");
  assert.equal(request.points[0].required_start_datetime, "2026-11-10T11:30:00+05:30");
  assert.equal(request.points[1].required_finish_datetime, "2026-11-10T16:00:00+05:30");
  assert.equal(request.total_weight_kg, 1);
  assert.throws(() => buildBorzoRequest(order(), branch, { ...env, BORZO_APPROVED_BRANCH_CODES: "BR01" }, now), /not approved/);
  assert.equal(request.points[1].taking_amount, undefined);
});

test("COD collection is opt-in and the customer amount is sent in rupees", () => {
  const cod = { ...order(), paymentStatus: "cod_pending", paymentMethod: "cod" };
  assert.throws(() => buildBorzoRequest(cod, branch, { ...env, BORZO_COD_ENABLED: "false" }, now), /COD collection/);
  const request = buildBorzoRequest(cod, branch, env, now);
  assert.equal(request.points[1].taking_amount, "649.00");
  assert.equal(request.points[1].is_cod_cash_voucher_required, true);
});
test("late or oversized orders do not book automatically", () => {
  assert.throws(() => buildBorzoRequest(order(), branch, env, new Date("2026-11-10T13:00:00+05:30")), /too close/);
  assert.throws(() => buildBorzoRequest({ ...order(), items: [{ size: 5, unit: "kg", quantity: 5 }] }, branch, env, now), /capacity/);
});
test("signed callback uses exact request bytes and rejects tampering", () => {
  const secret = "private-callback-secret";
  const body = Buffer.from('{"event_type":"order_changed","order":{"order_id":123}}');
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  assert.equal(verifyBorzoSignature(body, signature, secret), true);
  assert.equal(verifyBorzoSignature(Buffer.from(body.toString() + " "), signature, secret), false);
  assert.equal(verifyBorzoSignature(body, "invalid", secret), false);
});

function store() {
  let value = order();
  let claims = 0;
  return {
    get value() { return value; },
    get claims() { return claims; },
    async findOneAndUpdate(filter, change) {
      claims++;
      if (value.borzo?.state || value.status !== filter.status) return null;
      value = { ...value, borzo: { state: change.$set["borzo.state"] } };
      return value;
    },
    async updateOne(_filter, change) {
      for (const [key, item] of Object.entries(change.$set)) {
        if (key.startsWith("borzo.")) value.borzo[key.slice(6)] = item;
        else value[key] = item;
      }
    },
    async findById() { return value; }
  };
}
const branches = { findById: () => ({ lean: async () => branch }) };
const good = (data) => ({ ok: true, status: 200, json: async () => data });

test("books once after admin acceptance and saves the actual provider ID", async () => {
  const OrderModel = store();
  const paths = [];
  const fetchImpl = async (url, options) => {
    paths.push(url);
    assert.equal(options.headers["X-DV-Auth-Token"], env.BORZO_API_TOKEN);
    return url.endsWith("/calculate-order")
      ? good({ is_successful: true, order: { payment_amount: "99.00" } })
      : good({ is_successful: true, order: { order_id: 81234, status: "available", payment_amount: "99.00" } });
  };
  const result = await bookBorzoForOrder(order(), { OrderModel, BranchModel: branches, env, fetchImpl, now });
  assert.equal(result.borzo.state, "booked");
  assert.equal(result.borzo.orderId, 81234);
  assert.equal(result.borzo.costPaise, 9900);
  assert.equal(paths.length, 2);
  await bookBorzoForOrder(order(), { OrderModel, BranchModel: branches, env, fetchImpl, now });
  assert.equal(paths.length, 2, "repeated acceptance must never call create-order twice");
});

test("a quote over budget blocks create-order, recording a failure", async () => {
  const OrderModel = store();
  let calls = 0;
  const result = await bookBorzoForOrder(order(), { OrderModel, BranchModel: branches, env,
    now, fetchImpl: async () => { calls++; return good({ is_successful: true, order: { payment_amount: "200.00" } }); } });
  assert.equal(calls, 1);
  assert.equal(result.borzo.state, "failed");
  assert.match(result.borzo.error, /budget/);
});

test("lost create-order response is NEVER blindly retried", async () => {
  const OrderModel = store();
  let calls = 0;
  const fetchImpl = async (url) => {
    calls++;
    if (url.endsWith("calculate-order")) return good({ is_successful: true, order: { payment_amount: "75.00" } });
    throw new Error("Timeout");
  };
  const result = await bookBorzoForOrder(order(), { OrderModel, BranchModel: branches, env, fetchImpl, now });
  assert.equal(result.borzo.state, "needs_review");
  await bookBorzoForOrder(order(), { OrderModel, BranchModel: branches, env, fetchImpl, now });
  assert.equal(calls, 2);
});

test("verified delivery callback updates status without changing Cake Galaxy payment status", async () => {
  const state = { ...order(), borzo: { orderId: 81234, state: "booked" } };
  let update;
  const Model = {
    findOne: (filter) => ({ lean: async () => filter["borzo.orderId"] === 81234 ? state : null }),
    updateOne: async (_filter, change) => { update = change.$set; }
  };
  await handleBorzoCallback({ event_type: "delivery_changed", event_datetime: "2026-11-10T15:00:00+05:30",
    delivery: { order_id: 81234, client_order_id: "CG123456", status: "finished", tracking_url: "https://tracking.example/123" } }, Model);
  assert.equal(update["borzo.deliveryStatus"], "finished");
  assert.equal(update["borzo.trackingUrl"], "https://tracking.example/123");
  assert.equal(update.paymentStatus, undefined);
});
