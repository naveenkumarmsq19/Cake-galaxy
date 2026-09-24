import { getProduct, products, unitPrice, totals } from "./catalog.js";
import { state, addItem, updateQuantity, removeItem, saveBasket } from "./state.js";
import { request, payWithRazorpay } from "./api.js";
import * as views from "./views.js";

const main = document.getElementById("main");
let quantity = 1;
let toastTimer;
let resendUntil = 0;
let objectUrls = [];

function route() {
  const [name, query = ""] = location.hash.slice(1).split("?");
  return { name: name || "home", params: new URLSearchParams(query) };
}

function navigate(target) {
  if (location.hash === "#" + target) render();
  else location.hash = target;
}

function toast(message) {
  const element = document.getElementById("toast");
  element.textContent = message;
  element.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { element.hidden = true; }, 3500);
}

function feedback(id, message) {
  const element = document.getElementById(id);
  if (element) element.textContent = message;
}

function updateCount() {
  const count = totals(state.cart).count;
  document.querySelectorAll(".cart-count").forEach((element) => {
    element.textContent = count;
    element.hidden = count === 0;
  });
  document.getElementById("header-pincode").textContent = state.pincode || "Enter pincode";
}

function setBusy(form, busy) {
  form.querySelectorAll('button[type="submit"],button:not([type])').forEach((button) => { button.disabled = busy; });
}

function render() {
  const current = route();
  quantity = 1;
  if (current.name !== "custom") state.customFile = null;
  if (current.name !== "product") state.photoFile = null;
  objectUrls.forEach((url) => URL.revokeObjectURL(url));
  objectUrls = [];
  const routes = {
    home: views.home,
    shop: () => views.shop(current.params),
    product: () => views.product(current.params),
    custom: views.custom,
    cart: views.cart,
    address: views.address,
    checkout: views.checkout,
    login: () => views.login(false),
    otp: () => state.requestId ? views.login(true) : views.login(false),
    confirmation: views.confirmation,
    orders: views.orders,
    "order-detail": views.orderDetail,
    help: views.help,
    policy: () => views.policy(current.params)
  };
  main.innerHTML = (routes[current.name] || views.home)();
  document.querySelectorAll("[data-nav]").forEach((element) => {
    const active = element.dataset.nav === current.name;
    element.classList.toggle("active", active);
    if (active) element.setAttribute("aria-current", "page");
    else element.removeAttribute("aria-current");
  });
  document.querySelectorAll(".category-inner > a").forEach((element) => {
    const active = element.hash === location.hash;
    element.classList.toggle("active", active);
  });
  document.title = (main.querySelector("h1")?.textContent || "Made for your moments") + " | Cake Galaxy";
  updateCount();
  window.scrollTo({ top: 0, behavior: "instant" });
  if (current.name === "orders" && state.authenticated) loadOrders();
}

function selectProduct() {
  const form = document.getElementById("product-form");
  const data = new FormData(form);
  return {
    productId: form.dataset.product,
    size: Number(data.get("size")),
    quantity,
    flavour: data.get("flavour"),
    eggless: data.has("eggless"),
    message: String(data.get("message") || "").trim(),
    addons: data.getAll("addon"),
    file: state.photoFile
  };
}

async function inspectFile(input) {
  const file = input.files?.[0];
  if (!file) return null;
  if (!["image/jpeg", "image/png"].includes(file.type) || file.size > 10 * 1024 * 1024) {
    input.value = "";
    throw new Error("Choose a JPG or PNG image smaller than 10 MB.");
  }
  const url = URL.createObjectURL(file);
  try {
    await new Promise((resolve, reject) => {
      const probe = new Image();
      probe.onload = resolve;
      probe.onerror = reject;
      probe.src = url;
    });
  } catch {
    URL.revokeObjectURL(url);
    input.value = "";
    throw new Error("That file couldn't be opened as an image. Please choose another.");
  }
  objectUrls.push(url);
  const preview = document.getElementById(input.id + "-preview");
  preview.src = url;
  preview.hidden = false;
  return file;
}

async function sendOtp(phone) {
  if (!/^[6-9]\d{9}$/.test(phone)) throw new Error("Enter a valid 10-digit mobile number.");
  const result = await request("/auth/otp", { method: "POST", body: { phone: "+91" + phone } });
  if (!result.requestId || result.sent !== true) throw new Error("We couldn't send a verification code. Please try again.");
  state.phone = phone;
  state.requestId = result.requestId;
  resendUntil = Date.now() + Math.max(30, Number(result.retryAfter) || 30) * 1000;
  navigate("otp");
}

