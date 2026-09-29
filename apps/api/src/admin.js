import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { createHash, randomBytes, scrypt as rawScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import mongoose from "mongoose";
import { AdminSession, AdminUser, Branch, CustomRequest, Order, Product, ServiceArea, Upload } from "./models.js";
import { HttpError, text } from "./validation.js";

const scrypt = promisify(rawScrypt);
const cookieName = "cg_admin_session";
const cookiePath = "/api/admin";
const days = 7 * 24 * 60 * 60 * 1000;
const digest = (value) => createHash("sha256").update(value).digest("hex");
const pin = (value) => {
  const result = text(value, 6);
  if (!/^[1-9][0-9]{5}$/.test(result)) throw new HttpError(400, "Enter a valid 6-digit pincode.");
  return result;
};
const objectId = (value) => {
  if (!/^[0-9a-f]{24}$/i.test(String(value))) throw new HttpError(400, "Invalid identifier.");
  return value;
};
const money = (value) => {
  if (!Number.isSafeInteger(value) || value < 0 || value > 100_000_000) throw new HttpError(400, "Enter a valid amount in paise.");
  return value;
};
const emailAddress = (value) => {
  const result = text(value, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw new HttpError(400, "Enter a valid email address.");
  return result;
};
const visibleUser = (user) => ({ id: String(user._id), name: user.name, email: user.email, role: user.role, branchId: user.branchId ? String(user.branchId) : null, active: user.active });
const visibleOrder = (order) => ({ reference: order.reference, branchId: String(order.branchId || ""), customerPhone: order.customerPhone, sender: order.sender, items: order.items, address: order.address, delivery: order.delivery, amount: order.amount, subtotal: order.subtotal, deliveryFee: order.deliveryFee, tax: order.tax, status: order.status, paymentStatus: order.paymentStatus, testOrder: order.testOrder === true, cancellation: order.cancellation, assignmentHistory: order.assignmentHistory, createdAt: order.createdAt, updatedAt: order.updatedAt });
const scoped = (req) => req.admin.role === "super_admin" ? {} : { branchId: req.admin.branchId };

export async function hashPassword(password) {
  if (typeof password !== "string" || password.length < 12 || password.length > 128) throw new HttpError(400, "Password must be 12–128 characters.");
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return salt + ":" + key.toString("hex");
}

async function passwordMatches(password, saved) {
  const [salt, hex] = (saved || "").split(":");
  if (!salt || !/^[0-9a-f]{32}$/.test(salt) || !/^[0-9a-f]{128}$/.test(hex || "")) return false;
  const key = await scrypt(String(password || ""), salt, 64);
  return timingSafeEqual(key, Buffer.from(hex, "hex"));
}

async function requireAdmin(req, _res, next) {
  try {
    const raw = req.cookies?.[cookieName];
    if (!raw || !/^[0-9a-f]{64}$/.test(raw)) throw new HttpError(401, "Admin sign in required.");
    const session = await AdminSession.findOne({ tokenHash: digest(raw), expiresAt: { $gt: new Date() } }).lean();
    if (!session) throw new HttpError(401, "Admin session expired. Sign in again.");
    const user = await AdminUser.findById(session.userId).lean();
    if (!user?.active || (user.role === "branch_manager" && !user.branchId)) throw new HttpError(403, "This admin account is disabled.");
    if (!["GET", "HEAD"].includes(req.method)) {
      const received = req.get("X-CSRF-Token") || "";
      if (!/^[0-9a-f]{48}$/.test(received) || !timingSafeEqual(Buffer.from(received), Buffer.from(session.csrfToken))) throw new HttpError(403, "Refresh the admin page and try again.");
    }
    req.admin = user;
    req.adminSession = session;
    next();
  } catch (error) { next(error); }
}

function requireSuper(req, _res, next) {
  if (req.admin.role !== "super_admin") return next(new HttpError(403, "Super Admin access required."));
  next();
}

export function createAdminRouter() {
  const router = Router();
  const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 6, standardHeaders: "draft-8", legacyHeaders: false });
  router.post("/login", loginLimit, async (req, res) => {
    const email = emailAddress(req.body?.email);
    const password = req.body?.password;
    if (typeof password !== "string" || password.length > 128) throw new HttpError(400, "Enter your password.");
    const user = await AdminUser.findOne({ email, active: true }).lean();
    if (!user || !await passwordMatches(password, user.passwordHash)) throw new HttpError(401, "Incorrect email or password.");
    const token = randomBytes(32).toString("hex");
    const csrfToken = randomBytes(24).toString("hex");
    await AdminSession.create({ tokenHash: digest(token), userId: user._id, csrfToken, expiresAt: new Date(Date.now() + days) });
    res.cookie(cookieName, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true", path: cookiePath, maxAge: days });
    res.setHeader("Cache-Control", "no-store");
    res.json({ user: visibleUser(user), csrfToken });
  });
  router.use(requireAdmin);
  router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
  router.get("/me", (req, res) => res.json({ user: visibleUser(req.admin), csrfToken: req.adminSession.csrfToken }));
  router.post("/logout", async (req, res) => {
    await AdminSession.deleteOne({ _id: req.adminSession._id });
    res.clearCookie(cookieName, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true", path: cookiePath });
    res.json({ signedOut: true });
  });

  router.get("/summary", async (req, res) => {
    const scope = scoped(req);
    const [orders, pending, requests, revenue] = await Promise.all([
      Order.countDocuments(scope),
      Order.countDocuments({ ...scope, status: { $in: ["confirmed", "preparing", "out_for_delivery"] } }),
      CustomRequest.countDocuments({ ...scope, status: "requested" }),
      Order.aggregate([{ $match: { ...scope, paymentStatus: "paid" } }, { $group: { _id: null, amount: { $sum: "$amount" } } }])
    ]);
    res.json({ orders, pending, requests, revenue: revenue[0]?.amount || 0 });
  });

  router.get("/branches", async (req, res) => {
    const branches = await Branch.find(req.admin.role === "super_admin" ? {} : { _id: req.admin.branchId }).sort({ code: 1 }).lean();
    res.json({ branches });
  });
  router.post("/branches", requireSuper, async (req, res) => {
    const code = text(req.body?.code, 24).toUpperCase();
    if (!/^[A-Z0-9_-]{2,24}$/.test(code)) throw new HttpError(400, "Branch code must contain 2–24 letters or numbers.");
    const basePincode = pin(req.body?.basePincode);
    if (await Branch.exists({ basePincode })) throw new HttpError(409, "A branch already has that base pincode.");
    const branch = await Branch.create({ code, name: text(req.body?.name, 80), address: text(req.body?.address, 250), basePincode, radiusKm: 5, active: false });
    res.status(201).json({ branch });
  });
  router.patch("/branches/:id", requireSuper, async (req, res) => {
    const changes = {};
    for (const field of ["name", "address"]) if (req.body?.[field] !== undefined) changes[field] = text(req.body[field], field === "name" ? 80 : 250);
    if (req.body?.basePincode !== undefined) {
      changes.basePincode = pin(req.body.basePincode);
      if (await Branch.exists({ _id: { $ne: objectId(req.params.id) }, basePincode: changes.basePincode })) throw new HttpError(409, "A branch already has that base pincode.");
    }
    if (req.body?.active !== undefined) {
      if (typeof req.body.active !== "boolean") throw new HttpError(400, "Invalid branch status.");
      changes.active = req.body.active;
    }
    if (!Object.keys(changes).length) throw new HttpError(400, "No branch changes supplied.");
    const branch = await Branch.findByIdAndUpdate(objectId(req.params.id), { $set: changes }, { new: true, runValidators: true });
    if (!branch) throw new HttpError(404, "Branch not found.");
    res.json({ branch });
  });

  router.get("/service-areas", async (req, res) => {
    const areas = await ServiceArea.find(scoped(req)).sort({ pincode: 1 }).lean();
    res.json({ areas });
  });
  router.put("/service-areas/:pincode", requireSuper, async (req, res) => {
    const pincode = pin(req.params.pincode);
    const branchId = objectId(req.body?.branchId);
    const branch = await Branch.findById(branchId).lean();
    if (!branch) throw new HttpError(404, "Branch not found.");
    const active = req.body?.active === undefined ? true : req.body.active;
    if (typeof active !== "boolean") throw new HttpError(400, "Invalid service area status.");
    const area = await ServiceArea.findOneAndUpdate({ pincode }, { $set: { branchId: branch._id, deliveryFee: money(req.body?.deliveryFee), active } }, { new: true, upsert: true, runValidators: true });
    res.json({ area });
  });
  router.delete("/service-areas/:pincode", requireSuper, async (req, res) => {
    const area = await ServiceArea.findOneAndUpdate({ pincode: pin(req.params.pincode) }, { $set: { active: false } }, { new: true });
    if (!area) throw new HttpError(404, "Pincode not found.");
    res.json({ area });
  });

  router.get("/managers", requireSuper, async (_req, res) => {
    const users = await AdminUser.find({}, { passwordHash: 0 }).sort({ createdAt: -1 }).lean();
    res.json({ users: users.map(visibleUser) });
  });
  router.post("/managers", requireSuper, async (req, res) => {
    const branchId = objectId(req.body?.branchId);
    if (!await Branch.exists({ _id: branchId })) throw new HttpError(404, "Branch not found.");
    const user = await AdminUser.create({ email: emailAddress(req.body?.email), name: text(req.body?.name, 80), passwordHash: await hashPassword(req.body?.password), role: "branch_manager", branchId, active: true });
    res.status(201).json({ user: visibleUser(user) });
  });
  router.patch("/managers/:id", requireSuper, async (req, res) => {
    const user = await AdminUser.findOne({ _id: objectId(req.params.id), role: "branch_manager" });
    if (!user) throw new HttpError(404, "Branch Manager not found.");
    if (req.body?.branchId !== undefined) {
      const branchId = objectId(req.body.branchId);
      if (!await Branch.exists({ _id: branchId })) throw new HttpError(404, "Branch not found.");
      user.branchId = branchId;
    }
    if (req.body?.active !== undefined) {
      if (typeof req.body.active !== "boolean") throw new HttpError(400, "Invalid account status.");
      user.active = req.body.active;
    }
    if (req.body?.password !== undefined) user.passwordHash = await hashPassword(req.body.password);
    await user.save();
    await AdminSession.deleteMany({ userId: user._id });
    res.json({ user: visibleUser(user) });
  });

  router.get("/orders", async (req, res) => {
    const status = req.query.status ? text(req.query.status, 40) : "";
    const filter = { ...scoped(req), ...(status ? { status } : {}) };
    if (req.admin.role === "super_admin" && req.query.branchId) filter.branchId = objectId(req.query.branchId);
    const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    res.json({ orders: orders.map(visibleOrder) });
  });
  router.patch("/orders/:reference/status", async (req, res) => {
    const next = text(req.body?.status, 32);
    const allowed = { confirmed: "preparing", preparing: "out_for_delivery", out_for_delivery: "delivered" };
    const previous = Object.keys(allowed).find((key) => allowed[key] === next);
    if (!previous) throw new HttpError(400, "Invalid order transition.");
    const order = await Order.findOneAndUpdate({ reference: text(req.params.reference, 40), ...scoped(req), status: previous, paymentStatus: { $in: ["paid", "test_cod"] }, "cancellation.status": { $ne: "requested" } }, { $set: { status: next } }, { new: true });
    if (!order) throw new HttpError(409, "Order not found or its status has changed.");
    res.json({ order: visibleOrder(order) });
  });
  router.post("/orders/:reference/cancellation-rejection", requireSuper, async (req, res) => {
    const reason = text(req.body?.reason, 300);
    const order = await Order.findOneAndUpdate({ reference: text(req.params.reference, 40), "cancellation.status": "requested", paymentStatus: { $in: ["paid", "test_cod"] } },
      { $set: { "cancellation.status": "rejected", "cancellation.reviewedAt": new Date(), "cancellation.reviewedBy": req.admin._id, "cancellation.reviewReason": reason } }, { new: true });
    if (!order) throw new HttpError(409, "Cancellation request has already changed.");
    res.json({ order: visibleOrder(order) });
  });
  router.post("/orders/:reference/reassign", requireSuper, async (req, res) => {
    const reference = text(req.params.reference, 40);
    const reason = text(req.body?.reason, 300);
    const target = await Branch.findOne({ _id: objectId(req.body?.branchId), active: true }).lean();
    if (!target) throw new HttpError(404, "Active destination branch not found.");
    const current = await Order.findOne({ reference }).lean();
    if (!current) throw new HttpError(404, "Order not found.");
    if (["delivered", "cancelled"].includes(current.status)) throw new HttpError(409, "Completed orders cannot be reassigned.");
    if (String(current.branchId) === String(target._id)) throw new HttpError(409, "Order is already assigned to that branch.");
    const order = await Order.findOneAndUpdate({ _id: current._id, branchId: current.branchId, status: current.status }, { $set: { branchId: target._id }, $push: { assignmentHistory: { from: current.branchId, to: target._id, by: req.admin._id, reason, at: new Date() } } }, { new: true });
    if (!order) throw new HttpError(409, "Order changed. Reload and try again.");
    res.json({ order: visibleOrder(order) });
  });
  router.get("/custom-requests", async (req, res) => {
    const requests = await CustomRequest.find(scoped(req)).sort({ createdAt: -1 }).limit(200).lean();
    res.json({ requests });
  });
  router.patch("/custom-requests/:reference", async (req, res) => {
    const status = text(req.body?.status, 24);
    if (!["reviewing", "quoted", "closed"].includes(status)) throw new HttpError(400, "Invalid custom request status.");
    const request = await CustomRequest.findOneAndUpdate({ reference: text(req.params.reference, 40), ...scoped(req) }, { $set: { status } }, { new: true });
    if (!request) throw new HttpError(404, "Request not found.");
    res.json({ request });
  });
  router.get("/uploads/:id", async (req, res) => {
    const upload = await Upload.findOne({ id: text(req.params.id, 60) }).lean();
    if (!upload) throw new HttpError(404, "Image not found.");
    const request = await CustomRequest.findOne({ uploadId: upload.id, ...scoped(req) }).lean();
    if (!request) throw new HttpError(404, "Image not found.");
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "customerUploads" });
    res.type("image/jpeg");
    res.setHeader("X-Content-Type-Options", "nosniff");
    bucket.openDownloadStream(upload.fileId).on("error", () => { if (!res.headersSent) res.status(404).end(); else res.destroy(); }).pipe(res);
  });

  router.get("/products", async (_req, res) => {
    const products = await Product.find().sort({ name: 1 }).lean();
    res.json({ products });
  });
  router.post("/products", requireSuper, async (req, res) => {
    const id = text(req.body?.id, 80);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new HttpError(400, "Use lowercase letters, numbers and dashes for product ID.");
    const changes = productChanges(req.body);
    if (!changes.name || !changes.flavour || !changes.category?.length || !changes.weights?.length || !changes.price || !changes.unit || !changes.image) throw new HttpError(400, "Add name, flavour, category, size, price, unit and image before saving.");
    const product = await Product.create({ ...changes, id, active: false });
    res.status(201).json({ product });
  });
  router.patch("/products/:id", requireSuper, async (req, res) => {
    const product = await Product.findOneAndUpdate({ id: text(req.params.id, 80) }, { $set: productChanges(req.body) }, { new: true, runValidators: true });
    if (!product) throw new HttpError(404, "Product not found.");
    res.json({ product });
  });
  return router;
}

