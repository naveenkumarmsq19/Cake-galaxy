import { createHmac, timingSafeEqual } from "node:crypto";
import { Branch, Order } from "./models.js";

const API = {
  test: "https://robotapitest-in.borzodelivery.com/api/business/1.8",
  production: "https://robot-in.borzodelivery.com/api/business/1.8"
};
const slotHours = {
  "10 AM – 1 PM": [10, 13], "1 PM – 4 PM": [13, 16],
  "4 PM – 7 PM": [16, 19], "7 PM – 10 PM": [19, 22]
};

export class BorzoError extends Error {
  constructor(message, uncertain = false) { super(message); this.uncertain = uncertain; }
}
export const borzoEnabled = (env = process.env) => env.BORZO_ENABLED === "true";
const inr = (paise) => (paise / 100).toFixed(2);
const ist = (date) => new Date(date.getTime() + 330 * 60_000).toISOString().slice(0, 19) + "+05:30";
const phone = (value) => {
  const digits = String(value || "").replace(/^\+/, "");
  const result = digits.length === 10 ? "91" + digits : digits;
  if (!/^91[6-9][0-9]{9}$/.test(result)) throw new BorzoError("A valid Indian phone is required for the courier.");
  return result;
};
const amountPaise = (value) => {
  if (typeof value !== "string" && typeof value !== "number") throw new BorzoError("Borzo did not return a valid quote.");
  const text = String(value);
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(text)) throw new BorzoError("Borzo did not return a valid quote.");
  const [rupees, paise = ""] = text.split(".");
  const result = Number(rupees) * 100 + Number(paise.padEnd(2, "0"));
  if (!Number.isSafeInteger(result)) throw new BorzoError("Borzo returned an invalid quote.");
  return result;
};

export function buildBorzoRequest(order, branch, env = process.env, now = new Date()) {
  if (!order || !branch?.address || !order.address?.line1 || !order.address?.pincode)
    throw new BorzoError("Pickup branch or delivery address is incomplete.");
  if (order.testOrder && env.BORZO_ALLOW_TEST_ORDERS !== "true")
    throw new BorzoError("Test orders are not enabled for Borzo.");
  if (!["paid", "cod_pending", "test_cod"].includes(order.paymentStatus))
    throw new BorzoError("Order payment has not been confirmed.");
  const isCod = order.paymentMethod === "cod" || order.paymentStatus === "cod_pending";
  if (isCod && env.BORZO_COD_ENABLED !== "true")
    throw new BorzoError("Borzo COD collection has not been enabled. Use a manual courier.");
  const paymentMethod = env.BORZO_PAYMENT_METHOD || "balance";
  if (!["balance", "cash", "bank_card"].includes(paymentMethod))
    throw new BorzoError("BORZO_PAYMENT_METHOD is invalid.");
  if (paymentMethod === "bank_card" && !/^[1-9]\d*$/.test(env.BORZO_BANK_CARD_ID || ""))
    throw new BorzoError("BORZO_BANK_CARD_ID is required.");
  const slot = slotHours[order.delivery?.slot];
  if (!slot || !/^\d{4}-\d{2}-\d{2}$/.test(order.delivery?.date || ""))
    throw new BorzoError("Delivery date or slot cannot be scheduled.");
  const slotStart = new Date(order.delivery.date + "T" + String(slot[0]).padStart(2, "0") + ":00:00+05:30");
  const slotEnd = new Date(order.delivery.date + "T" + String(slot[1]).padStart(2, "0") + ":00:00+05:30");
  const pickupStart = new Date(slotStart.getTime() - 90 * 60_000);
  const pickupEnd = new Date(slotStart.getTime() - 30 * 60_000);
  if (Number.isNaN(slotStart.getTime()) || pickupEnd.getTime() <= now.getTime() + 5 * 60_000)
    throw new BorzoError("Delivery slot is too close or has passed. Arrange delivery manually.");
  const kilos = (order.items || []).reduce((sum, item) =>
    sum + (item.unit === "kg" ? Number(item.size) * Number(item.quantity) : 0), 0);
  if (!Number.isFinite(kilos) || kilos < 0 || kilos > 20)
    throw new BorzoError("Cake weight exceeds motorbike capacity; arrange a suitable vehicle manually.");
  const request = {
    type: "standard",
    matter: "Fragile birthday or celebration cake. Keep upright. Do not tilt or stack.",
    vehicle_type_id: 8,
    total_weight_kg: Math.max(1, Math.ceil(kilos)),
    is_thermobox_required: env.BORZO_THERMOBOX_ENABLED === "true",
    payment_method: paymentMethod,
    ...(paymentMethod === "bank_card" ? { bank_card_id: Number(env.BORZO_BANK_CARD_ID) } : {}),
    points: [
      { address: branch.address, contact_person: { name: branch.name || "Cake Galaxy", phone: phone(env.BORZO_PICKUP_PHONE) },
        required_start_datetime: ist(pickupStart), required_finish_datetime: ist(pickupEnd) },
      { address: [order.address.line1, order.address.line2, order.address.city, order.address.pincode].filter(Boolean).join(", "),
        contact_person: { name: order.address.name || "Customer", phone: phone(order.address.phone) },
        client_order_id: order.reference,
        required_start_datetime: ist(slotStart), required_finish_datetime: ist(slotEnd),
        ...(order.address.location ? { latitude: String(order.address.location.lat), longitude: String(order.address.location.lng) } : {}),
        note: "Fragile cake. Keep level and deliver within the selected slot.",
        ...(isCod ? { is_cod_cash_voucher_required: true, taking_amount: inr(order.amount) } : {}) }
    ]
  };
  return request;
}