async function checkDelivery(pin) {
  const result = await request("/delivery?pincode=" + encodeURIComponent(pin));
  if (typeof result.available !== "boolean") throw new Error("Delivery availability could not be confirmed.");
  state.quote = result;
  return result;
}

function chatAnswer(text) {
  if (/cancel|refund/i.test(text)) return "For a cancellation, open My orders and select your order. Eligibility and refund details must be confirmed for that order before it is cancelled.";
  if (/custom|design|photo|sample/i.test(text)) return "Open Custom cakes to upload a reference or choose a sample. Add the flavour, size, date and design notes. The final design and price are confirmed before payment.";
  if (/delivery|pincode|slot|time/i.test(text)) return "Use the delivery selector to check a pincode, then choose a date and time in your bag. Availability is confirmed before payment.";
  if (/invoice|gst/i.test(text)) return "Add your GST details under Billing details at checkout. After order confirmation, open My orders to download the invoice.";
  if (/payment|upi|card/i.test(text)) return "At checkout, continue to Razorpay to see available payment methods. A payment is only confirmed after verification.";
  return "I can answer common questions about delivery, custom cakes, invoices, payments and cancellations. Which one would you like help with?";
}

function appendChat(text, sent = false) {
  const feed = document.getElementById("chat-feed");
  const message = document.createElement("div");
  message.className = "chat-message" + (sent ? " sent" : "");
  message.textContent = text;
  feed.appendChild(message);
  feed.scrollTop = feed.scrollHeight;
}

async function loadOrders() {
  const list = document.getElementById("orders-list");
  try {
    const result = await request("/orders");
    if (!Array.isArray(result.orders)) throw new Error("Orders are unavailable right now.");
    if (!list.isConnected) return;
    if (!result.orders.length) {
      list.innerHTML = '<div class="empty-state"><h2>No orders yet</h2><p>Your confirmed orders will appear here.</p><a href="#shop" class="button">Explore cakes</a></div>';
      return;
    }
    list.replaceChildren();
    result.orders.forEach((order) => {
      const panel = document.createElement("article");
      panel.className = "panel";
      const title = document.createElement("h2");
      title.textContent = "Order " + order.reference;
      const description = document.createElement("p");
      description.className = "subtle";
      description.textContent = order.statusLabel || order.status;
      const button = document.createElement("button");
      button.className = "button outline";
      button.textContent = "View order";
      button.addEventListener("click", () => { state.orderDetail = order; navigate("order-detail"); });
      panel.append(title, description, button);
      list.appendChild(panel);
    });
  } catch (error) {
    if (list.isConnected) { list.textContent = error.message; list.className = "form-message"; }
  }
}