function productChanges(body) {
  const changes = {};
  for (const field of ["name", "flavour", "badge", "description", "unit"]) {
    if (body?.[field] !== undefined) changes[field] = text(body[field], field === "description" ? 1000 : 100, false);
  }
  if (body?.image !== undefined) {
    const image = text(body.image, 500, false);
    if (image && !/^https:\/\//.test(image) && !/^\/images\/[a-zA-Z0-9_.-]+$/.test(image)) throw new HttpError(400, "Use an HTTPS image URL or an /images/ path.");
    changes.image = image;
  }
  if (body?.category !== undefined) {
    if (!Array.isArray(body.category) || body.category.length > 10) throw new HttpError(400, "Enter up to 10 categories.");
    changes.category = body.category.map((value) => text(value, 60));
  }
  if (body?.weights !== undefined) {
    if (!Array.isArray(body.weights) || !body.weights.length || body.weights.length > 12 || body.weights.some((v) => typeof v !== "number" || !Number.isFinite(v) || v <= 0 || v > 20)) throw new HttpError(400, "Enter valid cake sizes.");
    changes.weights = body.weights;
  }
  if (body?.price !== undefined) changes.price = money(body.price);
  for (const field of ["active", "eggless", "photo"]) if (body?.[field] !== undefined) {
    if (typeof body[field] !== "boolean") throw new HttpError(400, "Invalid " + field + " flag.");
    changes[field] = body[field];
  }
  if (!Object.keys(changes).length) throw new HttpError(400, "No product changes supplied.");
  return changes;
}
