"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { money, sizeLabel, unitPrice } from "@cake-galaxy/catalog";
import { useStore, Icon } from "../components/Storefront";
import { Summary } from "../components/Products";

const apiRoot = (process.env.NEXT_PUBLIC_API_URL || "/api").replace(/\/$/, "");
const slots = ["10 AM – 1 PM", "1 PM – 4 PM", "4 PM – 7 PM", "7 PM – 10 PM"];

function EmptyBag() { return <div className="wrap page empty-state"><h1>Your bag is waiting</h1><p>Find a cake, add a personal touch and make someone's day.</p><Link href="/shop" className="button">Find your cake</Link></div>; }

export function Cart() {
  const { cart, catalog, removeItem, changeQuantity, delivery, setDelivery } = useStore();
  if (!cart.length) return <EmptyBag/>;
  return <div className="wrap page"><div className="page-heading"><h1>Your celebration bag</h1></div><div className="checkout-layout"><div><div className="panel">{cart.map((item) => { const product = catalog.find((p) => p.id === item.productId); if (!product) return null; return <article className="cart-item" key={item.id}><img src={product.image} alt={product.name}/><div><h3><Link href={"/product?id=" + product.id}>{product.name}</Link></h3><p>{sizeLabel(product, item.size)} · {item.flavour}{item.eggless ? " · Eggless" : ""}</p>{item.message && <p>“{item.message}”</p>}<div className="quantity"><button type="button" onClick={() => changeQuantity(item.id, -1)} aria-label="Decrease quantity">−</button><output>{item.quantity}</output><button type="button" onClick={() => changeQuantity(item.id, 1)} aria-label="Increase quantity">+</button></div></div><div className="cart-price"><span>{money(unitPrice(item, product) * item.quantity)}</span><button type="button" className="icon-button" onClick={() => removeItem(item.id)} aria-label={"Remove " + product.name}>×</button></div></article>; })}</div><div className="panel"><h2>When is the celebration?</h2><div className="field-row"><div className="field"><label htmlFor="bag-date">Preferred date</label><input id="bag-date" type="date" value={delivery.date} onChange={(event) => setDelivery((current) => ({ ...current, date: event.target.value }))}/></div><div className="field"><label htmlFor="bag-slot">Preferred time</label><select id="bag-slot" value={delivery.slot} onChange={(event) => setDelivery((current) => ({ ...current, slot: event.target.value }))}><option value="">Select a time</option>{slots.map((value) => <option key={value}>{value}</option>)}</select></div></div><p className="subtle">Availability and delivery charges are confirmed before payment.</p></div><p><Link href="/shop" className="text-link">Continue shopping</Link></p></div><Summary><Link href="/address" className="button full">Add delivery details <Icon name="arrow"/></Link></Summary></div></div>;
}

export function Address() {
  const router = useRouter();
  const { cart, address, setAddress, pincode, delivery, setDelivery, setPincode, setQuote, api, session } = useStore();
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  if (!cart.length) return <EmptyBag/>;
  async function submit(event) {
    event.preventDefault(); setFeedback(""); setBusy(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (!/^[6-9]\d{9}$/.test(data.phone)) { setFeedback("Enter a valid 10-digit mobile number."); setBusy(false); return; }
    try {
      const available = await api("/delivery?pincode=" + encodeURIComponent(data.pincode));
      if (!available.available) throw new Error("We can't deliver to this pincode yet.");
      setPincode(data.pincode); setQuote(available);
      setAddress({ name: data.name, phone: data.phone, line1: data.line1, line2: data.line2, pincode: data.pincode, city: data.city, whatsapp: data.whatsapp === "on" });
      setDelivery({ date: data.date, slot: data.slot });
      router.push(session.authenticated && session.phone === data.phone ? "/checkout" : "/login?next=%2Fcheckout");
    } catch (error) { setFeedback(error.message); }
    finally { setBusy(false); }
  }
  return <div className="wrap page"><div className="checkout-layout"><div><div className="page-heading"><h1>Where's the celebration?</h1></div><form className="panel" onSubmit={submit}><div className="field-row"><div className="field"><label htmlFor="name">Recipient name</label><input id="name" name="name" defaultValue={address?.name} maxLength={80} required/></div><div className="field"><label htmlFor="phone">Mobile number</label><input id="phone" name="phone" type="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} defaultValue={address?.phone || session.phone} required/></div></div><div className="field"><label htmlFor="line1">House / flat and street</label><input id="line1" name="line1" defaultValue={address?.line1} maxLength={160} required/></div><div className="field"><label htmlFor="line2">Area / landmark (optional)</label><input id="line2" name="line2" defaultValue={address?.line2} maxLength={160}/></div><div className="field-row"><div className="field"><label htmlFor="pincode">Pincode</label><input id="pincode" name="pincode" inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} defaultValue={address?.pincode || pincode} required/></div><div className="field"><label htmlFor="city">City</label><input id="city" name="city" defaultValue={address?.city || "Bengaluru"} maxLength={60} required/></div></div><div className="field-row"><div className="field"><label htmlFor="date">Preferred delivery date</label><input id="date" name="date" type="date" defaultValue={delivery.date} required/></div><div className="field"><label htmlFor="slot">Preferred time</label><select id="slot" name="slot" defaultValue={delivery.slot} required><option value="">Select a time</option>{slots.map((value) => <option key={value}>{value}</option>)}</select></div></div><label className="check-label"><input name="whatsapp" type="checkbox" defaultChecked={address?.whatsapp}/>Send order updates to this number on WhatsApp</label><p className="form-message" role="status">{feedback}</p><button className="button full" disabled={busy}>Review your order <Icon name="arrow"/></button></form></div><Summary/></div></div>;
}

function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => window.Razorpay ? resolve() : reject(new Error("Payment window could not be loaded."));
    script.onerror = () => { script.remove(); reject(new Error("Payment window could not be loaded.")); };
    document.head.appendChild(script);
  });
}