document.addEventListener("click", async (event) => {
  const topic = event.target.closest("[data-topic]");
  if (topic) {
    appendChat(topic.dataset.topic, true);
    appendChat(chatAnswer(topic.dataset.topic));
    return;
  }
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "delivery") {
    document.getElementById("delivery-pin").value = state.pincode;
    feedback("delivery-feedback", "");
    document.getElementById("delivery-dialog").showModal();
  }
  if (action === "close-dialog") document.getElementById("delivery-dialog").close();
  if (action === "chat" || action === "chat-close") {
    const panel = document.getElementById("support-panel");
    panel.hidden = action === "chat-close" ? true : !panel.hidden;
    if (!panel.hidden) panel.querySelector("input").focus();
  }
  if (action === "product-plus" || action === "product-minus") {
    quantity = Math.min(20, Math.max(1, quantity + (action === "product-plus" ? 1 : -1)));
    document.getElementById("product-quantity").textContent = quantity;
  }
  if (action === "cart-plus" || action === "cart-minus") {
    updateQuantity(button.dataset.id, action === "cart-plus" ? 1 : -1);
    render();
  }
  if (action === "remove") { removeItem(button.dataset.id); render(); }
  if (action === "sample") {
    state.customSample = button.dataset.sample;
    document.querySelectorAll(".sample-button").forEach((entry) => entry.classList.toggle("selected", entry === button));
    document.getElementById("sample-selection").textContent = "Selected style: " + state.customSample;
  }
  if (action === "checkout-login") {
    state.afterLogin = "checkout";
    navigate("login");
  }
  if (action === "resend") {
    if (Date.now() < resendUntil) return feedback("auth-feedback", "Please wait " + Math.ceil((resendUntil - Date.now()) / 1000) + " seconds before requesting another code.");
    button.disabled = true;
    try { await sendOtp(state.phone); } catch (error) { feedback("auth-feedback", error.message); }
    finally { button.disabled = false; }
  }
  if (action === "cancel-order") {
    const order = state.orderDetail || state.receipt;
    if (!order || !confirm("Send a cancellation request for this order? Support will confirm eligibility and the refund before cancellation.")) return;
    button.disabled = true;
    try {
      const result = await request("/orders/" + encodeURIComponent(order.reference) + "/cancellation", { method: "POST", body: { reason: "Customer requested cancellation" } });
      if (!result.requestId) throw new Error("Cancellation request couldn't be confirmed.");
      feedback("order-feedback", "Cancellation requested. Reference: " + result.requestId);
    } catch (error) { feedback("order-feedback", error.message); }
    finally { button.disabled = false; }
  }
  if (action === "invoice") {
    const order = state.orderDetail || state.receipt;
    if (!order) return;
    button.disabled = true;
    try {
      const response = await fetch("/api/orders/" + encodeURIComponent(order.reference) + "/invoice", { credentials: "same-origin", headers: { Accept: "application/pdf" } });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/pdf")) throw new Error("The invoice isn't available yet. Please try again later.");
      const url = URL.createObjectURL(await response.blob());
      const download = document.createElement("a");
      download.href = url;
      download.download = "Cake-Galaxy-Invoice.pdf";
      download.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { feedback("order-feedback", error.message); }
    finally { button.disabled = false; }
  }
});

document.addEventListener("change", async (event) => {
  const input = event.target;
  if (input.id === "sort-cakes" || input.id === "mobile-filter") {
    const params = route().params;
    params.set(input.id === "sort-cakes" ? "sort" : "category", input.value);
    navigate("shop?" + params.toString());
  }
  if (input.closest("#product-form") && input.type !== "file") {
    const { money } = await import("./catalog.js");
    document.getElementById("product-price").textContent = money(unitPrice(selectProduct()));
  }
  if (input.id === "bag-date") state.deliveryDate = input.value;
  if (input.id === "bag-slot") state.slot = input.value;
  if (input.id === "gst-toggle") {
    document.getElementById("gst-fields").hidden = !input.checked;
    document.querySelectorAll("#gst-fields input").forEach((field) => { field.required = input.checked; });
  }
  if (input.id === "custom-file" || input.id === "photo-file") {
    try {
      const file = await inspectFile(input);
      if (input.id === "custom-file") state.customFile = file;
      else state.photoFile = file;
    } catch (error) {
      if (input.id === "custom-file") state.customFile = null;
      else state.photoFile = null;
      toast(error.message);
    }
  }
});

document.addEventListener("input", (event) => {
  if (event.target.name === "gstin") event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (event.target.id === "otp") event.target.value = event.target.value.replace(/\D/g, "").slice(0, 6);
});

