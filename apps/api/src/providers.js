import { createHmac, randomInt } from "node:crypto";
import { HttpError, safeCompare } from "./validation.js";

export function razorpayConfigured() { return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET); }

export async function razorpay(method, path, body) {
  if (!razorpayConfigured()) throw new HttpError(503, "Online payments are unavailable. No payment has been taken.");
  const auth = Buffer.from(process.env.RAZORPAY_KEY_ID + ":" + process.env.RAZORPAY_KEY_SECRET).toString("base64");
  let response;
  try {
    response = await fetch("https://api.razorpay.com/v1" + path, { method, headers: { Authorization: "Basic " + auth, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
  } catch { throw new HttpError(502, "The payment provider is unreachable. Please try again."); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new HttpError(502, "Payment could not be prepared or confirmed. Please check My orders.");
  return data;
}

export function validPaymentSignature(orderId, paymentId, signature, secret = process.env.RAZORPAY_KEY_SECRET) {
  if (!secret || typeof paymentId !== "string" || typeof signature !== "string") return false;
  const expected = createHmac("sha256", secret).update(orderId + "|" + paymentId).digest("hex");
  return safeCompare(expected, signature);
}

export function validWebhookSignature(body, signature) {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET || !signature) return false;
  const expected = createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(body).digest("hex");
  return safeCompare(expected, signature);
}

export async function sendOtp(phone) {
  if (process.env.DEV_OTP_ENABLED === "true" && process.env.NODE_ENV !== "production") {
    const code = String(randomInt(100000, 1000000));
    process.stdout.write("Development OTP for +91" + phone + ": " + code + "\n");
    return { code, channel: "development" };
  }

  const {
    MSG91_AUTH_KEY: key,
    MSG91_WHATSAPP_NUMBER: number,
    MSG91_WHATSAPP_OTP_TEMPLATE_NAME: template
  } = process.env;
  if (!key || !number || !template) throw new HttpError(503, "WhatsApp OTP is not configured yet.");

  const code = String(randomInt(100000, 1000000));
  let response;
  try {
    response = await fetch("https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/", {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: { authkey: key, "Content-Type": "application/json" },
      body: JSON.stringify({
        integrated_number: number,
        content_type: "template",
        payload: {
          to_and_components: [{
            to: ["91" + phone],
            components: { body_1: { type: "text", value: code } }
          }],
          template: {
            name: template,
            language: { code: process.env.MSG91_WHATSAPP_OTP_TEMPLATE_LANGUAGE || "en" }
          }
        }
      })
    });
  } catch {
    throw new HttpError(502, "Couldn't send a WhatsApp verification code. Please try again.");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.type === "error" || data.error) throw new HttpError(502, "Couldn't send a WhatsApp verification code. Please try again.");
  return { code, channel: "whatsapp" };
}

export async function verifyOtp(phone, otp) {
  if (!process.env.MSG91_AUTH_KEY) throw new HttpError(503, "SMS verification is not configured yet.");
  const query = new URLSearchParams({ mobile: "91" + phone, otp });
  let response;
  try { response = await fetch("https://control.msg91.com/api/v5/otp/verify?" + query, { headers: { authkey: process.env.MSG91_AUTH_KEY }, signal: AbortSignal.timeout(15000) }); }
  catch { throw new HttpError(502, "The code couldn't be checked. Please try again."); }
  const data = await response.json().catch(() => ({}));
  if (data.type !== "success") throw new HttpError(400, "That verification code is invalid or expired.");
  return true;
}

export async function sendWhatsApp(phone, reference) {
  const { MSG91_AUTH_KEY: key, MSG91_WHATSAPP_NUMBER: number, MSG91_WHATSAPP_TEMPLATE_NAME: template } = process.env;
  if (!key || !number || !template) return false;
  let response;
  try {
    response = await fetch("https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/", {
      method: "POST", signal: AbortSignal.timeout(15000),
      headers: { authkey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ integrated_number: number, content_type: "template", payload: { to_and_components: [{ to: ["91" + phone], components: { body_1: { type: "text", value: reference } } }], template: { name: template, language: { code: "en" } } } })
    });
  } catch { return false; }
  const data = await response.json().catch(() => ({}));
  return response.ok && data.type !== "error" && !data.error;
}
