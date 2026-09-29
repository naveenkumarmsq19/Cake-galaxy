import mongoose from "mongoose";

const options = { timestamps: true };
const customerSchema = new mongoose.Schema({ phone: { type: String, unique: true, required: true } }, options);
const sessionSchema = new mongoose.Schema({
  tokenHash: { type: String, unique: true, required: true },
  phone: { type: String, required: true },
  csrfToken: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }
}, options);
const challengeSchema = new mongoose.Schema({
  requestId: { type: String, unique: true, required: true },
  phone: { type: String, required: true },
  codeHash: String,
  testMode: { type: Boolean, default: false },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }
}, options);
challengeSchema.index({ phone: 1, createdAt: -1 });
const productSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  name: String, price: Number, category: [String], flavour: String, image: String,
  badge: String, description: String, weights: [Number], unit: String, eggless: Boolean,
  photo: { type: Boolean, default: false }, active: { type: Boolean, default: true }
}, options);
const areaSchema = new mongoose.Schema({
  pincode: { type: String, unique: true, required: true },
  deliveryFee: { type: Number, required: true },
  active: { type: Boolean, default: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", index: true },
  kitchenCode: String
}, options);
const branchSchema = new mongoose.Schema({
  code: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  address: { type: String, required: true },
  basePincode: { type: String, unique: true, required: true },
  radiusKm: { type: Number, default: 5 },
  active: { type: Boolean, default: true }
}, options);
const adminUserSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["super_admin", "branch_manager"], required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
  active: { type: Boolean, default: true }
}, options);
const adminSessionSchema = new mongoose.Schema({
  tokenHash: { type: String, unique: true, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", required: true },
  csrfToken: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }
}, options);
const uploadSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  ownerPhone: { type: String, required: true },
  fileId: mongoose.Schema.Types.ObjectId,
  contentType: String
}, options);
const customSchema = new mongoose.Schema({
  reference: { type: String, unique: true, required: true },
  ownerPhone: { type: String, required: true },
  uploadId: String, sample: String, occasion: String, weight: String, flavour: String,
  budget: Number, notes: String, requiredDate: String, customPincode: String,
  customPhone: String, status: { type: String, default: "requested" },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", index: true }
}, options);
const orderSchema = new mongoose.Schema({
  reference: { type: String, unique: true, required: true },
  customerPhone: { type: String, index: true, required: true },
  sender: mongoose.Schema.Types.Mixed,
  idempotencyKey: { type: String, required: true },
  items: [mongoose.Schema.Types.Mixed],
  address: mongoose.Schema.Types.Mixed,
  delivery: mongoose.Schema.Types.Mixed,
  gst: mongoose.Schema.Types.Mixed,
  subtotal: Number, deliveryFee: Number, tax: Number, amount: Number,
  currency: { type: String, default: "INR" },
  razorpayOrderId: String, razorpayPaymentId: String,
  paymentStatus: { type: String, default: "pending" },
  testOrder: { type: Boolean, default: false },
  status: { type: String, default: "pending_payment" },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", index: true },
  assignmentHistory: [mongoose.Schema.Types.Mixed],
  whatsappConsent: Boolean,
  notificationStatus: { type: String, default: "pending" },
  cancellation: mongoose.Schema.Types.Mixed
}, options);
orderSchema.index({ customerPhone: 1, idempotencyKey: 1 }, { unique: true });
orderSchema.index({ razorpayOrderId: 1 }, { sparse: true });
orderSchema.index({ razorpayPaymentId: 1 }, { unique: true, sparse: true });

export const Customer = mongoose.model("Customer", customerSchema);
export const Session = mongoose.model("Session", sessionSchema);
export const LoginChallenge = mongoose.model("LoginChallenge", challengeSchema);
export const Product = mongoose.model("Product", productSchema);
export const ServiceArea = mongoose.model("ServiceArea", areaSchema);
export const Branch = mongoose.model("Branch", branchSchema);
export const AdminUser = mongoose.model("AdminUser", adminUserSchema);
export const AdminSession = mongoose.model("AdminSession", adminSessionSchema);
export const Upload = mongoose.model("Upload", uploadSchema);
export const CustomRequest = mongoose.model("CustomRequest", customSchema);
export const Order = mongoose.model("Order", orderSchema);
