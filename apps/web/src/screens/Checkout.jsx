"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { money, sizeLabel, unitPrice } from "@cake-galaxy/catalog";
import { useStore, Icon } from "../components/Storefront";
import { Summary } from "../components/Products";
import PhoneVerification from "../components/PhoneVerification";

const apiRoot = (process.env.NEXT_PUBLIC_API_URL || "/api").replace(/\/$/, "");
const slots = ["10 AM – 1 PM", "1 PM – 4 PM", "4 PM – 7 PM", "7 PM – 10 PM"];

function EmptyBag() { return <div className="wrap page empty-state"><h1>Your bag is waiting</h1><p>Find a cake, add a personal touch and make someone's day.</p><Link href="/shop" className="button">Find your cake</Link></div>; }

export function Cart() {
  const { cart, catalog, removeItem, changeQuantity, delivery, setDelivery, hydrated, pincode, quote } = useStore();
  if (!hydrated) return <div className="wrap page empty-state"><h1>Opening your bag…</h1></div>;
  if (!cart.length) return <EmptyBag/>;
  return <div className="wrap page"><div className="page-heading"><h1>Your celebration bag</h1></div><div className="checkout-layout"><div><div className="panel">{cart.map((item) => { const product = catalog.find((p) => p.id === item.productId); if (!product) return null; return <article className="cart-item" key={item.id}><img src={product.image} alt={product.name}/><div><h3><Link href={"/product?id=" + product.id}>{product.name}</Link></h3><p>{sizeLabel(product, item.size)} · {item.flavour}{item.eggless ? " · Eggless" : ""}</p>{item.message && <p>“{item.message}”</p>}<div className="quantity"><button type="button" onClick={() => changeQuantity(item.id, -1)} aria-label="Decrease quantity">−</button><output>{item.quantity}</output><button type="button" onClick={() => changeQuantity(item.id, 1)} aria-label="Increase quantity">+</button></div></div><div className="cart-price"><span>{money(unitPrice(item, product) * item.quantity)}</span><button type="button" className="icon-button" onClick={() => removeItem(item.id)} aria-label={"Remove " + product.name}>×</button></div></article>; })}</div><div className="panel"><h2>When is the celebration?</h2>{pincode && <p className="subtle">Pincode {pincode}: {quote?.available ? "delivery available" : "availability will be confirmed before payment"}.</p>}<div className="field-row"><div className="field"><label htmlFor="bag-date">Preferred date</label><input id="bag-date" type="date" value={delivery.date} onChange={(event) => setDelivery((current) => ({ ...current, date: event.target.value }))}/></div><div className="field"><label htmlFor="bag-slot">Preferred time</label><select id="bag-slot" value={delivery.slot} onChange={(event) => setDelivery((current) => ({ ...current, slot: event.target.value }))}><option value="">Select a time</option>{slots.map((value) => <option key={value}>{value}</option>)}</select></div></div><p className="subtle">Availability and delivery charges are confirmed before payment.</p></div><p><Link href="/shop" className="text-link">Continue shopping</Link></p></div><Summary><Link href="/address" className="button full">Add delivery details <Icon name="arrow"/></Link></Summary></div></div>;
}

export function Address() {
  const router = useRouter();
  const { cart, address, sender, pincode, delivery, checkDelivery, saveCheckoutDetails, session, hydrated } = useStore();
  const [senderPhone, setSenderPhone] = useState(sender?.phone || session.phone || "");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (session.authenticated && !senderPhone) setSenderPhone(session.phone); }, [session.phone, session.authenticated]);
  if (!hydrated) return <div className="wrap page empty-state"><h1>Loading your delivery details…</h1></div>;
  if (!cart.length) return <EmptyBag/>;

  async function submit(event) {
    event.preventDefault(); setFeedback("");
    if (!session.authenticated || session.phone !== senderPhone) { setFeedback("Verify your mobile number before continuing."); return; }
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    try {
      const available = await checkDelivery(data.pincode);
      if (available.available === false) throw new Error("We can't deliver to this pincode yet.");
      saveCheckoutDetails({
        sender: { name: data.senderName.trim(), phone: senderPhone },
        address: { name: data.recipientName.trim(), phone: data.recipientPhone, line1: data.line1, line2: data.line2, pincode: data.pincode, city: data.city, whatsapp: data.whatsapp === "on" },
        delivery: { date: data.date, slot: data.slot }
      });
      router.push("/checkout");
    } catch (error) { setFeedback(error.message); }
    finally { setBusy(false); }
  }

  return <div className="wrap page"><div className="page-heading"><div><h1>Delivery details</h1><p>Tell us who is ordering and who will receive the cake.</p></div></div><div className="checkout-layout"><form onSubmit={submit}>
    <section className="panel checkout-section"><h2>Your details</h2><p className="subtle">We will use your verified number for this order, updates and My orders.</p><div className="field"><label htmlFor="sender-name">Your name</label><input id="sender-name" name="senderName" defaultValue={sender?.name || ""} maxLength={80} autoComplete="name" required/></div><PhoneVerification phone={senderPhone} onPhoneChange={setSenderPhone}/><label className="check-label"><input name="whatsapp" type="checkbox" defaultChecked={address?.whatsapp}/>Send order updates to your verified number on WhatsApp</label></section>
    <section className="panel checkout-section"><h2>Recipient details</h2><p className="subtle">Enter the person who will receive the cake. Their number can be different from yours.</p><div className="field-row"><div className="field"><label htmlFor="recipient-name">Recipient name</label><input id="recipient-name" name="recipientName" defaultValue={address?.name || ""} maxLength={80} required/></div><div className="field"><label htmlFor="recipient-phone">Recipient mobile number</label><input id="recipient-phone" name="recipientPhone" type="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} defaultValue={address?.phone || ""} required/></div></div><div className="field"><label htmlFor="line1">House / flat and street</label><input id="line1" name="line1" defaultValue={address?.line1} maxLength={160} required/></div><div className="field"><label htmlFor="line2">Area / landmark (optional)</label><input id="line2" name="line2" defaultValue={address?.line2} maxLength={160}/></div><div className="field-row"><div className="field"><label htmlFor="pincode">Delivery pincode</label><input id="pincode" name="pincode" inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} defaultValue={address?.pincode || pincode} required/></div><div className="field"><label htmlFor="city">City</label><input id="city" name="city" defaultValue={address?.city || "Bengaluru"} maxLength={60} required/></div></div></section>
    <section className="panel checkout-section"><h2>Delivery time</h2><div className="field-row"><div className="field"><label htmlFor="date">Preferred delivery date</label><input id="date" name="date" type="date" defaultValue={delivery.date} required/></div><div className="field"><label htmlFor="slot">Preferred time</label><select id="slot" name="slot" defaultValue={delivery.slot} required><option value="">Select a time</option>{slots.map((value) => <option key={value}>{value}</option>)}</select></div></div><p className="form-message" role="status">{feedback}</p><button className="button full" disabled={busy}>Review your order <Icon name="arrow"/></button></section>
  </form><Summary/></div></div>;
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
  const { cart, address, sender, delivery, quote, subtotal, session, api, checkDelivery, clearCart, setReceipt, hydrated } = useStore();
  const [config, setConfig] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [gstEnabled, setGstEnabled] = useState(false);
  const [payment, setPayment] = useState("upi");
  const attempt = useRef(null);
  useEffect(() => { api("/checkout/config").then((value) => { setConfig(value); if (value.testCodEnabled && !value.paymentsEnabled) setPayment("test_cod"); }).catch((error) => setFeedback(error.message)); }, [session.authenticated, session.phone]);
  useEffect(() => {
    if (hydrated && address?.pincode && !quote?.available) checkDelivery(address.pincode).then((result) => {
      if (result.available === false) setFeedback("Delivery isn't available to this pincode. Please edit your address.");
    }).catch((error) => setFeedback(error.message));
  }, [hydrated, address?.pincode]);
  if (!hydrated) return <div className="wrap page empty-state"><h1>Preparing checkout…</h1></div>;
  if (!cart.length) return <EmptyBag/>;
  if (!address || !sender || !delivery.date || !delivery.slot) return <div className="wrap page empty-state"><h1>Add delivery details first</h1><Link href="/address" className="button">Add delivery details</Link></div>;
  if (!session.authenticated || session.phone !== sender.phone) return <div className="wrap page empty-state"><h1>Verify your number to continue</h1><p>Return to your delivery details and verify your mobile number.</p><Link href="/address" className="button">Verify number</Link></div>;

  async function submit(event) {
    event.preventDefault(); setFeedback("");
    if (!session.authenticated || session.phone !== sender.phone) { router.push("/address"); return; }
    if (!(payment === "test_cod" ? config?.testCodEnabled : config?.paymentsEnabled) || !quote?.available) { setFeedback("This payment option or delivery address isn't available. No charge has been made."); return; }
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const fingerprint = JSON.stringify({ cart, sender, address, delivery, payment, gstEnabled, gstin: form.get("gstin"), business: form.get("business"), billingAddress: form.get("billingAddress") });
      if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, key: crypto.randomUUID() };
      const idempotencyKey = attempt.current.key;
      const data = await api("/checkout/orders", { method: "POST", body: {
        items: cart.map(({ productId, size, quantity, flavour, eggless, message, addons, uploadId }) => ({ productId, size, quantity, flavour, eggless, message, addons, uploadId })),
        sender, address, delivery, preferredMethod: payment,
        gst: gstEnabled ? { gstin: form.get("gstin"), business: form.get("business"), billingAddress: form.get("billingAddress") } : null,
        idempotencyKey
      } });
      if (!data.reference || !Number.isSafeInteger(data.amount) || (payment !== "test_cod" && !data.orderId)) throw new Error("Order couldn't be prepared. No charge has been made.");
      const expected = subtotal + (quote?.available ? quote.deliveryFee : 0) + Math.round(subtotal * config.taxRate / 100);
      if (!quote?.available || data.amount !== expected) throw new Error("The order total has changed. Please review your bag and delivery details before paying.");
      if (payment === "test_cod") {
        if (data.status !== "confirmed" || data.order?.paymentStatus !== "test_cod") throw new Error("Test order confirmation failed. Check My orders before retrying.");
        setReceipt(data.order); attempt.current = null; clearCart(); router.push("/confirmation?reference=" + encodeURIComponent(data.reference)); return;
      }
      await loadCheckout();
      const confirmation = await new Promise((resolve, reject) => {
        const payment = new window.Razorpay({ key: config.keyId, order_id: data.orderId, amount: data.amount, currency: "INR", name: "Cake Galaxy", description: "Cake order " + data.reference, prefill: { name: sender.name, contact: "+91" + sender.phone }, theme: { color: "#738874" }, modal: { ondismiss: () => reject(new Error("Payment window closed. Your bag is saved.")) }, handler: resolve });
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

  return <div className="wrap page"><div className="checkout-layout"><div><div className="page-heading"><h1>One last look</h1></div><div className="panel checkout-address"><div><h2>Your details</h2><p><strong>{sender.name}</strong><br/>+91 {sender.phone} · Verified</p><h2>Delivering to</h2><p><strong>{address.name}</strong><br/>{address.line1}<br/>{address.line2 && <>{address.line2}<br/></>}{address.city} {address.pincode}<br/>+91 {address.phone}</p><p className="subtle">{delivery.date} · {delivery.slot}</p></div><Link href="/address" className="text-link">Edit</Link></div><form onSubmit={submit}><div className="panel"><h2>How would you like to pay?</h2>{[["upi", "UPI", "Google Pay, PhonePe and other UPI apps"], ["card", "Credit or debit card", "Choose your card in the secure payment window"], ["netbanking", "Netbanking", "Select your bank in the payment window"]].map(([id, title, info]) => <label className="payment-option" key={id}><input type="radio" name="payment" value={id} checked={payment === id} onChange={() => setPayment(id)} disabled={!config?.paymentsEnabled}/><span><strong>{title}</strong><small>{info}</small></span></label>)}{config?.testCodEnabled && <label className="payment-option"><input type="radio" name="payment" value="test_cod" checked={payment === "test_cod"} onChange={() => setPayment("test_cod")}/><span><strong>Cash on delivery · Test only</strong><small>No payment is collected. The order is marked as a test.</small></span></label>}<p className="subtle">{payment === "test_cod" ? "Test orders do not generate invoices or WhatsApp updates." : "Available payment methods are confirmed in Razorpay."}</p></div><div className="panel"><h2>Billing details</h2><label className="check-label"><input type="checkbox" checked={gstEnabled} onChange={(event) => setGstEnabled(event.target.checked)}/>Add GST details for a business invoice</label>{gstEnabled && <><div className="field"><label htmlFor="gstin">GSTIN</label><input id="gstin" name="gstin" maxLength={15} required/></div><div className="field"><label htmlFor="business">Registered business name</label><input id="business" name="business" maxLength={120} required/></div><div className="field"><label htmlFor="billingAddress">Business billing address</label><input id="billingAddress" name="billingAddress" maxLength={250} required/></div></>}</div><div className="panel"><label className="check-label"><input type="checkbox" required/>I agree to the terms and cancellation policy.</label><p className="subtle"><Link href="/policy?type=terms">Terms</Link> · <Link href="/policy?type=refund">Cancellation & refunds</Link></p><p className="form-message" role="status">{feedback}</p>{!config?.paymentsEnabled && payment !== "test_cod" && <p className="subtle">Online payment is unavailable until the store is activated.</p>}{!quote?.available && <p className="subtle">Delivery availability is still unconfirmed. <Link href="/address">Check address</Link></p>}<button className="button full" disabled={busy || !(payment === "test_cod" ? config?.testCodEnabled : config?.paymentsEnabled) || !quote?.available}>{busy ? "Please wait…" : payment === "test_cod" ? "Place test order" : "Continue to Razorpay"}</button></div></form></div><Summary taxRate={config?.taxRate}/></div></div>;
}

export function Login() {
  const params = useSearchParams();
  const router = useRouter();
  const requested = params.get("next") || "/orders";
  const destination = requested === "/checkout" ? "/address" : requested.startsWith("/") && !requested.startsWith("//") ? requested : "/orders";
  useEffect(() => { router.replace(destination); }, [destination, router]);
  return <div className="wrap page empty-state"><h1>Continue on this page</h1><p>Phone verification now happens in your delivery details or My orders.</p><Link href={destination} className="button">Continue</Link></div>;
}

export function Confirmation() {
  const params = useSearchParams();
  const router = useRouter();
  const { api, receipt, session } = useStore();
  const [order, setOrder] = useState(receipt);
  const [feedback, setFeedback] = useState("");
  const reference = params.get("reference");
  useEffect(() => { if (reference && session.authenticated) api("/orders/" + encodeURIComponent(reference)).then((result) => setOrder(result.order)).catch((error) => setFeedback(error.message)); }, [reference, session.authenticated]);
  if (!order || order.reference !== reference || !(["paid", "test_cod"].includes(order.paymentStatus))) return <div className="wrap page empty-state"><h1>Checking your order</h1><p>{feedback || "We'll show your confirmation once payment is verified."}</p><Link className="button" href="/orders">My orders</Link></div>;
  return <div className="wrap page empty-state"><h1>{order.testOrder ? "Your test order is confirmed" : "Your order is confirmed"}</h1><p>Order {order.reference} · {money(order.amount)}</p>{order.testOrder && <p>No payment was collected. This is a test order.</p>}<p>{order.deliveryLabel}</p><button className="button" type="button" onClick={() => router.push("/orders")}>View my orders</button></div>;
}

export function Orders() {
  const { api, session } = useStore();
  const [orders, setOrders] = useState([]);
  const [feedback, setFeedback] = useState("");
  const [requesting, setRequesting] = useState("");
  const [phone, setPhone] = useState("");
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
  if (!session.authenticated) return <div className="wrap page"><div className="orders-verification panel"><h1>My orders</h1><p>Verify the number you used to place your order.</p><PhoneVerification phone={phone} onPhoneChange={setPhone}/></div></div>;
  return <div className="wrap page"><div className="page-heading"><h1>My orders</h1></div><p className="form-message" role="status">{feedback}</p>{orders.length ? <div className="orders-grid">{orders.map((order) => <article className="panel" key={order.reference}><h2>Order {order.reference}</h2><p>{order.statusLabel || order.status} · {money(order.amount)}</p><p className="subtle">{order.deliveryLabel}</p>{order.testOrder && <p className="subtle">Test order · Cash on delivery · No payment collected</p>}{order.paymentStatus === "paid" && <a href={apiRoot + "/orders/" + encodeURIComponent(order.reference) + "/invoice"} target="_blank" rel="noopener noreferrer" className="text-link">Download invoice</a>}{["paid", "test_cod"].includes(order.paymentStatus) && order.status !== "delivered" && order.status !== "cancelled" && <button type="button" className="text-link" disabled={requesting === order.reference} onClick={() => cancel(order)}>Request cancellation</button>}</article>)}</div> : !feedback && <div className="empty-state"><h2>No orders yet</h2><p>Your confirmed orders will appear here.</p><Link href="/shop" className="button">Explore cakes</Link></div>}</div>;
}
