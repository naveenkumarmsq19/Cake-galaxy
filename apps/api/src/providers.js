import { createHmac, randomInt } from "node:crypto";
import { HttpError, safeCompare } from "./validation.js";

export function razorpayConfigured() { return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET); }

export async function razorpay(method, path, body, extraHeaders = {}) {
  if (!razorpayConfigured()) throw new HttpError(503, "Online payments are unavailable. No payment has been taken.");
  const auth = Buffer.from(process.env.RAZORPAY_KEY_ID + ":" + process.env.RAZORPAY_KEY_SECRET).toString("base64");
  let response;
  try {
    response = await fetch("https://api.razorpay.com/v1" + path, { method, headers: { Authorization: "Basic " + auth, ...(body ? { "Content-Type": "application/json" } : {}), ...extraHeaders }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
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

// MSG91's SMS OTP service generates the code, sends it using an approved SMS/OTP
// template and verifies it later. Never generate or log production OTPs locally.
export async function sendSmsOtp(phone) {
  const key = process.env.MSG91_AUTH_KEY;
  const template = process.env.MSG91_SMS_OTP_TEMPLATE_ID;
  if (!key || !template) throw new HttpError(503, "SMS OTP is not configured. Add your approved MSG91 SMS OTP template in the server settings.");
  const url = new URL("https://control.msg91.com/api/v5/otp");
  url.searchParams.set("template_id", template);
  url.searchParams.set("mobile", "91" + phone);
  url.searchParams.set("otp_length", "6");
  url.searchParams.set("otp_expiry", "5");
  let response;
  try {
    response = await fetch(url.toString(), {
      method: "POST", signal: AbortSignal.timeout(15000),
      headers: { authkey: key, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({})
    });
  } catch {
    throw new HttpError(502, "SMS OTP provider is unreachable. Please try again.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.type !== "success") {
    throw new HttpError(502, "SMS OTP could not be sent. Check your approved DLT/MSG91 SMS template and try again.");
  }
  // No codeHash is stored for SMS. The verify endpoint asks MSG91 to validate the OTP.
  return { code: null, channel: "sms" };
}

// The OTP provider must only acknowledge a queued request: actual delivery
// is tracked by MSG91 delivery reports and depends on Meta template eligibility.
export async function sendOtp(phone) {
  if (process.env.DEV_OTP_ENABLED === "true" && process.env.NODE_ENV !== "production") {
    const code = String(randomInt(100000, 1000000));
    process.stdout.write("Development OTP for +91" + phone + ": " + code + "\n");
    return { code, channel: "development" };
  }

  // Make the channel explicit in production. An old SMS template variable
  // must not silently override the merchant's WhatsApp-only choice.
  const channel = process.env.CUSTOMER_OTP_CHANNEL || (process.env.MSG91_SMS_OTP_TEMPLATE_ID ? "sms" : "whatsapp");
  if (channel === "sms") return sendSmsOtp(phone);
  if (channel !== "whatsapp") throw new HttpError(503, "OTP delivery configuration is invalid.");

  const {
    MSG91_AUTH_KEY: key,
    MSG91_WHATSAPP_NUMBER: number,
    MSG91_WHATSAPP_OTP_TEMPLATE_NAME: template
  } = process.env;
  if (!key || !/^\d{10,15}$/.test(number || "") || !template) {
    throw new HttpError(503, "WhatsApp verification is not configured yet. Please contact Cake Galaxy support.");
  }

  const code = String(randomInt(100000, 1000000));
  // MSG91 authentication templates with a Copy Code button need the same
  // dynamically generated OTP as BOTH body_1 and button_1. Never reuse a
  // fixed OTP outside the existing, phone-restricted test mode.
  const components = {
    body_1: { type: "text", value: code },
    button_1: { subtype: "url", type: "text", value: code }
  };
  const templateConfig = {
    name: template,
    language: { code: process.env.MSG91_WHATSAPP_OTP_TEMPLATE_LANGUAGE || "en", policy: "deterministic" },
    to_and_components: [{ to: ["91" + phone], components }]
  };
  if (process.env.MSG91_WHATSAPP_OTP_TEMPLATE_NAMESPACE) {
    templateConfig.namespace = process.env.MSG91_WHATSAPP_OTP_TEMPLATE_NAMESPACE;
  }

  let response;
  try {
    response = await fetch("https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/", {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: { authkey: key, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        integrated_number: number,
        content_type: "template",
        payload: { messaging_product: "whatsapp", type: "template", template: templateConfig }
      })
    });
  } catch {
    throw new HttpError(502, "WhatsApp verification is temporarily unreachable. Please try again.");
  }

  const data = await response.json().catch(() => null);
  // The WhatsApp API uses {status:"success", hasError:false, request_id:...},
  // NOT the SMS OTP service's {type:"success"} response. It may return an
  // error inside HTTP 200, which must never create a login challenge.
  if (!response.ok || !data || data.status !== "success" || data.hasError === true || data.errors || data.error) {
    throw new HttpError(502, "WhatsApp verification could not be requested. Check the approved OTP template and try again.");
  }
  return { code, channel: "whatsapp" };
}

export async function verifyOtp(phone, otp) {
  if (!process.env.MSG91_AUTH_KEY) throw new HttpError(503, "SMS verification is not configured yet.");
  const query = new URLSearchParams({ mobile: "91" + phone, otp });
  let response;
  try { response = await fetch("https://control.msg91.com/api/v5/otp/verify?" + query, { headers: { authkey: process.env.MSG91_AUTH_KEY }, signal: AbortSignal.timeout(15000) }); }
  catch { throw new HttpError(502, "The code couldn't be checked. Please try again."); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status >= 500) throw new HttpError(502, "SMS verification service is unavailable. Please try again.");
    throw new HttpError(400, "That verification code is invalid or expired.");
  }
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
