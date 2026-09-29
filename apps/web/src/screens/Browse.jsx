"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { addons, categories, images, money, sizeLabel, unitPrice } from "@cake-galaxy/catalog";
import { Icon, useStore } from "../components/Storefront";
import { ProductCard, SectionHeading } from "../components/Products";
import PhoneVerification from "../components/PhoneVerification";

export function Home() {
  const { catalog } = useStore();
  return <div className="wrap page home-page">
    <section className="hero" aria-labelledby="hero-title"><img className="hero-art" src={images.banner} alt="Ivory celebration cake with delicate sage details" fetchPriority="high"/><div className="hero-copy"><span className="overline">THE CELEBRATION EDIT</span><h1 id="hero-title">Made for<br/><em>your moments.</em></h1><p>A beautiful cake. A memory to keep.</p><Link className="button" href="/shop">Shop cakes <Icon name="arrow"/></Link></div></section>
    <section className="section occasions"><SectionHeading title="Every occasion, a cake."/><div className="category-grid">{categories.map((category) => <Link className="category-tile" href={"/shop?category=" + category.query} key={category.query}><span className="category-image"><img src={category.image} alt="" loading="lazy"/></span>{category.name}</Link>)}</div></section>
    <section className="section"><SectionHeading title="Find your favourite." description="Chocolate classics, floral finishes and more."/><div className="products">{catalog.slice(0, 4).map((item) => <ProductCard key={item.id} product={item}/>)}</div></section>
    <section className="section custom-banner"><div className="custom-banner-copy"><span className="overline">MADE JUST FOR YOU</span><h2>Your idea.<br/><em>Our finishing touch.</em></h2><p>Share a design you love. We’ll make it your own.</p><Link href="/custom" className="button outline">Create your cake <Icon name="arrow"/></Link></div><img src={images.custom} alt="Two-tier celebration cake with seasonal berries" loading="lazy"/></section>
    <section className="section"><SectionHeading title="More to love." description="A few more ways to make their day."/><div className="products">{catalog.slice(4, 8).map((item) => <ProductCard key={item.id} product={item}/>)}</div></section>
  </div>;
}

export function Shop() {
  const router = useRouter();
  const params = useSearchParams();
  const { catalog } = useStore();
  const category = params.get("category") || "All";
  const query = (params.get("q") || "").trim();
  const sort = params.get("sort") || "recommended";
  const options = ["All", "Birthday", "Anniversary", "Chocolate", "Kids", "Photo", "Designer", "Cupcakes"];
  const matches = catalog.filter((product) => (category === "All" || product.category.includes(category) || product.flavour === category) && (product.name + " " + product.flavour + " " + product.category.join(" ")).toLowerCase().includes(query.toLowerCase()));
  if (sort === "low") matches.sort((a, b) => a.price - b.price);
  if (sort === "high") matches.sort((a, b) => b.price - a.price);
  function navigate(next) { const search = new URLSearchParams({ category, q: query, sort, ...next }); router.push("/shop?" + search); }
  return <div className="wrap page"><div className="breadcrumb"><Link href="/">Home</Link><span>/</span>Cakes</div><div className="page-heading"><div><h1>{query ? "Results for “" + query + "”" : category === "All" ? "Find your favourite cake" : category + " cakes"}</h1><p>A little personal touch makes all the difference.</p></div></div>
    <div className="catalog-toolbar"><span>{matches.length} cakes to explore</span><select className="mobile-filter" aria-label="Filter cakes" value={category} onChange={(event) => navigate({ category: event.target.value })}>{options.map((name) => <option key={name} value={name}>{name === "All" ? "All cakes" : name}</option>)}</select><select aria-label="Sort cakes" value={sort} onChange={(event) => navigate({ sort: event.target.value })}><option value="recommended">Recommended</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></div>
    <div className="catalog"><aside className="filters"><div className="filter-group"><h2>Shop by occasion</h2>{options.map((name) => <Link key={name} href={"/shop?category=" + encodeURIComponent(name)} className={name === category ? "active" : ""}>{name === "All" ? "All cakes" : name}</Link>)}</div><Link href="/shop" className="text-link">Clear filters</Link></aside><div className="products">{matches.length ? matches.map((item) => <ProductCard key={item.id} product={item}/>) : <div className="empty-state"><h2>No cakes found</h2><p>Try another flavour or clear the selected filters.</p><Link className="button" href="/shop">View all cakes</Link></div>}</div></div>
  </div>;
}

