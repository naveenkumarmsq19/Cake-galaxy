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
  kitchenCode: String
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
  customPhone: String, status: { type: String, default: "requested" }
}, options);
const orderSchema = new mongoose.Schema({
  reference: { type: String, unique: true, required: true },
  customerPhone: { type: String, index: true, required: true },
  idempotencyKey: { type: String, required: true },
  items: [mongoose.Schema.Types.Mixed],
  address: mongoose.Schema.Types.Mixed,
  delivery: mongoose.Schema.Types.Mixed,
  gst: mongoose.Schema.Types.Mixed,
  subtotal: Number, deliveryFee: Number, tax: Number, amount: Number,
  currency: { type: String, default: "INR" },
  razorpayOrderId: String, razorpayPaymentId: String,
  paymentStatus: { type: String, default: "pending" },
  status: { type: String, default: "pending_payment" },
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
export const Upload = mongoose.model("Upload", uploadSchema);
export const CustomRequest = mongoose.model("CustomRequest", customSchema);
export const Order = mongoose.model("Order", orderSchema);
