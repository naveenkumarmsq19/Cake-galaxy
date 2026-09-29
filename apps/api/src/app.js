import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import mongoose from "mongoose";
import multer from "multer";
import sharp from "sharp";
import { addons } from "@cake-galaxy/catalog";
import { Customer, Session, LoginChallenge, Product, ServiceArea, Branch, Upload, CustomRequest, Order } from "./models.js";
import { createAdminRouter } from "./admin.js";
import { HttpError, phoneNumber, text, deliveryDate, priceItem, safeCompare } from "./validation.js";
import { razorpay, razorpayConfigured, sendOtp, verifyOtp, validPaymentSignature, validWebhookSignature, sendWhatsApp } from "./providers.js";
import { invoiceConfigured, issueInvoice } from "./invoice.js";

const cookieName = "cg_session";
const hours = 60 * 60 * 1000;
const slots = ["10 AM – 1 PM", "1 PM – 4 PM", "4 PM – 7 PM", "7 PM – 10 PM"];
const hash = (value) => createHash("sha256").update(value).digest("hex");
const merchantReady = () => razorpayConfigured() && invoiceConfigured() && process.env.CATALOG_APPROVED === "true" && process.env.POLICIES_APPROVED === "true";
const returnOrder = (order) => ({ reference: order.reference, amount: order.amount, status: order.status, statusLabel: order.status === "pending_payment" ? "Awaiting payment" : order.status === "confirmed" ? "Order confirmed" : order.status, paymentStatus: order.paymentStatus, deliveryLabel: order.delivery?.date + " · " + order.delivery?.slot, whatsappSent: order.notificationStatus === "sent" });

async function deliveryAssignment(pincode) {
  const area = await ServiceArea.findOne({ pincode, active: true }).lean();
  if (!area?.branchId || !Number.isSafeInteger(area.deliveryFee) || area.deliveryFee < 0) return null;
  const branch = await Branch.findOne({ _id: area.branchId, active: true }).lean();
  return branch ? { area, branch } : null;
}

async function findSession(req) {
  if (!req.cookies?.[cookieName]) return null;
  return Session.findOne({ tokenHash: hash(req.cookies[cookieName]), expiresAt: { $gt: new Date() } }).lean();
}

async function authenticated(req, res, next) {
  try {
    const session = await findSession(req);
    if (!session) throw new HttpError(401, "Please verify your mobile number to continue.");
    req.customer = session.phone;
    if (!["GET", "HEAD"].includes(req.method) && !safeCompare(session.csrfToken, req.get("X-CSRF-Token") || "")) throw new HttpError(403, "Session expired. Please refresh and try again.");
    next();
  } catch (error) { next(error); }
}

async function afterPayment(order) {
  if (!order.whatsappConsent || order.notificationStatus === "sent") return;
  const claimed = await Order.findOneAndUpdate({ _id: order._id, notificationStatus: "pending" }, { $set: { notificationStatus: "processing" } });
  if (!claimed) return;
  const accepted = await sendWhatsApp(order.customerPhone, order.reference);
  await Order.updateOne({ _id: order._id }, { $set: { notificationStatus: accepted ? "sent" : "pending" } });
}

async function confirmCaptured(order, paymentId) {
  if (order.paymentStatus === "paid") { await afterPayment(order).catch(() => {}); return order; }
  const payment = await razorpay("GET", "/payments/" + encodeURIComponent(paymentId));
  if (payment.status !== "captured" || payment.order_id !== order.razorpayOrderId || payment.amount !== order.amount || payment.currency !== "INR") throw new HttpError(409, "Payment is awaiting confirmation. Check My orders before retrying.");
  const changed = await Order.findOneAndUpdate({ _id: order._id, paymentStatus: "pending", razorpayOrderId: order.razorpayOrderId }, { $set: { paymentStatus: "paid", status: "confirmed", razorpayPaymentId: paymentId } }, { new: true });
  const paid = changed || await Order.findById(order._id);
  if (!paid || paid.razorpayPaymentId !== paymentId) throw new HttpError(409, "Payment status needs review. Please contact support.");
  await afterPayment(paid).catch(() => {});
  return paid;
}