export function Product() {
  const params = useSearchParams();
  const router = useRouter();
  const { catalog, session, api, addItem, pincode, checkDelivery } = useStore();
  const product = catalog.find((item) => item.id === params.get("id")) || catalog[0];
  const [quantity, setQuantity] = useState(1);
  const [size, setSize] = useState(product.weights[0]);
  const [eggless, setEggless] = useState(false);
  const [flavour, setFlavour] = useState(product.flavour);
  const [message, setMessage] = useState("");
  const [extras, setExtras] = useState([]);
  const [file, setFile] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [deliveryPin, setDeliveryPin] = useState(pincode);
  const [phone, setPhone] = useState("");
  const key = product.id;
  if (!product) return <div className="wrap page empty-state">That cake wasn't found. <Link href="/shop">Explore cakes</Link></div>;

  async function submit(event) {
    event.preventDefault();
    setFeedback("");
    setBusy(true);
    try {
      const service = await checkDelivery(deliveryPin);
      if (service.available === false) throw new Error("Delivery isn't available to this pincode. Try another one.");
      let uploadId;
      if (product.photo) {
        if (!session.authenticated) throw new Error("Verify your mobile number below before adding a photo cake.");
        if (!file) throw new Error("Choose your photograph before adding this cake.");
        const formData = new FormData(); formData.append("reference", file);
        const uploaded = await api("/uploads", { method: "POST", formData });
        uploadId = uploaded.id;
      }
      addItem({ productId: product.id, quantity, size: Number(size), flavour, eggless, message: message.trim(), addons: extras, uploadId });
      router.push("/cart");
    } catch (error) { setFeedback(error.message); }
    finally { setBusy(false); }
  }

  return <div className="wrap page" key={key}><div className="breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/shop">Cakes</Link><span>/</span>{product.name}</div><div className="detail-grid"><div className="detail-photo"><img src={product.image} alt={product.name}/><p className="photo-footnote">Every cake is finished by hand. Colours and details may vary.</p></div><div className="detail-panel"><span className="overline">{product.badge}</span><h1>{product.name}</h1><span className="detail-price">{money(unitPrice({ productId: product.id, size, eggless, addons: extras }, product))}</span><p className="subtle">Starting from {sizeLabel(product)}</p><p className="detail-description">{product.description}</p><form onSubmit={submit}><div className="field-group"><span className="field-label">Choose {product.unit === "pieces" ? "box size" : "weight"}</span><div className="option-row">{product.weights.map((weight) => <label key={weight} className="choice"><input type="radio" name="size" checked={Number(size) === weight} onChange={() => setSize(weight)}/><span>{sizeLabel(product, weight)}</span></label>)}</div><label className="check-label"><input type="checkbox" checked={eggless} onChange={(event) => setEggless(event.target.checked)}/>Make it eggless <span className="subtle">+{money(5000)}</span></label></div>
      <div className="field-group"><label htmlFor="cake-flavour">Flavour</label><select id="cake-flavour" value={flavour} onChange={(event) => setFlavour(event.target.value)}>{[...new Set([product.flavour, ...(product.photo ? ["Chocolate", "Butterscotch"] : [])])].map((name) => <option key={name}>{name}</option>)}</select></div>
      <div className="field-group"><label htmlFor="cake-message">Message on cake (optional)</label><input id="cake-message" maxLength={30} placeholder="Happy Birthday, Anu!" value={message} onChange={(event) => setMessage(event.target.value)}/></div>
      {product.photo && <div className="field-group"><label htmlFor="photo-upload">Add your photograph (JPG or PNG, up to 10 MB)</label><input id="photo-upload" type="file" accept="image/jpeg,image/png" onChange={(event) => { const chosen = event.target.files?.[0]; if (chosen && chosen.size > 10 * 1024 * 1024) setFeedback("Choose a photo smaller than 10 MB."); else { setFile(chosen || null); setFeedback(""); } }} required/></div>}
      {product.photo && !session.authenticated && <div className="field-group"><PhoneVerification phone={phone} onPhoneChange={setPhone}/></div>}
      <div className="field-group"><span className="field-label">Make it a little more special</span>{addons.map((addon) => <label key={addon.id} className="check-label"><input type="checkbox" checked={extras.includes(addon.id)} onChange={(event) => setExtras((items) => event.target.checked ? [...items, addon.id] : items.filter((id) => id !== addon.id))}/>{addon.name} <span className="subtle">+{money(addon.price)}</span></label>)}</div>
      <div className="field-group"><label htmlFor="product-pincode">Delivery pincode</label><input id="product-pincode" name="productPincode" inputMode="numeric" autoComplete="postal-code" pattern="[1-9][0-9]{5}" maxLength={6} value={deliveryPin} onChange={(event) => { setDeliveryPin(event.target.value.replace(/\D/g, "").slice(0, 6)); setFeedback(""); }} placeholder="Enter 6-digit pincode" required/><p className="subtle">{/^[1-9][0-9]{5}$/.test(deliveryPin) ? "Delivery availability and charges are confirmed before payment." : "Enter a 6-digit pincode to continue."}</p></div>
      <div className="purchase-bar"><div className="quantity"><button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Decrease quantity">−</button><output>{quantity}</output><button type="button" onClick={() => setQuantity(Math.min(20, quantity + 1))} aria-label="Increase quantity">+</button></div><button className="button" aria-busy={busy} disabled={busy || !/^[1-9][0-9]{5}$/.test(deliveryPin)}>{busy ? "Checking delivery…" : "Continue to bag"} <Icon name="arrow"/></button></div><p className="form-message" role="status">{feedback}</p>
    </form></div></div></div>;
}

