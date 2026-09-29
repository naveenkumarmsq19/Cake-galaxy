"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { products as initialProducts, unitPrice } from "@cake-galaxy/catalog";

const StoreContext = createContext(null);
const API_URL = (process.env.NEXT_PUBLIC_API_URL || "/api").replace(/\/$/, "");
const basketKey = "cakegalaxy.basket.v2";
const checkoutKey = "cakegalaxy.checkout.v2";

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("Store provider is missing");
  return store;
}

export function StoreProvider({ children }) {
  const [catalog, setCatalog] = useState(initialProducts);
  const [cart, setCart] = useState([]);
  const cartRef = useRef([]);
  const [hydrated, setHydrated] = useState(false);
  const [session, setSession] = useState({ authenticated: false, phone: "", csrfToken: "" });
  const [pincode, setPincode] = useState("");
  const [quote, setQuote] = useState(null);
  const [address, setAddress] = useState(null);
  const [sender, setSender] = useState(null);
  const [delivery, setDelivery] = useState({ date: "", slot: "" });
  const [receipt, setReceipt] = useState(null);

  async function api(path, { method = "GET", body, formData, skipCsrf = false } = {}) {
    let response;
    try {
      response = await fetch(API_URL + path, {
        method, credentials: "include", cache: "no-store",
        headers: {
          Accept: "application/json",
          ...(!formData && body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(!skipCsrf && session.csrfToken ? { "X-CSRF-Token": session.csrfToken } : {})
        },
        body: formData || (body === undefined ? undefined : JSON.stringify(body))
      });
    } catch {
      const error = new Error("The store service isn't connected right now.");
      error.serviceUnavailable = true;
      throw error;
    }
    const isJson = response.headers.get("content-type")?.includes("application/json");
    const result = isJson ? await response.json().catch(() => ({})) : {};
    if (!response.ok || !isJson) {
      const error = new Error(result.error || result.message || "The store service isn't connected right now.");
      error.status = response.status;
      error.serviceUnavailable = !isJson || [404, 502, 503, 504].includes(response.status);
      throw error;
    }
    return result;
  }

  async function checkDelivery(pin) {
    if (!/^[1-9][0-9]{5}$/.test(pin)) throw new Error("Enter a valid 6-digit pincode.");
    try {
      const available = await api("/delivery?pincode=" + encodeURIComponent(pin));
      if (typeof available.available !== "boolean") throw Object.assign(new Error("Delivery could not be confirmed yet."), { serviceUnavailable: true });
      if (available.available) {
        setPincode(pin);
        setQuote(available);
      } else {
        setQuote(null);
      }
      return available;
    } catch (error) {
      if (!error.serviceUnavailable) throw error;
      setPincode(pin);
      setQuote(null);
      return { available: null, unverified: true };
    }
  }

  async function refreshSession() {
    const current = await api("/session", { skipCsrf: true });
    setSession(current);
    return current;
  }

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(basketKey) || "[]");
      if (Array.isArray(saved) && !cartRef.current.length) {
        const basket = saved.filter((item) => initialProducts.some((p) => p.id === item.productId && p.weights.includes(Number(item.size))) && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 20).slice(0, 30);
        cartRef.current = basket;
        setCart(basket);
      }
    } catch { /* Device storage is optional. */ }
    try {
      const saved = JSON.parse(sessionStorage.getItem(checkoutKey) || "null");
      if (saved?.address?.pincode && saved?.sender?.phone && saved?.delivery) {
        setAddress(saved.address);
        setSender(saved.sender);
        setDelivery(saved.delivery);
        setPincode(saved.address.pincode);
      }
    } catch { /* Checkout details can be entered again. */ }
    setHydrated(true);
    refreshSession().catch(() => {});
    api("/catalog", { skipCsrf: true }).then((data) => {
      if (Array.isArray(data.products) && data.products.length) setCatalog(data.products);
    }).catch(() => {});
  }, []);

  function saveCart(next) {
    cartRef.current = next;
    setCart(next);
    try { localStorage.setItem(basketKey, JSON.stringify(next)); } catch {}
  }
  function addItem(item) {
    saveCart([...cartRef.current, { ...item, id: crypto.randomUUID(), quantity: item.quantity || 1 }]);
  }
  function changeQuantity(id, delta) {
    saveCart(cartRef.current.map((item) => item.id === id ? { ...item, quantity: Math.min(20, Math.max(1, item.quantity + delta)) } : item));
  }
  function removeItem(id) { saveCart(cartRef.current.filter((item) => item.id !== id)); }
  function clearCart() {
    saveCart([]);
    try { sessionStorage.removeItem(checkoutKey); } catch {}
    setAddress(null);
    setSender(null);
    setDelivery({ date: "", slot: "" });
    setQuote(null);
  }
  function saveCheckoutDetails(details) {
    setAddress(details.address);
    setSender(details.sender);
    setDelivery(details.delivery);
    setPincode(details.address.pincode);
    try { sessionStorage.setItem(checkoutKey, JSON.stringify(details)); } catch {}
  }
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + unitPrice(item, catalog.find((p) => p.id === item.productId)) * item.quantity, 0);

  return <StoreContext.Provider value={{ api, checkDelivery, catalog, cart, count, subtotal, hydrated, session, setSession, refreshSession, pincode, setPincode, quote, setQuote, address, setAddress, sender, setSender, delivery, setDelivery, receipt, setReceipt, addItem, changeQuantity, removeItem, clearCart, saveCheckoutDetails }}>
    {children}
  </StoreContext.Provider>;
}

