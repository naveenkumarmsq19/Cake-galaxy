import { state } from "./state.js";

export async function request(path, { method = "GET", body, headers = {} } = {}) {
  const formData = body instanceof FormData;
  let response;
  try {
    response = await fetch("/api" + path, {
      method,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(!formData && body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(state.csrfToken ? { "X-CSRF-Token": state.csrfToken } : {}),
        ...headers
      },
      body: body === undefined ? undefined : formData ? body : JSON.stringify(body),
      signal: AbortSignal.timeout(15000)
    });
  } catch {
    throw new Error("We couldn't connect. Please check your connection and try again.");
  }
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("This service is not available yet. Please try again later.");
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "We couldn't complete that request. Please try again.");
  return data;
}

let checkoutScript;
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (checkoutScript) return checkoutScript;
  checkoutScript = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => window.Razorpay ? resolve() : reject(new Error("The payment window could not be loaded."));
    script.onerror = () => { checkoutScript = null; script.remove(); reject(new Error("The payment window could not be loaded. Please try again.")); };
    document.head.appendChild(script);
  });
  return checkoutScript;
}

export async function payWithRazorpay(payload, onMessage) {
  const config = await request("/checkout/config");
  if (!config.paymentsEnabled || !config.keyId) throw new Error("Online payments are not enabled yet. No payment has been taken.");
  if (!state.authenticated) throw new Error("Please verify your phone number before paying.");
  await loadCheckout();
  const fingerprint = JSON.stringify(payload);
  if (state.paymentAttempt?.fingerprint !== fingerprint) {
    state.paymentAttempt = { fingerprint, key: crypto.randomUUID() };
  }
  const prepared = await request("/checkout/orders", {
    method: "POST",
    body: payload,
    headers: { "Idempotency-Key": state.paymentAttempt.key }
  });
  if (!prepared.orderId || !prepared.reference || !Number.isSafeInteger(prepared.amount) || prepared.amount < 100 || prepared.currency !== "INR") {
    throw new Error("We couldn't prepare your payment. Please try again.");
  }
  return new Promise((resolve, reject) => {
    let verifying = false;
    const payment = new window.Razorpay({
      key: config.keyId,
      order_id: prepared.orderId,
      amount: prepared.amount,
      currency: prepared.currency,
      name: "Cake Galaxy",
      description: "Cake order " + prepared.reference,
      prefill: { name: state.address.name, contact: "+91" + state.phone },
      theme: { color: "#738874" },
      modal: {
        ondismiss: () => {
          if (!verifying) reject(new Error("Payment window closed. Your bag is still saved."));
        }
      },
      handler: async (result) => {
        verifying = true;
        onMessage("Confirming your payment. Please don't close this page.");
        try {
          const verified = await request("/checkout/verify", {
            method: "POST",
            body: { reference: prepared.reference, razorpay_order_id: result.razorpay_order_id, razorpay_payment_id: result.razorpay_payment_id, razorpay_signature: result.razorpay_signature }
          });
          if (verified.status !== "paid" || !verified.order) throw new Error("Your payment is awaiting confirmation. Check My orders before trying another payment.");
          resolve(verified.order);
        } catch (error) {
          reject(error);
        }
      }
    });
    payment.on("payment.failed", () => onMessage("The payment attempt wasn't completed. You can retry securely in the payment window."));
    payment.open();
  });
}