export function Custom() {
  const { session, api, pincode } = useStore();
  const [sample, setSample] = useState("");
  const [file, setFile] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [customPhone, setCustomPhone] = useState("");
  useEffect(() => { if (session.authenticated && !customPhone) setCustomPhone(session.phone); }, [session.phone, session.authenticated]);
  async function submit(event) {
    event.preventDefault(); setFeedback("");
    if (!session.authenticated || session.phone !== customPhone) { setFeedback("Verify your mobile number before sending your design request."); return; }
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setBusy(true);
    try {
      let uploadId;
      if (file) { const formData = new FormData(); formData.append("reference", file); const uploaded = await api("/uploads", { method: "POST", formData }); uploadId = uploaded.id; }
      const result = await api("/custom-requests", { method: "POST", body: { ...data, customPhone, sample, uploadId } });
      setFeedback("Request " + result.reference + " received. We'll contact you after checking the design and availability.");
      form.reset(); setFile(null);
    } catch (error) { setFeedback(error.message); }
    finally { setBusy(false); }
  }
  return <div className="wrap page"><div className="breadcrumb"><Link href="/">Home</Link><span>/</span>Custom cakes</div><div className="page-heading"><div><h1>A cake that's entirely you</h1><p>Share a reference or start with a sample style.</p></div></div><div className="custom-layout"><div className="custom-images"><img src={images.floral} alt="Floral cake design"/>{[["Pastel flowers", images.floral], ["Berry tiers", images.custom], ["Rainbow layers", images.rainbow]].map(([name, src]) => <button type="button" className={"sample-button" + (sample === name ? " selected" : "")} onClick={() => setSample(name)} key={name}><img src={src} alt=""/>{name}</button>)}</div><form className="panel" onSubmit={submit}><h2>Tell us what you have in mind</h2><label className="upload-zone" htmlFor="design-file">Upload a design reference<input id="design-file" type="file" accept="image/jpeg,image/png" onChange={(event) => { const chosen = event.target.files?.[0]; if (chosen && chosen.size > 10 * 1024 * 1024) setFeedback("Choose a photo smaller than 10 MB."); else { setFile(chosen || null); setFeedback(""); } }}/><small>A photo or sketch. JPG / PNG up to 10 MB.</small></label>{sample && <p className="subtle">Sample style: {sample}</p>}<div className="field-row"><div className="field"><label htmlFor="occasion">Occasion</label><select id="occasion" name="occasion">{["Birthday", "Anniversary", "Wedding", "Baby shower", "Other"].map((value) => <option key={value}>{value}</option>)}</select></div><div className="field"><label htmlFor="weight">Weight</label><select id="weight" name="weight">{["1 kg", "1.5 kg", "2 kg", "3 kg or more"].map((value) => <option key={value}>{value}</option>)}</select></div></div><div className="field-row"><div className="field"><label htmlFor="flavour">Flavour</label><select id="flavour" name="flavour">{["Chocolate", "Vanilla", "Butterscotch", "Red velvet"].map((value) => <option key={value}>{value}</option>)}</select></div><div className="field"><label htmlFor="budget">Budget (optional)</label><input id="budget" name="budget" type="number" min="0" placeholder="₹"/></div></div><div className="field"><label htmlFor="notes">Design notes</label><textarea id="notes" name="notes" maxLength={2000} placeholder="Colours, theme, name and age"/></div><div className="field-row"><div className="field"><label htmlFor="requiredDate">Required date</label><input id="requiredDate" name="requiredDate" type="date" required/></div><div className="field"><label htmlFor="customPincode">Delivery pincode</label><input id="customPincode" name="customPincode" defaultValue={pincode} inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} required/></div></div><div className="field"><h3>Your contact number</h3>{session.authenticated && session.phone === customPhone ? <p className="verified-badge">+91 {session.phone} · Verified</p> : <PhoneVerification phone={customPhone} onPhoneChange={setCustomPhone}/>}</div><p className="form-message" role="status">{feedback}</p><button className="button full" disabled={busy}>Request a design & quote</button><p className="subtle">We confirm the design and final price before payment.</p></form></div></div>;
}