export function Checkout() {
  const router = useRouter();
  const { cart, address, delivery, session, api, clearCart, setReceipt } = useStore();
  const [config, setConfig] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [gstEnabled, setGstEnabled] = useState(false);
  const attempt = useRef(null);
  useEffect(() => { api("/checkout/config").then(setConfig).catch((error) => setFeedback(error.message)); }, []);
  if (!cart.length) return <EmptyBag/>;
  if (!address || !delivery.date || !delivery.slot) return <div className="wrap page empty-state"><h1>Add delivery details first</h1><Link href="/address" className="button">Add address</Link></div>;

  async function submit(event) {
    event.preventDefault(); setFeedback("");
    if (!session.authenticated || session.phone !== address.phone) { router.push("/login?next=%2Fcheckout"); return; }
    if (!config?.paymentsEnabled) { setFeedback("Online payment is not available yet. No charge has been made."); return; }
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const fingerprint = JSON.stringify({ cart, address, delivery, gstEnabled, gstin: form.get("gstin"), business: form.get("business"), billingAddress: form.get("billingAddress") });
      if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, key: crypto.randomUUID() };
      const idempotencyKey = attempt.current.key;
      const data = await api("/checkout/orders", { method: "POST", body: {
        items: cart.map(({ productId, size, quantity, flavour, eggless, message, addons, uploadId }) => ({ productId, size, quantity, flavour, eggless, message, addons, uploadId })),
        address, delivery, preferredMethod: form.get("payment"),
        gst: gstEnabled ? { gstin: form.get("gstin"), business: form.get("business"), billingAddress: form.get("billingAddress") } : null,
        idempotencyKey
      } });
      if (!data.orderId || !data.reference || !Number.isSafeInteger(data.amount)) throw new Error("Payment couldn't be prepared. No charge has been made.");
      await loadCheckout();
      const confirmation = await new Promise((resolve, reject) => {
        const payment = new window.Razorpay({ key: config.keyId, order_id: data.orderId, amount: data.amount, currency: "INR", name: "Cake Galaxy", description: "Cake order " + data.reference, prefill: { name: address.name, contact: "+91" + address.phone }, theme: { color: "#738874" }, modal: { ondismiss: () => reject(new Error("Payment window closed. Your bag is saved.")) }, handler: resolve });
        payment.on("payment.failed", () => setFeedback("Payment didn't complete. Please try again after checking your order status."));
        payment.open();
      });
      setFeedback("Confirming your payment securely…");
      const verified = await api("/checkout/verify", { method: "POST", body: { reference: data.reference, ...confirmation } });
      if (verified.status !== "paid" || !verified.order) throw new Error("Payment confirmation is pending. Check My orders before retrying.");
      setReceipt(verified.order); attempt.current = null; clearCart(); router.push("/confirmation?reference=" + encodeURIComponent(data.reference));
    } catch (error) { setFeedback(error.message); }
    finally { setBusy(false); }
  }

  return <div className="wrap page"><div className="checkout-layout"><div><div className="page-heading"><h1>One last look</h1></div><div className="panel checkout-address"><div><h2>Delivering to</h2><p><strong>{address.name}</strong><br/>{address.line1}<br/>{address.line2 && <>{address.line2}<br/></>}{address.city} {address.pincode}<br/>+91 {address.phone}</p><p className="subtle">{delivery.date} · {delivery.slot}</p></div><Link href="/address" className="text-link">Edit</Link></div><form onSubmit={submit}><div className="panel"><h2>How would you like to pay?</h2>{[["upi", "UPI", "Google Pay, PhonePe and other UPI apps"], ["card", "Credit or debit card", "Choose your card in the secure payment window"], ["netbanking", "Netbanking", "Select your bank in the payment window"]].map(([id, title, info]) => <label className="payment-option" key={id}><input type="radio" name="payment" value={id} defaultChecked={id === "upi"}/><span><strong>{title}</strong><small>{info}</small></span></label>)}<p className="subtle">Available payment methods are confirmed in Razorpay.</p></div><div className="panel"><h2>Billing details</h2><label className="check-label"><input type="checkbox" checked={gstEnabled} onChange={(event) => setGstEnabled(event.target.checked)}/>Add GST details for a business invoice</label>{gstEnabled && <><div className="field"><label htmlFor="gstin">GSTIN</label><input id="gstin" name="gstin" maxLength={15} required/></div><div className="field"><label htmlFor="business">Registered business name</label><input id="business" name="business" maxLength={120} required/></div><div className="field"><label htmlFor="billingAddress">Business billing address</label><input id="billingAddress" name="billingAddress" maxLength={250} required/></div></>}</div><div className="panel"><label className="check-label"><input type="checkbox" required/>I agree to the terms and cancellation policy.</label><p className="subtle"><Link href="/policy?type=terms">Terms</Link> · <Link href="/policy?type=refund">Cancellation & refunds</Link></p><p className="form-message" role="status">{feedback}</p>{!config?.paymentsEnabled && <p className="subtle">Online payment is unavailable until the store is activated.</p>}<button className="button full" disabled={busy || !config?.paymentsEnabled}>{busy ? "Please wait…" : "Continue to Razorpay"}</button></div></form></div><Summary/></div></div>;
}

