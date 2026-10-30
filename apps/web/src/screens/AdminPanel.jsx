"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AdminProducts from "../components/AdminProducts";
import AdminCategories from "../components/AdminCategories";
import AdminOrderAlerts from "../components/AdminOrderAlerts";
import CakeLoader from "../components/CakeLoader";

const API_ROOT = (process.env.NEXT_PUBLIC_API_URL || "/api").replace(/\/$/, "");
const rupees = (paise) => "₹" + (Number(paise || 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const steps = { confirmed: "preparing", preparing: "out_for_delivery", out_for_delivery: "delivered" };
const sections = ["Overview", "Orders", "Custom requests", "Branches", "Coverage", "Team", "Products", "Categories"];
const emptyProduct = { id: "", name: "", price: "", variantPrices: "", category: "", flavour: "", image: "", weights: "0.5,1", unit: "kg", description: "", active: false, eggless: false, photo: false };
const sizePriceText = (prices) => Object.entries(prices || {}).map(([key, value]) => key.replace(/^w_/, "").replace("_", ".") + ":" + (Number(value) / 100)).join(", ");
function parseSizePrices(value) {
  const result = {};
  for (const part of value.split(",").map((item) => item.trim()).filter(Boolean)) {
    const pair = part.split(":");
    if (pair.length !== 2 || !/^(?:[0-9]+)(?:\.[0-9]+)?$/.test(pair[0].trim()) || !/^\d+(?:\.\d{1,2})?$/.test(pair[1].trim())) throw new Error("Use size:price format, e.g. 0.5:749, 1:1399");
    const key = "w_" + String(Number(pair[0].trim())).replace(".", "_");
    const paise = Math.round(Number(pair[1].trim()) * 100);
    if (!Number.isSafeInteger(paise) || paise <= 0) throw new Error("Every variant price must be positive.");
    result[key] = paise;
  }
  return result;
}

function CancellationReview({ order, busy, execute, request, superAdmin }) {
  const [rejectReason, setRejectReason] = useState("");
  const cancellation = order.cancellation;
  if (!cancellation) return null;
  const ref = "orders/" + encodeURIComponent(order.reference);
  const refund = cancellation.refund;
  return <div className="admin-attention">
    <strong>Cancellation: {cancellation.status === "requested" ? "Needs review" : cancellation.status === "approved" ? "Approved" : "Declined"}</strong>
    <p><strong>Customer reason:</strong> {cancellation.reason}</p>
    {cancellation.status === "rejected" && <p><strong>Declined because:</strong> {cancellation.reviewReason}</p>}
    {cancellation.status === "requested" && superAdmin && <div className="admin-actions">
      <button type="button" className="admin-primary" disabled={busy}
        onClick={() => { if (window.confirm("Approve cancellation and stop processing this order? Refunds require a separate action.")) execute(() => request(ref + "/cancellation-approval", "POST"), "Cancellation approved"); }}>
        Approve cancellation
      </button>
      <label>Decline reason
        <textarea value={rejectReason} minLength={5} maxLength={300} rows={2}
          onChange={(e) => setRejectReason(e.target.value)} placeholder="Tell the customer why the request was declined"/>
      </label>
      <button type="button" className="admin-ghost" disabled={busy || rejectReason.trim().length < 5}
        onClick={() => execute(() => request(ref + "/cancellation-rejection", "POST", { reason: rejectReason.trim() }), "Cancellation declined")}>
        Decline cancellation
      </button>
    </div>}
    {cancellation.status === "approved" && <>
      {order.testOrder || order.paymentMethod === "cod"
        ? <p>{order.testOrder ? "Test order" : "COD order"} cancelled; no money was collected.</p>
        : <p>Razorpay refund: <strong>{refund?.status || "not started"}</strong>
          {refund?.id && <> · {refund.id}</>} · {rupees(refund?.amount || order.amount)}
        </p>}
      {superAdmin && !order.testOrder && order.paymentMethod !== "cod" && <div className="admin-actions">
        {refund?.status === "ready" && <button type="button" className="admin-primary" disabled={busy}
          onClick={() => { if (window.confirm("Issue a FULL " + rupees(order.amount) + " Razorpay refund for order " + order.reference + "? This transfers money back to the customer.")) execute(() => request(ref + "/cancellation-refund", "POST"), "Refund request submitted to Razorpay"); }}>
          Issue full refund · {rupees(order.amount)}
        </button>}
        {refund?.id && refund.status !== "processed" && <button type="button" className="admin-ghost" disabled={busy}
          onClick={() => execute(() => request(ref + "/cancellation-refund-refresh", "POST"), "Refund status refreshed from Razorpay")}>
          Refresh refund status
        </button>}
      </div>}
    </>}
  </div>;
}

function CustomQuoteForm({ item, busy, execute, request }) {
  const [price, setPrice] = useState(
    Number.isSafeInteger(item.quotedPrice) ? (item.quotedPrice / 100).toFixed(2) : ""
  );
  const [notes, setNotes] = useState(item.quoteNotes || "");
  const [copyFeedback, setCopyFeedback] = useState("");
  const savedQuote = Number.isSafeInteger(item.quotedPrice) && item.quotedPrice > 0;
  function submit(event) {
    event.preventDefault();
    const clean = price.trim();
    if (!/^[1-9]\d{0,6}(?:\.\d{1,2})?$/.test(clean)) {
      setCopyFeedback("Enter a valid rupee amount, up to two decimal places.");
      return;
    }
    const [rupeePart, paisePart = ""] = clean.split(".");
    const quotedPrice = Number(rupeePart) * 100 + Number((paisePart + "00").slice(0, 2));
    if (!Number.isSafeInteger(quotedPrice) || quotedPrice < 100 || quotedPrice > 100_000_000) {
      setCopyFeedback("Quote must be between ₹1 and ₹10,00,000.");
      return;
    }
    setCopyFeedback("");
    execute(
      () => request("custom-requests/" + encodeURIComponent(item.reference), "PATCH", {
        status: "quoted", quotedPrice, quoteNotes: notes.trim()
      }),
      "Final quotation saved. Contact the customer to share it."
    );
  }
  const quoteMessage = savedQuote
    ? "Cake Galaxy: Your custom cake request " + item.reference + " (" + item.flavour + ", " + item.weight +
      ") has been reviewed. The quoted price is " + rupees(item.quotedPrice) + "." +
      (item.quoteNotes ? " " + item.quoteNotes : "") + " Please contact us to confirm before payment."
    : "";
  return <div className="admin-quote-panel">
    <h3>Set final Design Cake quote</h3>
    {savedQuote && <p><strong>Current quotation:</strong> {rupees(item.quotedPrice)}
      {item.quotedAt && <> · {new Date(item.quotedAt).toLocaleString("en-IN")}</>}
      {item.quoteNotes && <span className="admin-quote-note"> · {item.quoteNotes}</span>}
    </p>}
    <form onSubmit={submit} className="admin-quote-form">
      <label>Final price (₹)
        <input type="number" inputMode="decimal" min="1" max="1000000" step="0.01"
          value={price} onChange={(event) => setPrice(event.target.value)}
          placeholder="Enter final cake quote" required/>
      </label>
      <label>Quote details (optional)
        <textarea rows={2} maxLength={500} value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Decoration, delivery or other inclusions and conditions"/>
      </label>
      <button className="admin-primary" disabled={busy}>{savedQuote ? "Update final quote" : "Save final quote"} · Mark Quoted</button>
    </form>
    {copyFeedback && <p role="status">{copyFeedback}</p>}
    {savedQuote && <button type="button" className="admin-ghost" onClick={async () => {
      try { await navigator.clipboard.writeText(quoteMessage); setCopyFeedback("Quote message copied. Paste it to the customer yourself."); }
      catch { setCopyFeedback("Copy unavailable. Please share the displayed quote manually."); }
    }}>Copy customer quote message</button>}
    <p className="admin-muted">Saving a quote does not send WhatsApp/SMS or create a payable order. Share it with the customer manually.</p>
  </div>;
}

export default function AdminPanel() {
  const [user, setUser] = useState(null);
  const csrf = useRef("");
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState("Overview");
  const [login, setLogin] = useState({ email: "", password: "" });
  const [data, setData] = useState({ summary: {}, orders: [], requests: [], branches: [], areas: [], users: [], products: [], categories: [] });
  const [branchDraft, setBranchDraft] = useState({ code: "", name: "", address: "", basePincode: "" });
  const [coverageDraft, setCoverageDraft] = useState({ pincode: "", branchId: "", fee: "49" });
  const [managerDraft, setManagerDraft] = useState({ name: "", email: "", password: "", branchId: "" });
  const [productDraft, setProductDraft] = useState(emptyProduct);
  const [editingProduct, setEditingProduct] = useState("");
  const [orderFilter, setOrderFilter] = useState("");
  const [targets, setTargets] = useState({});
  const [resetPasswords, setResetPasswords] = useState({});

  const request = useCallback(async (path, method = "GET", body) => {
    let response;
    try {
      response = await fetch(API_ROOT + "/admin/" + path, {
        method, credentials: "include", cache: "no-store",
        headers: { Accept: "application/json", ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(method !== "GET" && csrf.current ? { "X-CSRF-Token": csrf.current } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch { throw new Error("Unable to connect to the admin API (" + API_ROOT + "). Check the Render health URL, Cloudflare NEXT_PUBLIC_API_URL, and Render WEB_ORIGINS settings."); }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 429) throw new Error("Too many sign-in attempts. Wait 15 minutes before trying again.");
      if (response.status === 401 && payload.error === "Admin sign in required." && path !== "me") {
        throw new Error("Your admin session was not saved. On Cloudflare Pages, set NEXT_PUBLIC_API_URL to /api, redeploy the website, then sign in again.");
      }
      throw new Error(payload.error || "Admin request failed (HTTP " + response.status + "). Check that the website's /api/health endpoint works and try again.");
    }
    return payload;
  }, []);

  const uploadImages = useCallback(async (productId, files) => {
    const form = new FormData();
    for (const file of files) form.append("images", file);
    const response = await fetch(API_ROOT + "/admin/products/" + encodeURIComponent(productId) + "/images", {
      method: "POST", credentials: "include", cache: "no-store",
      headers: { Accept: "application/json", "X-CSRF-Token": csrf.current }, body: form
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Photo upload failed (" + response.status + ").");
    return payload;
  }, []);

  const importGalleryBundle = useCallback(async (file) => {
    if (!file || !file.name.toLowerCase().endsWith(".zip") || file.size > 32_000_000) throw new Error("Select the prepared gallery ZIP file (max 32 MB).");
    const data = new FormData();data.append("bundle", file);
    const response = await fetch(API_ROOT + "/admin/catalogue/import-gallery-bundle", {
      method: "POST", credentials: "include", cache: "no-store",
      headers: { Accept: "application/json", "X-CSRF-Token": csrf.current }, body: data
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Gallery ZIP import failed (HTTP " + response.status + ").");
    return payload;
  }, []);

  const refresh = useCallback(async (role) => {
    const names = ["summary", "orders", "custom-requests", "branches", "service-areas", "products", "categories", ...(role === "super_admin" ? ["managers"] : [])];
    const values = await Promise.all(names.map((name) => request(name)));
    const result = Object.fromEntries(names.map((name, i) => [name, values[i]]));
    setData({ summary: result.summary, orders: result.orders.orders, requests: result["custom-requests"].requests, branches: result.branches.branches, areas: result["service-areas"].areas, products: result.products.products, categories: result.categories.categories, users: result.managers?.users || [] });
  }, [request]);

  useEffect(() => {
    let mounted = true;
    request("me").then(async (result) => {
      if (!mounted) return;
      csrf.current = result.csrfToken;
      setUser(result.user);
      await refresh(result.user.role);
    }).catch((err) => { if (mounted && !/sign in|session expired/i.test(err.message)) setError(err.message); }).finally(() => { if (mounted) setChecking(false); });
    return () => { mounted = false; };
  }, [request, refresh]);

  async function execute(action, success = "Saved") {
    setError(""); setNotice(""); setBusy(true);
    try { await action(); if (user) await refresh(user.role); setNotice(success); }
    catch (err) { if (user) await refresh(user.role).catch(() => {}); setError(err.message); }
    finally { setBusy(false); }
  }

  async function signIn(event) {
    event.preventDefault();
    setError(""); setBusy(true);
    try {
      const result = await request("login", "POST", login);
      csrf.current = result.csrfToken;
      const confirmed = await request("me");
      if (confirmed.user?.id !== result.user?.id) throw new Error("Your admin session was not saved. On Cloudflare Pages, set NEXT_PUBLIC_API_URL to /api, redeploy the website, then sign in again.");
      csrf.current = confirmed.csrfToken;
      await refresh(confirmed.user.role);
      setUser(confirmed.user);
      setLogin({ email: "", password: "" });
    } catch (err) {
      csrf.current = "";
      setUser(null);
      setError(/Admin sign in required/i.test(err.message) ? "Your admin session was not saved. On Cloudflare Pages, set NEXT_PUBLIC_API_URL to /api, redeploy the website, then sign in again." : err.message);
    }
    finally { setBusy(false); }
  }

  async function signOut() {
    setError(""); setBusy(true);
    try { await request("logout", "POST"); csrf.current = ""; setUser(null); setData({ summary: {}, orders: [], requests: [], branches: [], areas: [], users: [], products: [], categories: [] }); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  const branchName = (id) => data.branches.find((branch) => String(branch._id) === String(id))?.name || "Unassigned";
  const availableTabs = user?.role === "super_admin" ? sections : sections.filter((section) => !["Coverage", "Team"].includes(section));

  if (checking) return <div className="admin-loading"><CakeLoader size="large" fullScreen label="Loading Cake Galaxy operations…" /></div>;
  if (!user) return <div className="admin-signin"><div className="admin-login-card"><p className="admin-eyebrow">CAKE GALAXY · OPERATIONS</p><h1>Good to see you.</h1><p>Sign in to manage orders and your service areas.</p><form onSubmit={signIn}><label>Email address<input type="email" autoComplete="username" required value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })}/></label><label>Password<input type="password" autoComplete="current-password" required value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })}/></label>{error && <p className="admin-alert" role="alert">{error}</p>}<button className="admin-primary" disabled={busy}>Sign in</button>{busy && <CakeLoader size="small" label="Signing in securely…" />}</form></div></div>;

  return <div className="admin-app">
    <aside className="admin-sidebar"><div className="admin-identity"><span className="admin-mark">cg.</span><span>cake galaxy<small>OPERATIONS</small></span></div><div className="admin-side-label">WORKSPACE</div><nav aria-label="Operations">{availableTabs.map((section) => <button key={section} type="button" className={tab === section ? "selected" : ""} onClick={() => { setTab(section); setError(""); setNotice(""); }}>{section}</button>)}</nav><div className="admin-side-bottom"><strong>{user.name}</strong><span>{user.role === "super_admin" ? "Super Admin" : branchName(user.branchId) + " · Manager"}</span><button type="button" onClick={signOut}>Sign out ↗</button></div></aside>
    <div className="admin-content"><header className="admin-top"><div><p className="admin-eyebrow">STORE MANAGEMENT</p><h1>{tab}</h1></div><div className="admin-top-right"><span className="admin-role">{user.role === "super_admin" ? "All branches" : branchName(user.branchId)}</span><button type="button" className="admin-ghost" disabled={busy} onClick={() => execute(() => refresh(user.role), "Up to date")}>Refresh ↻</button></div></header>
      {busy && <div className="admin-action-loader"><CakeLoader size="small" label="Updating Cake Galaxy…" /></div>}
      <AdminOrderAlerts request={request} refresh={refresh} role={user.role} setTab={setTab}/>
      {error && <p className="admin-alert" role="alert">{error}</p>}{notice && <p className="admin-success" role="status">{notice}</p>}
      {tab === "Overview" && <><div className="admin-metrics">{[["Total orders", data.summary.orders], ["In progress", data.summary.pending], ["Custom enquiries", data.summary.requests], ["Paid revenue", rupees(data.summary.revenue)]].map(([label, value]) => <div className="admin-metric" key={label}><span>{label}</span><strong>{value ?? 0}</strong></div>)}</div><div className="admin-card"><div className="admin-card-head"><h2>Latest orders</h2><button className="admin-text" onClick={() => setTab("Orders")}>View all →</button></div><div className="admin-list">{data.orders.slice(0, 5).map((order) => <div className="admin-row" key={order.reference}><strong>#{order.reference}</strong><span>{branchName(order.branchId)}</span><span>{order.status.replaceAll("_", " ")}</span><b>{rupees(order.amount)}</b></div>)}{!data.orders.length && <p className="admin-muted">Orders will appear here when customers check out.</p>}</div></div></>}
      {tab === "Orders" && <><div className="admin-toolbar"><select aria-label="Filter orders" value={orderFilter} onChange={(e) => setOrderFilter(e.target.value)}><option value="">All statuses</option>{["pending_payment", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"].map((status) => <option key={status}>{status}</option>)}</select><span>{data.orders.filter((order) => !orderFilter || order.status === orderFilter).length} orders</span></div><div className="admin-order-grid">{data.orders.filter((order) => !orderFilter || order.status === orderFilter).map((order) => <article className="admin-card admin-order" key={order.reference}><div className="admin-card-head"><div><small>ORDER #{order.reference}</small><h2>{order.address?.name || "Customer"}</h2></div><span className="admin-pill">{order.status.replaceAll("_", " ")}</span></div><div className="admin-order-meta"><span>{branchName(order.branchId)}</span><span>{rupees(order.amount)}</span><span>{order.testOrder ? "TEST ORDER · COD" : order.paymentMethod === "cod" ? (order.paymentStatus === "cod_paid" ? "COD · CASH COLLECTED" : "COD · CASH PENDING") : order.paymentStatus}</span></div><p><strong>Ordered by:</strong> {order.sender?.name || "Customer"} · +91 {order.customerPhone}</p><p><strong>Deliver to:</strong> {order.address?.name} · +91 {order.address?.phone || order.customerPhone}<br/>{order.address?.line1}, {order.address?.line2 ? order.address.line2 + ", " : ""}{order.address?.city} {order.address?.pincode}{order.address?.location && <><br/><a className="admin-image-link" href={"https://www.openstreetmap.org/?mlat="+order.address.location.lat+"&mlon="+order.address.location.lng+"#map=17/"+order.address.location.lat+"/"+order.address.location.lng} target="_blank" rel="noreferrer">📍 View pinned delivery location ↗</a></>}</p><p>{order.delivery?.date} · {order.delivery?.slot}</p><ul>{order.items?.map((item, i) => <li key={i}>{item.quantity} × {item.name} ({item.size} {item.unit}) {item.uploadId && <a className="admin-image-link" href={API_ROOT + "/admin/orders/" + encodeURIComponent(order.reference) + "/uploads/" + encodeURIComponent(item.uploadId)} target="_blank" rel="noreferrer">View customer photo ↗</a>}</li>)}</ul><CancellationReview order={order} busy={busy} execute={execute} request={request} superAdmin={user.role === "super_admin"}/><div className="admin-actions">{steps[order.status] && ["paid", "test_cod", "cod_pending"].includes(order.paymentStatus) && !["requested", "approved"].includes(order.cancellation?.status) && (order.status === "out_for_delivery" && order.paymentMethod === "cod"
    ? <button disabled={busy} className="admin-primary" onClick={() => {
        if (window.confirm("Have you collected " + rupees(order.amount) + " in cash from the customer? This will mark the order paid and delivered."))
          execute(() => request("orders/" + encodeURIComponent(order.reference) + "/status", "PATCH", { status: "delivered", codCollected: true }), "COD cash collected; order delivered");
      }}>Confirm cash collected & delivered</button>
    : <button disabled={busy} className="admin-primary" onClick={() => execute(() => request("orders/" + encodeURIComponent(order.reference) + "/status", "PATCH", { status: steps[order.status] }), "Order updated")}>{order.status === "confirmed" ? "Accept Order ✓" : "Mark " + steps[order.status].replaceAll("_", " ")}</button>)}{user.role === "super_admin" && !["delivered", "cancelled"].includes(order.status) && !["requested", "approved"].includes(order.cancellation?.status) && <><select aria-label="Destination branch" value={targets[order.reference] || ""} onChange={(e) => setTargets({ ...targets, [order.reference]: e.target.value })}><option value="">Move to branch…</option>{data.branches.filter((b) => b.active && String(b._id) !== order.branchId).map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}</select><button disabled={busy || !targets[order.reference]} className="admin-ghost" onClick={() => { const reason = window.prompt("Reason for reassignment (recorded in history)"); if (reason?.trim()) execute(() => request("orders/" + encodeURIComponent(order.reference) + "/reassign", "POST", { branchId: targets[order.reference], reason }), "Order reassigned"); }}>Reassign</button></>}</div></article>)}{!data.orders.length && <div className="admin-card">No orders yet.</div>}</div></>}
      {tab === "Custom requests" && <div className="admin-order-grid">
        {data.requests.map((item) => <article className="admin-card" key={item.reference}>
          <div className="admin-card-head">
            <div><small>REQUEST #{item.reference}</small><h2>{item.occasion}</h2></div>
            <span className="admin-pill">{item.status}</span>
          </div>
          <p>{branchName(item.branchId)} · {item.customPincode} · {item.customPhone}</p>
          <p>{item.flavour} · {item.weight} · {item.requiredDate}</p>
          {item.flavourTier && <p><strong>Flavour tier:</strong> {item.flavourTier.charAt(0).toUpperCase() + item.flavourTier.slice(1)}</p>}
          {Number.isSafeInteger(item.estimatedCakePrice) && <p><strong>Internal cake base estimate:</strong> {rupees(item.estimatedCakePrice)} <small>(not the final design quote)</small></p>}
          {item.notes && <p><strong>Design notes:</strong> {item.notes}</p>}
          {item.uploadId && <a className="admin-image-link" href={API_ROOT + "/admin/uploads/" + encodeURIComponent(item.uploadId)} target="_blank" rel="noreferrer">View reference image ↗</a>}
          {item.sample && <p>Sample: {item.sample}</p>}
          <CustomQuoteForm item={item} busy={busy} execute={execute} request={request}/>
          <div className="admin-actions">
            {["reviewing", "closed"].map((status) =>
              <button key={status} type="button" disabled={busy || status === item.status}
                className="admin-ghost"
                onClick={() => execute(() => request("custom-requests/" + encodeURIComponent(item.reference), "PATCH", { status }), "Request updated")}>
                {status === "reviewing" ? "Mark reviewing" : "Close request"}
              </button>)}
          </div>
        </article>)}
        {!data.requests.length && <div className="admin-card">No custom requests yet.</div>}
      </div>}
      {tab === "Branches" && <><p className="admin-intro">Branch details are private and are not shown on the customer website. Both confirmed locations below remain inactive until their service pincodes are reviewed.</p><div className="admin-order-grid">{data.branches.map((branch) => <article className="admin-card" key={branch._id}><div className="admin-card-head"><div><small>{branch.code}</small><h2>{branch.name}</h2></div><span className={branch.active ? "admin-pill good" : "admin-pill"}>{branch.active ? "Active" : "Inactive"}</span></div><p>{branch.address}</p><p>Base PIN {branch.basePincode} · {branch.radiusKm} km planned radius</p><small className="admin-muted">Branch ID: {branch._id}</small>{user.role === "super_admin" && <div className="admin-actions"><button className="admin-ghost" disabled={busy} onClick={() => execute(() => request("branches/" + branch._id, "PATCH", { active: !branch.active }), "Branch updated")}>{branch.active ? "Pause branch" : "Activate branch"}</button><button className="admin-ghost" disabled={busy} onClick={() => { const address = window.prompt("Branch address", branch.address); if (address && address !== branch.address) execute(() => request("branches/" + branch._id, "PATCH", { address }), "Address updated"); }}>Edit address</button></div>}</article>)}</div>{user.role === "super_admin" && <form className="admin-card admin-form" onSubmit={(e) => { e.preventDefault(); execute(async () => { await request("branches", "POST", branchDraft); setBranchDraft({ code: "", name: "", address: "", basePincode: "" }); }, "Branch created inactive"); }}><h2>Add a branch</h2><p>Add the third branch after its address is confirmed.</p><div className="admin-fields"><label>Branch code<input required placeholder="BR03" value={branchDraft.code} onChange={(e) => setBranchDraft({ ...branchDraft, code: e.target.value })}/></label><label>Branch name<input required value={branchDraft.name} onChange={(e) => setBranchDraft({ ...branchDraft, name: e.target.value })}/></label><label>Base pincode<input required inputMode="numeric" maxLength={6} value={branchDraft.basePincode} onChange={(e) => setBranchDraft({ ...branchDraft, basePincode: e.target.value })}/></label><label className="admin-wide">Full address<input required value={branchDraft.address} onChange={(e) => setBranchDraft({ ...branchDraft, address: e.target.value })}/></label></div><button className="admin-primary" disabled={busy}>Create branch</button></form>}</>}
      {tab === "Coverage" && user.role === "super_admin" && <><div className="admin-note">Each PIN maps to one branch. 5 km distance cannot be guaranteed by a postal PIN alone; verify the real delivery area before activating it. Unmapped PINs are blocked at checkout.</div><form className="admin-card admin-form" onSubmit={(e) => { e.preventDefault(); execute(async () => { await request("service-areas/" + coverageDraft.pincode, "PUT", { branchId: coverageDraft.branchId, deliveryFee: Math.round(Number(coverageDraft.fee) * 100), active: true }); setCoverageDraft({ ...coverageDraft, pincode: "" }); }, "Pincode mapped"); }}><h2>Map a delivery pincode</h2><div className="admin-fields"><label>6-digit pincode<input required inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} value={coverageDraft.pincode} onChange={(e) => setCoverageDraft({ ...coverageDraft, pincode: e.target.value })}/></label><label>Assigned branch<select required value={coverageDraft.branchId} onChange={(e) => setCoverageDraft({ ...coverageDraft, branchId: e.target.value })}><option value="">Select branch</option>{data.branches.map((b) => <option key={b._id} value={b._id}>{b.name} ({b.basePincode})</option>)}</select></label><label>Delivery fee (₹)<input required type="number" min="0" step="0.01" value={coverageDraft.fee} onChange={(e) => setCoverageDraft({ ...coverageDraft, fee: e.target.value })}/></label></div><button className="admin-primary" disabled={busy}>Save mapping</button></form><div className="admin-card"><h2>Service area mappings</h2><div className="admin-list">{data.areas.map((area) => <div key={area.pincode} className="admin-row"><strong>{area.pincode}</strong><span>{branchName(area.branchId)}</span><span>{rupees(area.deliveryFee)}</span><span className={area.active ? "admin-pill good" : "admin-pill"}>{area.active ? "Active" : "Paused"}</span><button className="admin-text" disabled={busy} onClick={() => execute(() => request(area.active ? "service-areas/" + area.pincode : "service-areas/" + area.pincode, area.active ? "DELETE" : "PUT", area.active ? undefined : { branchId: area.branchId, deliveryFee: area.deliveryFee, active: true }), "Mapping updated")}>{area.active ? "Pause" : "Restore"}</button></div>)}{!data.areas.length && <p className="admin-muted">No pincodes mapped. Customers cannot check out until a branch and service pincode are active.</p>}</div></div></>}
      {tab === "Team" && user.role === "super_admin" && <><form className="admin-card admin-form" onSubmit={(e) => { e.preventDefault(); execute(async () => { await request("managers", "POST", managerDraft); setManagerDraft({ name: "", email: "", password: "", branchId: "" }); }, "Branch Manager created"); }}><h2>Add Branch Manager</h2><div className="admin-fields"><label>Name<input required value={managerDraft.name} onChange={(e) => setManagerDraft({ ...managerDraft, name: e.target.value })}/></label><label>Email<input required type="email" value={managerDraft.email} onChange={(e) => setManagerDraft({ ...managerDraft, email: e.target.value })}/></label><label>Branch<select required value={managerDraft.branchId} onChange={(e) => setManagerDraft({ ...managerDraft, branchId: e.target.value })}><option value="">Select branch</option>{data.branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}</select></label><label>Temporary password (12+ chars)<input required minLength={12} type="password" value={managerDraft.password} onChange={(e) => setManagerDraft({ ...managerDraft, password: e.target.value })}/></label></div><button className="admin-primary" disabled={busy}>Create manager</button></form><div className="admin-card"><h2>Team access</h2><div className="admin-list">{data.users.map((person) => <div className="admin-row" key={person.id}><strong>{person.name}</strong><span>{person.email}</span><span>{person.role === "super_admin" ? "Super Admin" : branchName(person.branchId)}</span><span>{person.active ? "Active" : "Disabled"}</span>{person.role === "branch_manager" && <><select aria-label={"Change branch for " + person.name} value={String(person.branchId || "")} disabled={busy} onChange={(e) => execute(() => request("managers/" + person.id, "PATCH", { branchId: e.target.value }), "Manager branch changed")}>{data.branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}</select><button className="admin-text" disabled={busy} onClick={() => execute(() => request("managers/" + person.id, "PATCH", { active: !person.active }), "Access updated")}>{person.active ? "Disable" : "Enable"}</button><input className="admin-reset" type="password" placeholder="New password" aria-label={"New password for " + person.name} value={resetPasswords[person.id] || ""} onChange={(e) => setResetPasswords({ ...resetPasswords, [person.id]: e.target.value })}/><button className="admin-text" disabled={busy || (resetPasswords[person.id] || "").length < 12} onClick={() => execute(async () => { await request("managers/" + person.id, "PATCH", { password: resetPasswords[person.id] }); setResetPasswords((current) => ({ ...current, [person.id]: "" })); }, "Password reset; existing sessions signed out")}>Reset</button></>}</div>)}</div></div></>}
      {tab === "Products" && <AdminProducts products={data.products} categories={data.categories} isSuperAdmin={user.role === "super_admin"} busy={busy} request={request} uploadImages={uploadImages} importGalleryBundle={importGalleryBundle} execute={execute}/>} 
      {tab === "Categories" && <AdminCategories categories={data.categories} products={data.products} isSuperAdmin={user.role === "super_admin"} busy={busy} request={request} execute={execute}/>} 
    </div>
  </div>;
}