export function createApp() {
  const app = express();
  const origins = (process.env.WEB_ORIGINS || process.env.WEB_ORIGIN || "http://localhost:3000")
    .split(",").map((value) => value.trim().replace(/\/$/, "")).filter(Boolean);
  app.disable("x-powered-by");
  if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
  app.use((req, res, next) => { res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin"); next(); });
  app.use(cors({ origin: origins, credentials: true }));
  app.use(cookieParser());

  app.post("/api/webhooks/razorpay", express.raw({ type: "application/json", limit: "1mb" }), async (req, res, next) => {
    try {
      if (!Buffer.isBuffer(req.body) || !validWebhookSignature(req.body, req.get("X-Razorpay-Signature"))) throw new HttpError(401, "Invalid webhook signature.");
      const event = JSON.parse(req.body.toString("utf8"));
      if (!["payment.captured", "order.paid"].includes(event.event)) return res.status(200).json({ received: true });
      const paymentId = event.payload?.payment?.entity?.id;
      const orderId = event.payload?.payment?.entity?.order_id || event.payload?.order?.entity?.id;
      const order = await Order.findOne({ razorpayOrderId: orderId });
      if (order && paymentId) await confirmCaptured(order, paymentId);
      res.json({ received: true });
    } catch (error) { next(error); }
  });

  app.use(express.json({ limit: "64kb" }));
  app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 180, standardHeaders: "draft-8", legacyHeaders: false }));
  app.use("/api", (req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.get("origin") && !origins.includes(req.get("origin"))) return next(new HttpError(403, "Request origin isn't allowed."));
    next();
  });
  app.use("/api/admin", createAdminRouter());

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.get("/api/catalog", async (_req, res) => {
    const catalog = await Product.find({ active: true }, { _id: 0, __v: 0, active: 0 }).lean();
    res.json({ products: catalog, addons });
  });
  app.get("/api/delivery", async (req, res) => {
    const pincode = String(req.query.pincode || "");
    if (!/^[1-9][0-9]{5}$/.test(pincode)) throw new HttpError(400, "Enter a valid 6-digit pincode.");
    const assignment = await deliveryAssignment(pincode);
    res.json(assignment ? { available: true, deliveryFee: assignment.area.deliveryFee, slots } : { available: false });
  });
  app.get("/api/session", async (req, res) => {
    const session = await findSession(req);
    res.setHeader("Cache-Control", "no-store");
    res.json(session ? { authenticated: true, phone: session.phone, csrfToken: session.csrfToken } : { authenticated: false, phone: "", csrfToken: "" });
  });

  const otpLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: "draft-8", legacyHeaders: false });
  app.post("/api/auth/otp", otpLimit, async (req, res) => {
    const phone = phoneNumber(req.body?.phone);
    if (await LoginChallenge.countDocuments({ phone, createdAt: { $gt: new Date(Date.now() - 15 * 60_000) } }) >= 5) throw new HttpError(429, "Please try this number again later.");
    const recent = await LoginChallenge.findOne({ phone, createdAt: { $gt: new Date(Date.now() - 30_000) } });
    if (recent) throw new HttpError(429, "Please wait before requesting another code.");
    const sent = await sendOtp(phone);
    const requestId = randomUUID();
    const codeHash = sent.code ? hash(requestId + ":" + sent.code) : null;
    await LoginChallenge.create({ requestId, phone, codeHash, expiresAt: new Date(Date.now() + 5 * 60_000) });
    res.status(201).json({ sent: true, requestId, retryAfter: 30 });
  });
  app.post("/api/auth/verify", otpLimit, async (req, res) => {
    const requestId = text(req.body?.requestId, 60);
    const otp = text(req.body?.otp, 6);
    if (!/^[0-9]{6}$/.test(otp)) throw new HttpError(400, "Enter your 6-digit verification code.");
    const challenge = await LoginChallenge.findOneAndUpdate({ requestId, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } }, { $inc: { attempts: 1 } }, { new: true });
    if (!challenge) throw new HttpError(400, "This code has expired. Request a new one.");
    if (challenge.codeHash) {
      if (process.env.NODE_ENV === "production" || !safeCompare(challenge.codeHash, hash(requestId + ":" + otp))) throw new HttpError(400, "That code is incorrect.");
    } else await verifyOtp(challenge.phone, otp);
    const consumed = await LoginChallenge.deleteOne({ _id: challenge._id });
    if (consumed.deletedCount !== 1) throw new HttpError(409, "That code has already been used. Request a new one.");
    await Customer.updateOne({ phone: challenge.phone }, { $setOnInsert: { phone: challenge.phone } }, { upsert: true });
    const token = randomBytes(32).toString("hex");
    const csrfToken = randomBytes(24).toString("hex");
    await Session.create({ tokenHash: hash(token), phone: challenge.phone, csrfToken, expiresAt: new Date(Date.now() + 30 * 24 * hours) });
    const secure = process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true";
    res.cookie(cookieName, token, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 30 * 24 * hours });
    res.json({ authenticated: true, phone: challenge.phone, csrfToken });
  });
  app.post("/api/auth/logout", authenticated, async (req, res) => {
    await Session.deleteOne({ tokenHash: hash(req.cookies[cookieName]) });
    res.clearCookie(cookieName, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true", path: "/" });
    res.json({ authenticated: false });
  });

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, next) => next(null, ["image/jpeg", "image/png"].includes(file.mimetype)) });
  app.post("/api/uploads", authenticated, upload.single("reference"), async (req, res) => {
    if (!req.file) throw new HttpError(400, "Choose a JPG or PNG image.");
    let converted;
    try { converted = await sharp(req.file.buffer, { limitInputPixels: 20_000_000 }).rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer(); }
    catch { throw new HttpError(400, "That image could not be opened. Choose another JPG or PNG."); }
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "customerUploads" });
    const stream = bucket.openUploadStream(randomUUID() + ".jpg", { contentType: "image/jpeg", metadata: { phone: req.customer } });
    await pipeline(Readable.from([converted]), stream);
    const id = randomUUID();
    await Upload.create({ id, ownerPhone: req.customer, fileId: stream.id, contentType: "image/jpeg" });
    res.status(201).json({ id });
  });

  app.post("/api/custom-requests", authenticated, async (req, res) => {
    const body = req.body || {};
    const pincode = text(body.customPincode, 6);
    if (!/^[1-9][0-9]{5}$/.test(pincode)) throw new HttpError(400, "Enter a valid pincode.");
    const assignment = await deliveryAssignment(pincode);
    if (!assignment) throw new HttpError(400, "We can't deliver to this pincode yet.");
    if (phoneNumber(body.customPhone) !== req.customer) throw new HttpError(400, "Verify the mobile number used for this request.");
    if (body.uploadId && !await Upload.findOne({ id: body.uploadId, ownerPhone: req.customer })) throw new HttpError(400, "The reference image was not found.");
    if (!body.uploadId && !body.sample) throw new HttpError(400, "Upload a design or choose a sample style.");
    const reference = "CGC" + randomBytes(5).toString("hex").toUpperCase();
    const budget = body.budget ? Number(body.budget) : null;
    if (budget !== null && (!Number.isSafeInteger(budget) || budget < 0 || budget > 1_000_000)) throw new HttpError(400, "Check the budget entered.");
    await CustomRequest.create({ reference, ownerPhone: req.customer, uploadId: body.uploadId || null, sample: text(body.sample || "", 80, false), occasion: text(body.occasion, 60), weight: text(body.weight, 40), flavour: text(body.flavour, 60), budget, notes: text(body.notes || "", 2000, false), requiredDate: deliveryDate(body.requiredDate), customPincode: pincode, customPhone: req.customer, branchId: assignment.branch._id });
    res.status(201).json({ reference });
  });

  app.get("/api/checkout/config", (_req, res) => res.json({ paymentsEnabled: merchantReady(), keyId: merchantReady() ? process.env.RAZORPAY_KEY_ID : "", taxRate: merchantReady() ? Number(process.env.GST_RATE_PERCENT) : null }));

  app.post("/api/checkout/orders", authenticated, async (req, res) => {
    if (!merchantReady()) throw new HttpError(503, "Online payments are unavailable. No payment has been taken.");
    const body = req.body || {};
    const idempotencyKey = text(body.idempotencyKey, 64);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) throw new HttpError(400, "Please refresh checkout and try again.");
    const existing = await Order.findOne({ customerPhone: req.customer, idempotencyKey });
    if (existing) {
      if (!existing.razorpayOrderId) throw new HttpError(409, "Order is being prepared. Please check My orders before retrying.");
      return res.json({ reference: existing.reference, orderId: existing.razorpayOrderId, amount: existing.amount, currency: "INR" });
    }
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30) throw new HttpError(400, "Add a cake to your bag first.");
    const sender = body.sender || {};
    if (phoneNumber(sender.phone) !== req.customer) throw new HttpError(400, "Verify your mobile number before placing the order.");
    const senderName = text(sender.name, 80);
    const address = body.address || {};
    const recipientPhone = phoneNumber(address.phone);
    const pincode = text(address.pincode, 6);
    if (!/^[1-9][0-9]{5}$/.test(pincode)) throw new HttpError(400, "Enter a valid delivery pincode.");
    const assignment = await deliveryAssignment(pincode);
    if (!assignment) throw new HttpError(400, "Delivery isn't available at that pincode.");
    const { area, branch } = assignment;
    const delivery = { date: deliveryDate(body.delivery?.date), slot: text(body.delivery?.slot, 40) };
    if (!slots.includes(delivery.slot)) throw new HttpError(400, "Choose an available delivery time.");
    const productIds = body.items.map((item) => text(item.productId, 80));
    const available = await Product.find({ id: { $in: productIds }, active: true }).lean();
    const byId = new Map(available.map((product) => [product.id, product]));
    const items = [];
    for (const item of body.items) {
      const priced = priceItem(item, byId.get(item.productId));
      if (byId.get(item.productId).photo) {
        if (!item.uploadId || !await Upload.findOne({ id: item.uploadId, ownerPhone: req.customer })) throw new HttpError(400, "Add a photo for the photo cake.");
      } else if (item.uploadId) throw new HttpError(400, "This cake doesn't accept a photo.");
      items.push(priced);
    }
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const rate = Number(process.env.GST_RATE_PERCENT || "0");
    if (!Number.isFinite(rate) || rate < 0 || rate > 30) throw new HttpError(503, "Tax settings need attention. No payment has been taken.");
    const tax = Math.round(subtotal * rate / 100);
    const amount = subtotal + area.deliveryFee + tax;
    if (!Number.isSafeInteger(amount) || amount < 100 || amount > 100_000_000) throw new HttpError(400, "Order total cannot be confirmed.");
    let gst = null;
    if (body.gst) {
      gst = { gstin: text(body.gst.gstin, 15).toUpperCase(), business: text(body.gst.business, 120), billingAddress: text(body.gst.billingAddress, 250) };
      if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gst.gstin)) throw new HttpError(400, "Enter a valid GSTIN.");
    }
    const reference = "CG" + randomBytes(8).toString("hex").toUpperCase();
    const order = await Order.create({ reference, customerPhone: req.customer, sender: { name: senderName, phone: req.customer }, idempotencyKey, items, branchId: branch._id,
      assignmentHistory: [{ from: null, to: branch._id, reason: "pincode", at: new Date() }],
      address: { name: text(address.name, 80), phone: recipientPhone, line1: text(address.line1, 160), line2: text(address.line2 || "", 160, false), pincode, city: text(address.city, 60) },
      delivery, gst, subtotal, deliveryFee: area.deliveryFee, tax, amount, currency: "INR", whatsappConsent: address.whatsapp === true });
    const providerOrder = await razorpay("POST", "/orders", { amount, currency: "INR", receipt: reference, notes: { reference } });
    if (!providerOrder.id || providerOrder.amount !== amount || providerOrder.currency !== "INR") throw new HttpError(502, "Payment order could not be confirmed. Please check My orders.");
    order.razorpayOrderId = providerOrder.id;
    await order.save();
    res.status(201).json({ reference, orderId: providerOrder.id, amount, currency: "INR" });
  });

  app.post("/api/checkout/verify", authenticated, async (req, res) => {
    const reference = text(req.body?.reference, 40);
    const order = await Order.findOne({ reference, customerPhone: req.customer });
    if (!order?.razorpayOrderId) throw new HttpError(404, "Order not found.");
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
    if (order.razorpayOrderId !== orderId || !validPaymentSignature(order.razorpayOrderId, paymentId, signature)) throw new HttpError(403, "Payment verification failed. Check My orders.");
    const paid = await confirmCaptured(order, paymentId);
    res.json({ status: "paid", order: returnOrder(paid) });
  });

  app.get("/api/orders", authenticated, async (req, res) => {
    const orders = await Order.find({ customerPhone: req.customer }).sort({ createdAt: -1 }).limit(50).lean();
    res.json({ orders: orders.map(returnOrder) });
  });
  app.get("/api/orders/:reference", authenticated, async (req, res) => {
    const order = await Order.findOne({ reference: req.params.reference, customerPhone: req.customer }).lean();
    if (!order) throw new HttpError(404, "Order not found.");
    res.json({ order: returnOrder(order) });
  });
  app.get("/api/orders/:reference/invoice", authenticated, async (req, res) => {
    const order = await Order.findOne({ reference: req.params.reference, customerPhone: req.customer }).lean();
    if (!order) throw new HttpError(404, "Order not found.");
    if (order.paymentStatus !== "paid") throw new HttpError(409, "Invoice will be available after payment confirmation.");
    if (!issueInvoice(order, res)) throw new HttpError(503, "GST invoice details haven't been configured yet.");
  });
  app.post("/api/orders/:reference/cancellation", authenticated, async (req, res) => {
    const order = await Order.findOneAndUpdate({ reference: req.params.reference, customerPhone: req.customer, paymentStatus: "paid", status: { $nin: ["delivered", "cancelled"] }, cancellation: { $exists: false } },
      { $set: { cancellation: { reason: text(req.body?.reason || "", 300, false), requestedAt: new Date(), status: "requested" } } }, { new: true });
    if (!order) throw new HttpError(409, "This order can't accept a cancellation request. Please contact support.");
    res.status(201).json({ reference: order.reference, status: "requested" });
  });

  app.use((_req, _res, next) => next(new HttpError(404, "Page not found.")));
  app.use((error, req, res, _next) => {
    const status = error.status || (error.code === 11000 ? 409 : error instanceof multer.MulterError ? 400 : 500);
    const message = status === 500 ? "Something went wrong. Please try again." : error.code === 11000 ? (req.path.startsWith("/api/admin") ? "That record already exists." : "That request has already been submitted. Check My orders.") : error.message;
    if (status === 500) console.error(error);
    if (!res.headersSent) res.status(status).json({ error: message });
  });
  return app;
}