export function Login() {
  const params = useSearchParams();
  const router = useRouter();
  const { api, setSession, refreshSession } = useStore();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [requestId, setRequestId] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const next = params.get("next")?.startsWith("/") && !params.get("next").startsWith("//") ? params.get("next") : "/orders";
  async function submit(event) {
    event.preventDefault(); setBusy(true); setFeedback("");
    try {
      if (!requestId) {
        const result = await api("/auth/otp", { method: "POST", body: { phone: "+91" + phone } });
        if (result.sent !== true || !result.requestId) throw new Error("Couldn't send the code. Please try again.");
        setRequestId(result.requestId);
      } else {
        const result = await api("/auth/verify", { method: "POST", body: { requestId, otp } });
        if (!result.authenticated) throw new Error("Code couldn't be verified.");
        setSession({ authenticated: true, phone, csrfToken: result.csrfToken });
        await refreshSession(); router.replace(next);
      }
    } catch (error) { setFeedback(error.message); }
    finally { setBusy(false); }
  }
  return <div className="wrap page"><section className="auth-layout"><div className="auth-photo"><img src="/images/berry.jpg" alt="Floral celebration cake"/></div><div className="auth-content"><span className="overline">WELCOME TO CAKE GALAXY</span><h1>{requestId ? "Just one more step." : "Good things start here."}</h1><p>{requestId ? "Enter the code sent to +91 " + phone + "." : "Sign in with your mobile number to save your orders and check out securely."}</p><form onSubmit={submit}>{requestId ? <><label htmlFor="otp">Verification code</label><input className="otp-input" id="otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} minLength={6} value={otp} onChange={(event) => setOtp(event.target.value)} required/><button className="button full" disabled={busy}>Verify & continue</button><button className="text-link" type="button" onClick={() => { setRequestId(""); setOtp(""); setFeedback(""); }}>Use another number</button></> : <><label htmlFor="login-phone">Your mobile number</label><div className="phone-field"><span>+91</span><input id="login-phone" type="tel" inputMode="numeric" autoComplete="tel-national" pattern="[6-9][0-9]{9}" maxLength={10} value={phone} onChange={(event) => setPhone(event.target.value)} required/></div><button className="button full" disabled={busy}>Send verification code</button></>}<p className="form-message" role="status">{feedback}</p></form></div></section></div>;
}

export function Confirmation() {
  const params = useSearchParams();
  const router = useRouter();
  const { api, receipt, session } = useStore();
  const [order, setOrder] = useState(receipt);
  const [feedback, setFeedback] = useState("");
  const reference = params.get("reference");
  useEffect(() => { if (reference && session.authenticated) api("/orders/" + encodeURIComponent(reference)).then((result) => setOrder(result.order)).catch((error) => setFeedback(error.message)); }, [reference, session.authenticated]);
  if (!order || order.reference !== reference || order.paymentStatus !== "paid") return <div className="wrap page empty-state"><h1>Checking your order</h1><p>{feedback || "We'll show your confirmation once payment is verified."}</p><Link className="button" href="/orders">My orders</Link></div>;
  return <div className="wrap page empty-state"><h1>Your order is confirmed</h1><p>Order {order.reference} · {money(order.amount)}</p><p>{order.deliveryLabel}</p><button className="button" type="button" onClick={() => router.push("/orders")}>View my orders</button></div>;
}

export function Orders() {
  const { api, session } = useStore();
  const [orders, setOrders] = useState([]);
  const [feedback, setFeedback] = useState("");
  const [requesting, setRequesting] = useState("");
  useEffect(() => {
    if (session.authenticated) api("/orders").then((data) => setOrders(data.orders || [])).catch((error) => setFeedback(error.message));
  }, [session.authenticated]);
  async function cancel(order) {
    const reason = window.prompt("Reason for cancellation request (optional):", "");
    if (reason === null) return;
    setRequesting(order.reference);
    try { await api("/orders/" + encodeURIComponent(order.reference) + "/cancellation", { method: "POST", body: { reason: reason.slice(0, 300) } }); setFeedback("Cancellation request received for " + order.reference + ". We'll review it."); }
    catch (error) { setFeedback(error.message); }
    finally { setRequesting(""); }
  }
  if (!session.authenticated) return <div className="wrap page empty-state"><h1>Sign in to see your orders</h1><Link href="/login?next=%2Forders" className="button">Sign in</Link></div>;
  return <div className="wrap page"><div className="page-heading"><h1>My orders</h1></div><p className="form-message" role="status">{feedback}</p>{orders.length ? <div className="orders-grid">{orders.map((order) => <article className="panel" key={order.reference}><h2>Order {order.reference}</h2><p>{order.statusLabel || order.status} · {money(order.amount)}</p><p className="subtle">{order.deliveryLabel}</p>{order.paymentStatus === "paid" && <a href={apiRoot + "/orders/" + encodeURIComponent(order.reference) + "/invoice"} target="_blank" rel="noopener noreferrer" className="text-link">Download invoice</a>}{order.paymentStatus === "paid" && order.status !== "delivered" && order.status !== "cancelled" && <button type="button" className="text-link" disabled={requesting === order.reference} onClick={() => cancel(order)}>Request cancellation</button>}</article>)}</div> : !feedback && <div className="empty-state"><h2>No orders yet</h2><p>Your confirmed orders will appear here.</p><Link href="/shop" className="button">Explore cakes</Link></div>}</div>;
}
