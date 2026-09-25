import { addons } from "@cake-galaxy/catalog";
import { timingSafeEqual } from "node:crypto";

export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

export function phoneNumber(value) {
  const original = String(value || "");
  const phone = /^\+?91[6-9][0-9]{9}$/.test(original) ? original.replace(/^\+?91/, "") : original;
  if (!/^[6-9][0-9]{9}$/.test(phone)) throw new HttpError(400, "Enter a valid 10-digit Indian mobile number.");
  return phone;
}

export function text(value, max = 160, required = true) {
  if (typeof value !== "string" || (required && !value.trim()) || value.length > max) throw new HttpError(400, "Check the details entered and try again.");
  return value.trim();
}

export function deliveryDate(value, today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())) {
  const date = text(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date < today || Date.parse(date) - Date.parse(today) > 31 * 86400000) throw new HttpError(400, "Choose a valid delivery date within the next 31 days.");
  return date;
}

export function priceItem(item, product) {
  if (!product?.active || !product.weights.includes(Number(item.size)) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) throw new HttpError(400, "A cake in your bag is unavailable. Please review your bag.");
  if (item.eggless && !product.eggless) throw new HttpError(400, "Eggless is unavailable for this cake.");
  const requestedAddons = item.addons || [];
  if (!Array.isArray(requestedAddons) || requestedAddons.length > addons.length || new Set(requestedAddons).size !== requestedAddons.length || requestedAddons.some((id) => !addons.some((addon) => addon.id === id))) throw new HttpError(400, "An add-on in your bag is unavailable.");
  const flavour = text(item.flavour, 60);
  if (flavour !== product.flavour && !(product.photo && ["Chocolate", "Butterscotch"].includes(flavour))) throw new HttpError(400, "Choose a flavour available for this cake.");
  const message = item.message ? text(item.message, 30) : "";
  const unit = Math.round(product.price * Number(item.size) / product.weights[0]) + (item.eggless ? 5000 : 0) + addons.filter((addon) => requestedAddons.includes(addon.id)).reduce((sum, addon) => sum + addon.price, 0);
  if (!Number.isSafeInteger(unit) || unit <= 0) throw new HttpError(400, "This cake price cannot be confirmed.");
  return { productId: product.id, name: product.name, size: Number(item.size), unit: product.unit, quantity: item.quantity, flavour, eggless: item.eggless === true, message, addons: requestedAddons, uploadId: item.uploadId || null, unitPrice: unit, lineTotal: unit * item.quantity };
}

export function safeCompare(expected, actual) {
  const a = Buffer.from(String(expected)); const b = Buffer.from(String(actual));
  return a.length === b.length && timingSafeEqual(a, b);
}