const paths = {
  search: <><circle cx="10.8" cy="10.8" r="7.2"/><path d="m16 16 5 5"/></>,
  bag: <><path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/></>,
  arrow: <path d="M4 12h16M14 6l6 6-6 6"/>,
  home: <><path d="m3 10 9-7 9 7v11H3V10Z"/><path d="M9 21v-8h6v8"/></>,
  orders: <><path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/></>,
  chat: <><path d="M21 11a9 9 0 0 1-9 9H4l-3 3V11a10 10 0 0 1 20 0Z"/><path d="M6 10h10M6 14h6"/></>
};

export function Icon({ name }) { return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>; }

export function Header() {
  const { count, session, pincode, quote, checkDelivery } = useStore();
  const path = usePathname();
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [feedback, setFeedback] = useState("");
  async function confirmPincode(event) {
    event.preventDefault();
    setFeedback("");
    if (!/^[1-9]\d{5}$/.test(pin)) { setFeedback("Enter a valid 6-digit pincode."); return; }
    try {
      const available = await checkDelivery(pin);
      if (available.available !== true) { setFeedback(available.available === false ? "Delivery isn't available to that pincode yet." : "Delivery could not be confirmed right now. Please try again."); return; }
      setDeliveryOpen(false);
    } catch (error) { setFeedback(error.message); }
  }

  return <>
    <header className="site-header">
      <div className="header-main wrap">
        <Link className="brand" href="/" aria-label="Cake Galaxy home"><span className="brand-monogram">cg.</span><span className="brand-wordmark">cake galaxy<small>MADE FOR YOUR MOMENTS</small></span></Link>
        <form className="header-search" action="/shop" role="search"><Icon name="search"/><input name="q" type="search" aria-label="Search cakes" placeholder="Find your favourite cake"/><button type="submit" aria-label="Search"><Icon name="arrow"/></button></form>
        <button className="delivery-button" type="button" onClick={() => { setPin(pincode); setDeliveryOpen(true); }}><span><small>{quote?.available ? "DELIVER TO" : "CHECK DELIVERY"}</small><strong>{pincode || "Enter pincode"}</strong></span></button>
        <div className="header-actions"><Link className="header-action" href="/orders" aria-label="Account"><Icon name="user"/><span>Account</span></Link><Link className="header-action bag-link" href="/cart" aria-label="Shopping bag"><Icon name="bag"/><span>Bag</span>{count > 0 && <b className="cart-count">{count}</b>}</Link></div>
      </div>
      <nav className="category-nav" aria-label="Shop categories"><div className="wrap category-inner">
        <Link href="/shop">All cakes</Link><Link href="/shop?category=Birthday">Birthday</Link><Link href="/shop?category=Anniversary">Anniversary</Link><Link href="/shop?category=Chocolate">Chocolate cakes</Link><Link href="/shop?category=Photo">Photo cakes</Link><Link href="/shop?category=Kids">Kids' cakes</Link><Link href="/custom">Custom cakes <span>Made for you</span></Link>
      </div></nav>
    </header>
    <nav className="mobile-nav" aria-label="Mobile navigation">{[["/", "home", "Home"], ["/shop", "search", "Cakes"], ["/orders", "orders", "Orders"], ["/cart", "bag", "Bag"]].map(([href, icon, label]) => <Link key={label} href={href} className={path === href ? "active" : ""} aria-current={path === href ? "page" : undefined}><Icon name={icon}/>{label}</Link>)}</nav>
    {deliveryOpen && <div className="modal-backdrop" onClick={() => setDeliveryOpen(false)}><div className="dialog dialog-open" role="dialog" aria-modal="true" aria-label="Check delivery" onClick={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setDeliveryOpen(false)} aria-label="Close">×</button><h2>Where's the celebration?</h2><p>Enter your pincode to check delivery.</p><form onSubmit={confirmPincode}><label htmlFor="delivery-pin">Delivery pincode</label><input id="delivery-pin" value={pin} onChange={(event) => setPin(event.target.value)} inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} required/><p className="form-message" role="status">{feedback}</p><button className="button full">Check availability</button></form></div></div>}
  </>;
}

export function Footer() { return <footer className="site-footer"><div className="wrap footer-grid"><div className="footer-brand"><Link href="/" className="brand"><span className="brand-monogram">cg.</span><span className="brand-wordmark">cake galaxy</span></Link><p>A cake for the little moments.<br/>A centrepiece for the big ones.</p></div><div><h2>Find your cake</h2><Link href="/shop?category=Birthday">Birthday cakes</Link><Link href="/shop?category=Anniversary">Anniversary cakes</Link><Link href="/custom">Custom creations</Link></div><div><h2>Here to help</h2><Link href="/orders">My orders</Link><Link href="/help">Help & contact</Link><Link href="/policy?type=refund">Cancellation & refunds</Link></div><div><h2>The details</h2><Link href="/policy?type=delivery">Delivery information</Link><Link href="/policy?type=terms">Terms & conditions</Link><Link href="/policy?type=privacy">Privacy</Link></div></div><div className="wrap footer-bottom"><span>© {new Date().getFullYear()} Cake Galaxy</span><span>UPI / Cards / Netbanking</span></div></footer>; }

function answer(message) {
  if (/cancel|refund/i.test(message)) return "Open My orders to request cancellation. Eligibility is reviewed before a refund decision.";
  if (/custom|design|photo/i.test(message)) return "Choose a sample on Custom cakes or upload a reference. We'll confirm the design and price before payment.";
  if (/delivery|pincode|slot/i.test(message)) return "Check your delivery pincode before choosing a date and slot in your bag.";
  if (/invoice|gst/i.test(message)) return "Add business GST details at checkout. Your invoice becomes available on a confirmed order when billing is configured.";
  return "I can help with delivery, custom cakes, invoices and cancellation. What would you like to know?";
}

export function Support() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ sent: false, text: "Hi there! What can I help you with?" }]);
  const [message, setMessage] = useState("");
  function send(value) { const text = value.trim(); if (text) { setMessages((items) => [...items, { sent: true, text }, { sent: false, text: answer(text) }]); setMessage(""); } }
  return <><button className="chat-launcher" type="button" onClick={() => setOpen(!open)} aria-label="Open Cake Galaxy support"><Icon name="chat"/></button>{open && <aside className="support-panel" aria-label="Cake Galaxy support"><div className="support-header"><strong>Cake Galaxy · Help with your order</strong><button type="button" onClick={() => setOpen(false)} aria-label="Close support">×</button></div><div className="chat-feed" aria-live="polite">{messages.map((item, index) => <div key={index} className={"chat-message" + (item.sent ? " sent" : "")}>{item.text}</div>)}</div><div className="quick-replies">{["Delivery", "Custom cakes", "Refunds"].map((topic) => <button key={topic} type="button" onClick={() => send(topic)}>{topic}</button>)}</div><form className="chat-form" onSubmit={(event) => { event.preventDefault(); send(message); }}><input value={message} onChange={(event) => setMessage(event.target.value)} aria-label="Message" placeholder="Ask a question" maxLength={500} required/><button type="submit" aria-label="Send"><Icon name="arrow"/></button></form></aside>}</>;
}
