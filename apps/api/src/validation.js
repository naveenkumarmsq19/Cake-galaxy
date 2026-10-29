import { addons, approvedWeightsKg, discountAmount, regularUnitPrice, unitPrice } from "@cake-galaxy/catalog";
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

export function validateDeliverySlot(date, slot, now = new Date(), minimumPreparationMinutes = 0) {
  const allowed = ["10 AM – 1 PM", "1 PM – 4 PM", "4 PM – 7 PM", "7 PM – 10 PM"];
  if (!allowed.includes(slot)) throw new HttpError(400, "Choose an available delivery time.");
  if (!Number.isSafeInteger(minimumPreparationMinutes) || minimumPreparationMinutes < 0 || minimumPreparationMinutes > 1440) throw new Error("Invalid preparation minutes setting.");
  const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const parts = Object.fromEntries(formatter.formatToParts(now).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const today = parts.year + "-" + parts.month + "-" + parts.day;
  const slotStart = [600, 780, 960, 1140][allowed.indexOf(slot)];
  const currentMinutes = Number(parts.hour) * 60 + Number(parts.minute);
  if (date === today && slotStart < currentMinutes + minimumPreparationMinutes) throw new HttpError(400, "This delivery slot has already started or does not allow enough preparation time. Choose a later slot.");
  return slot;
}

// An optional location pin accompanies the human-entered delivery address.
// It cannot replace service-area checking by pincode.
export function deliveryLocation(value) {
  if (value == null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      typeof value.lat !== "number" || typeof value.lng !== "number" ||
      !Number.isFinite(value.lat) || !Number.isFinite(value.lng) ||
      value.lat < 6 || value.lat > 38 || value.lng < 68 || value.lng > 98) {
    throw new HttpError(400, "Choose a valid delivery map pin in India.");
  }
  return { lat:Number(value.lat.toFixed(6)), lng:Number(value.lng.toFixed(6)) };
}

export function priceItem(item, product) {
  if (!product?.active || !product.weights.includes(Number(item.size)) || (product.unit === "kg" && !approvedWeightsKg.includes(Number(item.size))) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) throw new HttpError(400, "A cake in your bag is unavailable. Please review your bag.");
  if (item.eggless && !product.eggless) throw new HttpError(400, "Eggless is unavailable for this cake.");
  const requestedAddons = item.addons || [];
  if (!Array.isArray(requestedAddons) || requestedAddons.length > addons.length || new Set(requestedAddons).size !== requestedAddons.length || requestedAddons.some((id) => !addons.some((addon) => addon.id === id))) throw new HttpError(400, "An add-on in your bag is unavailable.");
  const flavour = text(item.flavour, 60);
  if (flavour !== product.flavour && !(product.photo && ["Chocolate", "Butterscotch"].includes(flavour))) throw new HttpError(400, "Choose a flavour available for this cake.");
  const message = item.message ? text(item.message, 30) : "";
  const pricedItem = { ...item, size: Number(item.size), eggless: item.eggless === true, addons: requestedAddons };
  const originalUnitPrice = regularUnitPrice(pricedItem, product);
  const discountPerUnit = discountAmount(pricedItem, product);
  const unit = unitPrice(pricedItem, product);
  if (!Number.isSafeInteger(unit) || unit <= 0) throw new HttpError(400, "This cake price cannot be confirmed.");
  return { productId: product.id, name: product.name, size: Number(item.size), unit: product.unit, quantity: item.quantity, flavour, eggless: item.eggless === true, message, addons: requestedAddons, uploadId: item.uploadId || null, originalUnitPrice, discountPerUnit, discountPercent: discountPerUnit > 0 ? 10 : 0, unitPrice: unit, lineTotal: unit * item.quantity };
}

export function safeCompare(expected, actual) {
  const a = Buffer.from(String(expected)); const b = Buffer.from(String(actual));
  return a.length === b.length && timingSafeEqual(a, b);
}