document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  const data = new FormData(form);

  if (form.id === "site-search") {
    navigate("shop?q=" + encodeURIComponent(String(data.get("query") || "").trim()));
  }
  if (form.id === "chat-form") {
    const text = String(data.get("message") || "").trim();
    if (!text) return;
    appendChat(text, true);
    appendChat(chatAnswer(text));
    form.reset();
  }
  if (form.id === "delivery-form") {
    const pin = String(data.get("pincode"));
    state.pincode = pin;
    state.quote = null;
    updateCount();
    setBusy(form, true);
    feedback("delivery-feedback", "Checking delivery…");
    try {
      const result = await checkDelivery(pin);
      feedback("delivery-feedback", result.available ? "Delivery is available. Choose your date in the bag." : "We're not delivering to this pincode at the moment.");
      if (result.available) {
        document.getElementById("delivery-dialog").close();
        toast("Delivery pincode updated");
        if (["cart", "checkout"].includes(route().name)) render();
      }
    } catch {
      feedback("delivery-feedback", "Pincode saved. Delivery availability can't be confirmed right now. No order has been placed.");
    } finally { setBusy(form, false); }
  }
  if (form.id === "product-form") {
    const item = selectProduct();
    if (getProduct(item.productId).photo && !item.file) return feedback("product-feedback", "Add a valid photograph before adding this cake.");
    addItem(item);
    toast("Added to your bag");
    navigate("cart");
  }
  if (form.id === "address-form") {
    state.address = {
      name: String(data.get("name")).trim(),
      phone: String(data.get("phone")),
      line1: String(data.get("line1")).trim(),
      line2: String(data.get("line2")).trim(),
      city: String(data.get("city")).trim(),
      pincode: String(data.get("pincode")),
      whatsapp: data.has("whatsapp")
    };
    if (state.pincode !== state.address.pincode) state.quote = null;
    state.pincode = state.address.pincode;
    if (state.phone !== state.address.phone) state.authenticated = false;
    state.phone = state.address.phone;
    state.deliveryDate = String(data.get("date"));
    state.slot = String(data.get("slot"));
    state.afterLogin = "checkout";
    navigate("checkout");
  }
  if (form.id === "login-form") {
    setBusy(form, true);
    feedback("auth-feedback", "Requesting your code…");
    try { await sendOtp(String(data.get("phone"))); }
    catch (error) { feedback("auth-feedback", error.message); }
    finally { setBusy(form, false); }
  }
  if (form.id === "otp-form") {
    setBusy(form, true);
    try {
      const result = await request("/auth/verify", { method: "POST", body: { requestId: state.requestId, otp: String(data.get("otp")) } });
      if (result.authenticated !== true) throw new Error("That code couldn't be verified.");
      state.authenticated = true;
      state.csrfToken = result.csrfToken || "";
      navigate(state.cart.length ? state.afterLogin : "orders");
    } catch (error) { feedback("auth-feedback", error.message); }
    finally { setBusy(form, false); }
  }
  if (form.id === "custom-form") {
    if (!state.customFile && !state.customSample) return feedback("custom-feedback", "Choose a sample style or upload a design reference.");
    if (state.customSample) data.set("sample", state.customSample);
    setBusy(form, true);
    try {
      const result = await request("/custom-requests", { method: "POST", body: data });
      if (!result.reference) throw new Error("We couldn't confirm your request. Please try again.");
      feedback("custom-feedback", "Your design request has been received. Reference: " + result.reference);
    } catch (error) { feedback("custom-feedback", error.message); }
    finally { setBusy(form, false); }
  }
  if (form.id === "checkout-form") {
    if (state.busy) return;
    state.busy = true;
    const payButton = document.getElementById("pay-button");
    payButton.disabled = true;
    const originalLabel = payButton.innerHTML;
    payButton.textContent = "Preparing secure checkout…";
    feedback("payment-feedback", "");
    state.paymentMethod = String(data.get("payment"));
    try {
      const fileItems = state.cart.filter((item) => item.file);
      const uploadIds = new Map();
      for (const item of fileItems) {
        if (item.uploadId) {
          uploadIds.set(item.id, item.uploadId);
          continue;
        }
        const upload = new FormData();
        upload.set("reference", item.file);
        const result = await request("/uploads", { method: "POST", body: upload });
        if (!result.id) throw new Error("Your cake photograph couldn't be uploaded.");
        item.uploadId = result.id;
        uploadIds.set(item.id, result.id);
      }
      const payload = {
        items: state.cart.map(({ file, ...item }) => ({ ...item, ...(uploadIds.has(item.id) ? { uploadId: uploadIds.get(item.id) } : {}) })),
        address: state.address,
        delivery: { date: state.deliveryDate, slot: state.slot },
        preferredMethod: state.paymentMethod,
        gst: data.has("gst") ? { gstin: data.get("gstin"), business: data.get("business"), address: data.get("billingAddress") } : null
      };
      state.receipt = await payWithRazorpay(payload, (message) => feedback("payment-feedback", message));
      state.orderDetail = state.receipt;
      state.cart = [];
      saveBasket();
      navigate("confirmation");
    } catch (error) {
      feedback("payment-feedback", error.message);
      if (!state.authenticated) state.afterLogin = "checkout";
    } finally {
      state.busy = false;
      payButton.disabled = false;
      payButton.innerHTML = originalLabel;
    }
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") document.getElementById("support-panel").hidden = true;
});

document.getElementById("year").textContent = new Date().getFullYear();
window.addEventListener("hashchange", render);
render();
request("/session").then((session) => {
  state.authenticated = session.authenticated === true;
  state.csrfToken = session.csrfToken || "";
  if (state.authenticated && /^[6-9]\d{9}$/.test(session.phone || "")) state.phone = session.phone;
  if (route().name === "orders") render();
}).catch(() => {});
