import { randomUUID } from "node:crypto";
import { Order } from "./models.js";
import { HttpError, text } from "./validation.js";
import { razorpay } from "./providers.js";

export const reasons = Object.freeze({
  changed_mind: "Changed my mind",
  ordered_by_mistake: "Ordered by mistake",
  wrong_order: "Wrong cake or details",
  delivery_issue: "Delivery timing or address issue",
  other: "Other reason"
});

export function parseCancellation(body) {
  const category = text(body?.category || "other", 40);
  if (!Object.hasOwn(reasons, category)) throw new HttpError(400, "Select a valid cancellation reason.");
  const reason = text(body?.reason, 300);
  if (reason.length < 10) throw new HttpError(400, "Please explain your cancellation in at least 10 characters.");
  return { category, reason, requestedAt: new Date(), status: "requested" };
}
export function visibleCancellation(c) {
  if (!c) return null;
  return {
    status: c.status, category: c.category || "other", reason: c.reason || "",
    requestedAt: c.requestedAt, reviewedAt: c.reviewedAt, reviewReason: c.reviewReason || null,
    refund: c.refund ? { status: c.refund.status, amount: c.refund.amount, id: c.refund.id || null, updatedAt: c.refund.updatedAt } : null
  };
}
export function verifyRefund(result, payment, amount) {
  if (!result || !/^rfnd_[A-Za-z0-9]+$/.test(result.id || "") || result.payment_id !== payment ||
      result.amount !== amount || result.currency !== "INR" ||
      !["pending", "processed", "failed"].includes(result.status)) {
    throw new HttpError(502, "Refund result is uncertain. Check Razorpay before any retry.");
  }
  return result.status;
}
export function registerCancellationAdminRoutes(router, requireSuper, visibleOrder) {
  router.post("/orders/:reference/cancellation-approval", requireSuper, async (req, res) => {
    const reference = text(req.params.reference, 40);
    const current = await Order.findOne({ reference, "cancellation.status": "requested" }).lean();
    if (!current || !["paid", "test_cod"].includes(current.paymentStatus) ||
      ["delivered", "cancelled"].includes(current.status)) throw new HttpError(409, "Cancellation request has already changed.");
    if (current.paymentStatus === "paid" && !current.razorpayPaymentId) throw new HttpError(409, "Captured payment ID missing; contact support.");
    const now = new Date();
    const refund = current.paymentStatus === "test_cod"
      ? { status: "not_required", amount: 0, updatedAt: now }
      : { status: "ready", amount: current.amount, idempotencyKey: randomUUID(), updatedAt: now };
    const order = await Order.findOneAndUpdate({
      _id: current._id, status: current.status, paymentStatus: current.paymentStatus, "cancellation.status": "requested"
    }, { $set: {
      status: "cancelled", "cancellation.status": "approved",
      "cancellation.reviewedAt": now, "cancellation.reviewedBy": req.admin._id,
      "cancellation.refund": refund
    } }, { new: true });
    if (!order) throw new HttpError(409, "Order changed. Refresh before proceeding.");
    res.json({ order: visibleOrder(order) });
  });
  router.post("/orders/:reference/cancellation-refund", requireSuper, async (req, res) => {
    const reference = text(req.params.reference, 40);
    const order = await Order.findOneAndUpdate({
      reference, status: "cancelled", paymentStatus: "paid", "cancellation.status": "approved",
      "cancellation.refund.status": "ready", razorpayPaymentId: { $exists: true }
    }, { $set: { "cancellation.refund.status": "processing", "cancellation.refund.updatedAt": new Date() } }, { new: true });
    if (!order) throw new HttpError(409, "Refund is unavailable or has already been initiated. Refresh the order.");
    const { idempotencyKey: key, amount } = order.cancellation.refund;
    if (!key || amount !== order.amount || !order.razorpayPaymentId) {
      await Order.updateOne({ _id: order._id, "cancellation.refund.status": "processing" },
        { $set: { "cancellation.refund.status": "failed" } });
      throw new HttpError(409, "Refund configuration is invalid; contact support.");
    }
    let result;
    try {
      result = await razorpay("POST", "/payments/" + encodeURIComponent(order.razorpayPaymentId) + "/refund",
        { amount, speed: "normal", notes: { order_reference: reference } }, { "X-Refund-Idempotency": key });
      verifyRefund(result, order.razorpayPaymentId, amount);
    } catch (error) {
      // Same saved idempotency key MUST be retained when provider response is uncertain.
      await Order.updateOne({ _id: order._id, "cancellation.refund.status": "processing", "cancellation.refund.idempotencyKey": key },
        { $set: { "cancellation.refund.status": "ready", "cancellation.refund.updatedAt": new Date() } });
      throw error;
    }
    const fields = {
      "cancellation.refund.id": result.id, "cancellation.refund.status": result.status,
      "cancellation.refund.updatedAt": new Date()
    };
    if (result.status === "processed") { fields.paymentStatus = "refunded"; fields["cancellation.refundedAt"] = new Date(); }
    const updated = await Order.findOneAndUpdate({
      _id: order._id, "cancellation.refund.status": "processing", "cancellation.refund.idempotencyKey": key
    }, { $set: fields }, { new: true });
    if (!updated) throw new HttpError(409, "Refund was submitted; status changed. Reconcile in Razorpay before any retry.");
    res.json({ order: visibleOrder(updated) });
  });
  router.post("/orders/:reference/cancellation-refund-refresh", requireSuper, async (req, res) => {
    const reference = text(req.params.reference, 40);
    const order = await Order.findOne({ reference, "cancellation.status": "approved", "cancellation.refund.id": { $exists: true } }).lean();
    if (!order || order.testOrder || !["paid", "refunded"].includes(order.paymentStatus))
      throw new HttpError(409, "No payment refund to refresh.");
    const refund = order.cancellation.refund;
    const result = await razorpay("GET", "/refunds/" + encodeURIComponent(refund.id));
    const status = verifyRefund(result, order.razorpayPaymentId, refund.amount);
    const fields = { "cancellation.refund.status": status, "cancellation.refund.updatedAt": new Date() };
    if (status === "processed") { fields.paymentStatus = "refunded"; fields["cancellation.refundedAt"] = new Date(); }
    const updated = await Order.findOneAndUpdate({
      _id: order._id, "cancellation.refund.id": refund.id, "cancellation.refund.status": { $ne: "processed" }
    }, { $set: fields }, { new: true });
    res.json({ order: visibleOrder(updated || order) });
  });
}
export async function applyRefundWebhook(event) {
  if (!["refund.processed", "refund.failed"].includes(event?.event)) return;
  const r = event.payload?.refund?.entity;
  if (!r?.id || !r?.payment_id || !Number.isSafeInteger(r.amount) || r.currency !== "INR") return;
  const status = event.event === "refund.processed" ? "processed" : "failed";
  const fields = { "cancellation.refund.status": status, "cancellation.refund.updatedAt": new Date() };
  if (status === "processed") { fields.paymentStatus = "refunded"; fields["cancellation.refundedAt"] = new Date(); }
  await Order.updateOne({
    razorpayPaymentId: r.payment_id, "cancellation.refund.id": r.id, "cancellation.refund.amount": r.amount,
    "cancellation.refund.status": { $nin: ["processed", "failed"] },
    "cancellation.status": "approved", paymentStatus: "paid"
  }, { $set: fields });
}