async function borzoPost(path, body, { env = process.env, fetchImpl = fetch } = {}) {
  const base = API[env.BORZO_ENV || "test"];
  if (!base || !env.BORZO_API_TOKEN) throw new BorzoError("Borzo API environment or token is missing.");
  let response;
  try {
    response = await fetchImpl(base + "/" + path, {
      method: "POST", headers: { "X-DV-Auth-Token": env.BORZO_API_TOKEN, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(15000)
    });
  } catch {
    throw new BorzoError("Borzo request timed out or connection failed; check Borzo before retrying.", path === "create-order");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || data.is_successful !== true) {
    const issue = Array.isArray(data?.errors) ? data.errors.slice(0, 3).join(", ") : "request rejected";
    throw new BorzoError("Borzo " + path + " failed: " + issue, path === "create-order" && (response.status >= 500 || !data));
  }
  return data;
}

export async function bookBorzoForOrder(acceptedOrder, {
  OrderModel = Order, BranchModel = Branch, env = process.env,
  fetchImpl = fetch, now = new Date()
} = {}) {
  if (!borzoEnabled(env) || (acceptedOrder.testOrder && env.BORZO_ALLOW_TEST_ORDERS !== "true")) return acceptedOrder;
  // One atomic claim per order. Never expire this lock or blindly retry create-order:
  // a timeout can mean that Borzo created the delivery but we did not receive its ID.
  const claimed = await OrderModel.findOneAndUpdate({
    _id: acceptedOrder._id, status: "preparing", "borzo.state": { $exists: false },
    "cancellation.status": { $nin: ["requested", "approved"] }
  }, { $set: { "borzo.state": "booking", "borzo.startedAt": now, "borzo.environment": env.BORZO_ENV || "test" } }, { new: true });
  if (!claimed) return acceptedOrder;

  let creationAttempted = false;
  try {
    const branch = await BranchModel.findById(claimed.branchId).lean();
    const payload = buildBorzoRequest(claimed, branch, env, now);
    if (!/^\d+$/.test(env.BORZO_MAX_COST_PAISE || "") || Number(env.BORZO_MAX_COST_PAISE) <= 0)
      throw new BorzoError("Set BORZO_MAX_COST_PAISE before enabling automatic bookings.");
    const quotation = await borzoPost("calculate-order", payload, { env, fetchImpl });
    if (quotation.warnings?.length || quotation.parameter_warnings && Object.keys(quotation.parameter_warnings).length)
      throw new BorzoError("Borzo quote returned warnings. Review the pickup and delivery details.");
    const quotePaise = amountPaise(quotation.order?.payment_amount);
    if (quotePaise > Number(env.BORZO_MAX_COST_PAISE))
      throw new BorzoError("Borzo quote exceeds the configured courier budget.");
    await OrderModel.updateOne({ _id: claimed._id, "borzo.state": "booking" }, { $set: { "borzo.quotePaise": quotePaise } });
    creationAttempted = true;
    const result = await borzoPost("create-order", payload, { env, fetchImpl });
    if (!Number.isSafeInteger(result.order?.order_id))
      throw new BorzoError("Borzo response has no order ID; check Borzo before retrying.", true);
    await OrderModel.updateOne({ _id: claimed._id, "borzo.state": "booking" },
      { $set: { "borzo.state": "booked", "borzo.orderId": result.order.order_id, "borzo.status": result.order.status || "new",
        "borzo.bookedAt": new Date(), "borzo.costPaise": amountPaise(result.order.payment_amount ?? inr(quotePaise)) } });
  } catch (error) {
    const uncertain = error instanceof BorzoError ? error.uncertain : creationAttempted;
    await OrderModel.updateOne({ _id: claimed._id, "borzo.state": "booking" },
      { $set: { "borzo.state": uncertain ? "needs_review" : "failed",
        "borzo.error": error instanceof BorzoError ? error.message.slice(0, 250) : "Borzo booking failed. Check the provider dashboard." } });
  }
  return await OrderModel.findById(claimed._id);
}

export function verifyBorzoSignature(rawBody, signature, secret = process.env.BORZO_CALLBACK_SECRET) {
  if (!secret || !Buffer.isBuffer(rawBody) || !/^[a-f0-9]{64}$/i.test(signature || "")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

export async function handleBorzoCallback(event, OrderModel = Order) {
  const payload = event?.delivery || event?.order;
  const id = payload?.order_id;
  const reference = event?.delivery?.client_order_id || event?.order?.points?.find((point) => point.client_order_id)?.client_order_id;
  if (!Number.isSafeInteger(id) && !reference) return;
  const match = Number.isSafeInteger(id) ? await OrderModel.findOne({ "borzo.orderId": id }).lean() : null;
  const order = match || (reference ? await OrderModel.findOne({ reference, "borzo.state": { $in: ["booking", "booked", "needs_review"] } }).lean() : null);
  if (!order || (order.borzo?.orderId != null && order.borzo.orderId !== id)) return;
  const timestamp = Date.parse(event.event_datetime || "");
  if (!Number.isFinite(timestamp)) return;
  if (order.borzo?.eventAt && timestamp < new Date(order.borzo.eventAt).getTime()) return;
  const status = typeof payload.status === "string" ? payload.status.slice(0, 40) : null;
  const tracking = event.delivery?.tracking_url || event.order?.points?.find((p) => p.tracking_url)?.tracking_url;
  const values = { "borzo.eventAt": new Date(timestamp) };
  if (Number.isSafeInteger(id)) values["borzo.orderId"] = id;
  if (order.borzo?.state !== "booked") values["borzo.state"] = "booked";
  if (event.delivery && status) values["borzo.deliveryStatus"] = status;
  else if (status) values["borzo.status"] = status;
  if (typeof tracking === "string" && /^https:\/\//.test(tracking) && tracking.length <= 1000)
    values["borzo.trackingUrl"] = tracking;
  await OrderModel.updateOne({ _id: order._id, "borzo.eventAt": { $not: { $gt: new Date(timestamp) } } }, { $set: values });
}
