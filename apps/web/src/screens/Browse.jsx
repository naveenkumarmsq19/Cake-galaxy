"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { addons, designCakeTier, discountAmount, egglessSurcharge, images, money, regularUnitPrice, sizeLabel, unitPrice } from "@cake-galaxy/catalog";
import { Icon, useStore } from "../components/Storefront";
import { ProductCard, SectionHeading } from "../components/Products";
import PhoneVerification from "../components/PhoneVerification";
import ProductGallery from "../components/ProductGallery";
import CakeLoader from "../components/CakeLoader";

export function Home() {
  const { catalog, categories, catalogLoaded } = useStore();
  return <div className="wrap page home-page">
    <section className="hero" aria-labelledby="hero-title"><img className="hero-art" src={images.banner} alt="Ivory celebration cake with delicate sage details" fetchPriority="high"/><div className="hero-copy"><span className="overline">CAKE GALAXY · BENGALURU</span><h1 id="hero-title">Cake Galaxy<br/><em>made for your moments.</em></h1><p>Order birthday cakes, photo cakes and personalised celebration cakes in Bengaluru.</p><Link className="button" href="/shop">Shop cakes <Icon name="arrow"/></Link> <Link className="button outline" href="/menu">View full menu</Link></div></section>
    <section className="section occasions"><SectionHeading title="Explore cake categories." />{!catalogLoaded && <CakeLoader size="medium" label="Loading cake categories…" />}<div className="category-grid">{categories.map(category => { const cover = catalog.find(p => p.category?.includes(category.name)); return <Link className="category-tile" href={"/shop?category=" + encodeURIComponent(category.name)} key={category.slug}><span className="category-image"><img src={cover?.images?.[0] || cover?.image || category.image || images.celebration} alt="" loading="lazy"/></span>{category.name}</Link>; })}</div></section>
    <section className="section"><SectionHeading title="Find your favourite." description="Chocolate classics, floral finishes and more." />{!catalogLoaded && <CakeLoader size="medium" label="Loading favourite cakes…" />}<div className="products">{catalog.slice(0, 4).map((item) => <ProductCard key={item.id} product={item}/>)}</div></section>
    <section className="section custom-banner"><div className="custom-banner-copy"><span className="overline">MADE JUST FOR YOU</span><h2>Your idea.<br/><em>Our finishing touch.</em></h2><p>Share a design you love. We’ll make it your own.</p><Link href="/custom" className="button outline">Create your cake <Icon name="arrow"/></Link></div><img src={images.custom} alt="Two-tier celebration cake with seasonal berries" loading="lazy"/></section>
    <section className="section"><SectionHeading title="More to love." description="A few more ways to make their day." />{!catalogLoaded && <CakeLoader size="medium" label="Loading more cakes…" />}<div className="products">{catalog.slice(4, 8).map((item) => <ProductCard key={item.id} product={item}/>)}</div></section>
    <section className="section" aria-labelledby="cake-galaxy-location"><h2 id="cake-galaxy-location">Visit Cake Galaxy in Bengaluru</h2><p>Find Cake Galaxy at No. 1, Nagarabhavi Main Road, opposite Bank of Baroda, Mudalapalya, Bengaluru 560072. Check delivery availability for your pincode before ordering online.</p></section>
  </div>;
}

export function Shop() {
  const router = useRouter();
  const params = useSearchParams();
  const { catalog, categories, catalogLoaded } = useStore();
  const category = params.get("category") || "All";
  const query = (params.get("q") || "").trim();
  const sort = params.get("sort") || "recommended";
  const options = ["All", ...categories.map(item => item.name)];
  const matches = catalog.filter((product) => (category === "All" || (product.category || []).includes(category)) && (product.name + " " + product.flavour + " " + (product.category || []).join(" ")).toLowerCase().includes(query.toLowerCase()));
  const startingPrice = (p) => unitPrice({ productId: p.id, size: p.weights[0], eggless: false, addons: [] }, p);
  if (sort === "low") matches.sort((a, b) => startingPrice(a) - startingPrice(b));
  if (sort === "high") matches.sort((a, b) => startingPrice(b) - startingPrice(a));
  function navigate(next) { const search = new URLSearchParams({ category, q: query, sort, ...next }); router.push("/shop?" + search); }
  if (!catalogLoaded) return <CakeLoader fullScreen size="large" label="Loading Cake Galaxy cakes…" />;
  return <div className="wrap page"><div className="breadcrumb"><Link href="/">Home</Link><span>/</span>Cakes</div><div className="page-heading"><div><h1>{query ? "Results for “" + query + "”" : category === "All" ? "Find your favourite cake" : category + " cakes"}</h1><p>A little personal touch makes all the difference.</p></div></div>
    <div className="catalog-toolbar"><span>{matches.length} cakes to explore</span><select className="mobile-filter" aria-label="Filter cakes" value={category} onChange={(event) => navigate({ category: event.target.value })}>{options.map((name) => <option key={name} value={name}>{name === "All" ? "All cakes" : name}</option>)}</select><select aria-label="Sort cakes" value={sort} onChange={(event) => navigate({ sort: event.target.value })}><option value="recommended">Recommended</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></div>
    <div className="catalog"><aside className="filters"><div className="filter-group"><h2>Shop by category</h2>{options.map((name) => <Link key={name} href={"/shop?category=" + encodeURIComponent(name)} className={name === category ? "active" : ""}>{name === "All" ? "All cakes" : name}</Link>)}</div><Link href="/shop" className="text-link">Clear filters</Link></aside><div className="products">{matches.length ? matches.map((item) => <ProductCard key={item.id} product={item}/>) : <div className="empty-state"><h2>No cakes found</h2><p>Try another flavour or clear the selected filters.</p><Link className="button" href="/shop">View all cakes</Link></div>}</div></div>
  </div>;
}

export function Product() {
  const params = useSearchParams();
  const router = useRouter();
  const { catalog, catalogLoaded, session, api, addItem, pincode, checkDelivery } = useStore();
  const product = catalog.find((item) => item.id === params.get("id"));
  const [quantity, setQuantity] = useState(1);
  const [size, setSize] = useState(product?.weights?.[0] ?? 0.5);
  const [eggless, setEggless] = useState(false);
  const [flavour, setFlavour] = useState(product?.flavour || "");
  const [message, setMessage] = useState("");
  const [extras, setExtras] = useState([]);
  const [file, setFile] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [deliveryPin, setDeliveryPin] = useState(pincode);
  const [phone, setPhone] = useState("");
  const key = product?.id;
  useEffect(() => {
    if (!product) return;
    setSize(product.weights[0]); setFlavour(product.flavour || "");
    setEggless(false); setExtras([]); setMessage(""); setFile(null);
  }, [key]);
  if (!catalogLoaded) return <CakeLoader fullScreen size="large" label="Preparing your cake…" />;
  if (!product) return <div className="wrap page empty-state">That cake wasn't found. <Link href="/shop">Explore cakes</Link></div>;
  const related = catalog.filter(item => item.id !== product.id).map(item => ({
    item, score: (item.category || []).filter(value => (product.category || []).includes(value)).length * 10 +
      (item.flavour && item.flavour === product.flavour ? 2 : 0)
  })).sort((a,b) => b.score - a.score || a.item.name.localeCompare(b.item.name)).slice(0, 4).map(entry => entry.item);
  const selectedItem = { productId: product.id, size: Number(size), eggless, addons: extras };
  const selectedPrice = unitPrice(selectedItem, product);
  const originalPrice = regularUnitPrice(selectedItem, product);
  const saving = discountAmount(selectedItem, product);

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

  return <div className="wrap page" key={key}><div className="breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/shop">Cakes</Link><span>/</span>{product.name}</div><div className="detail-grid"><div className="detail-photo"><ProductGallery product={product}/></div><div className="detail-panel"><span className="overline">{product.badge}</span><h1>{product.name}</h1><div className="detail-price-line"><span className="detail-price">{money(selectedPrice)}</span>{saving > 0 && <del className="price-original">{money(originalPrice)}</del>}</div>{saving > 0 && <p className="subtle discount-copy">10% off cakes 1 kg and above · Save {money(saving)} per cake.</p>}<p className="subtle">Starting from {sizeLabel(product)}</p><p className="detail-description">{product.description}</p><form onSubmit={submit}><div className="field-group"><span className="field-label">Choose {product.unit === "menu" ? "portion" : product.unit === "pieces" ? "box size" : "weight"}</span><div className="option-row">{product.weights.length > 16 ? <select aria-label="Choose cake weight" value={size} onChange={e=>setSize(Number(e.target.value))}>{product.weights.map(weight=><option value={weight} key={weight}>{sizeLabel(product, weight)} — {money(unitPrice({ productId: product.id, size: weight, eggless, addons: extras }, product))}</option>)}</select> : product.weights.map((weight) => <label key={weight} className="choice"><input type="radio" name="size" checked={Number(size) === weight} onChange={() => setSize(weight)}/><span>{sizeLabel(product, weight)}</span></label>)}</div>{product.eggless && <label className="check-label"><input type="checkbox" checked={eggless} onChange={(event) => setEggless(event.target.checked)}/><span className="check-label-copy">Make it eggless <span className="subtle">+{money(egglessSurcharge({ size: Number(size), eggless: true }, product))}{product.unit === "kg" ? " (₹50 per 500g)" : ""}</span></span></label>}{product.unit === "menu" && <p className="subtle">Small and Medium are menu size names, not verified kilogram weights. Please confirm eggless and decoration pricing separately.</p>}{product.leadDays > 0 && <p className="subtle">Please order at least {product.leadDays} day(s) before delivery for this cake.</p>}</div>
      <div className="field-group"><label htmlFor="cake-flavour">Flavour</label><select id="cake-flavour" value={flavour} onChange={(event) => setFlavour(event.target.value)}>{[...new Set([product.flavour, ...(product.photo ? ["Chocolate", "Butterscotch"] : [])])].map((name) => <option key={name}>{name}</option>)}</select></div>
      <div className="field-group"><label htmlFor="cake-message">Message on cake (optional)</label><input id="cake-message" maxLength={30} placeholder="Happy Birthday, Anu!" value={message} onChange={(event) => setMessage(event.target.value)}/></div>
      {product.photo && <div className="field-group"><label htmlFor="photo-upload">Add your photograph (JPG or PNG, up to 10 MB)</label><input id="photo-upload" type="file" accept="image/jpeg,image/png" onChange={(event) => { const chosen = event.target.files?.[0]; if (chosen && chosen.size > 10 * 1024 * 1024) setFeedback("Choose a photo smaller than 10 MB."); else { setFile(chosen || null); setFeedback(""); } }} required/></div>}
      {product.photo && !session.authenticated && <div className="field-group"><PhoneVerification phone={phone} onPhoneChange={setPhone}/></div>}
      <div className="field-group"><span className="field-label">Make it a little more special</span>{addons.map((addon) => <label key={addon.id} className="check-label"><input type="checkbox" checked={extras.includes(addon.id)} onChange={(event) => setExtras((items) => event.target.checked ? [...items, addon.id] : items.filter((id) => id !== addon.id))}/><span className="check-label-copy">{addon.name} <span className="subtle">+{money(addon.price)}</span></span></label>)}</div>
      <div className="field-group"><label htmlFor="product-pincode">Delivery pincode</label><input id="product-pincode" name="productPincode" inputMode="numeric" autoComplete="postal-code" pattern="[1-9][0-9]{5}" maxLength={6} value={deliveryPin} onChange={(event) => { setDeliveryPin(event.target.value.replace(/\D/g, "").slice(0, 6)); setFeedback(""); }} placeholder="Enter 6-digit pincode" required/><p className="subtle">{/^[1-9][0-9]{5}$/.test(deliveryPin) ? "Delivery availability and charges are confirmed before payment." : "Enter a 6-digit pincode to continue."}</p></div>
      <div className="purchase-bar"><div className="quantity"><button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Decrease quantity">−</button><output>{quantity}</output><button type="button" onClick={() => setQuantity(Math.min(20, quantity + 1))} aria-label="Increase quantity">+</button></div><button className="button" aria-busy={busy} disabled={busy || !/^[1-9][0-9]{5}$/.test(deliveryPin)}>{busy ? "Checking delivery…" : "Continue to bag"} <Icon name="arrow"/></button></div>{busy && <CakeLoader size="small" label="Checking delivery and preparing your bag…" />}<p className="form-message" role="status">{feedback}</p>
    </form></div></div>
    {related.length > 0 && <section className="section related-section" aria-labelledby="related-title">
      <div className="section-heading"><div><h2 id="related-title">You may also like</h2><p>More cakes to make your celebration special.</p></div></div>
      <div className="products related-products">{related.map(item => <ProductCard key={item.id} product={item}/>)}</div>
    </section>}
  </div>;
}

const designCakeTiers = [
  { id: "basic", name: "Basic" },
  { id: "standard", name: "Standard" },
  { id: "premium", name: "Premium" }
];

export function Custom() {
  const { session, api, pincode, catalog, catalogLoaded } = useStore();
  const [tier, setTier] = useState("basic");
  const [productId, setProductId] = useState("");
  const [weightKg, setWeightKg] = useState(1);
  const [file, setFile] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [customPhone, setCustomPhone] = useState("");

  useEffect(() => {
    if (session.authenticated && !customPhone) setCustomPhone(session.phone);
  }, [session.phone, session.authenticated]);

  const flavours = catalog
    .filter((product) => designCakeTier(product) && product.weights?.some((size) => size >= 1))
    .sort((a, b) => a.name.localeCompare(b.name));
  const available = flavours.filter((product) => designCakeTier(product) === tier);
  const selected = available.find((product) => product.id === productId);
  const weights = selected?.weights?.filter((size) => size >= 1).sort((a, b) => a - b) || [];

  function chooseTier(next) {
    setTier(next);
    setProductId("");
    setWeightKg(1);
    setFile(null);
    setFeedback("");
  }
  function chooseFlavour(id) {
    const product = flavours.find((cake) => cake.id === id);
    const firstWeight = product?.weights?.filter((size) => size >= 1).sort((a, b) => a - b)[0];
    setProductId(id);
    setWeightKg(firstWeight || 1);
    setFile(null);
    setFeedback("");
  }

  async function submit(event) {
    event.preventDefault();
    setFeedback("");
    if (!selected || !weights.includes(weightKg)) {
      setFeedback("Choose a flavour and available cake weight first.");
      return;
    }
    if (!file) {
      setFeedback("Upload the sample design image you want us to follow.");
      return;
    }
    if (!session.authenticated || session.phone !== customPhone) {
      setFeedback("Verify your mobile number before sending your design request.");
      return;
    }
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("reference", file);
      const uploaded = await api("/uploads", { method: "POST", formData });
      const result = await api("/custom-requests", {
        method: "POST",
        body: { ...data, productId: selected.id, weightKg, customPhone, uploadId: uploaded.id }
      });
      setFeedback("Request " + result.reference + " received. Our team will review the design and contact you with the final quote.");
      form.reset();
      setFile(null);
      setProductId("");
      setWeightKg(1);
      setTier("basic");
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="wrap page">
    <div className="breadcrumb"><Link href="/">Home</Link><span>/</span>Design cake</div>
    <div className="page-heading"><div><h1>Design your own cake</h1><p>Choose your flavour and cake weight, then upload the design you love.</p></div></div>
    <div className="custom-layout">
      <div className="custom-images">
        <img src={images.floral} alt="Floral cake design inspiration"/>
        <p className="subtle">Your reference image will guide our team. Custom decorations are reviewed before the final quote.</p>
        {[["Floral inspiration", images.floral], ["Berry inspiration", images.custom], ["Rainbow inspiration", images.rainbow]].map(([name, src]) => <div className="sample-button" key={name}><img src={src} alt=""/>{name}</div>)}
      </div>
      <form className="panel" onSubmit={submit}>
        <h2>1. Select your cake flavour</h2>
        <p className="subtle">Choose the cake flavour category you like. Our bakery team will review your design and confirm the final price.</p>
        <div className="option-row" role="group" aria-label="Flavour price category">
          {designCakeTiers.map((option) => <label className="choice" key={option.id}>
            <input type="radio" name="flavourTier" value={option.id} checked={tier === option.id} onChange={() => chooseTier(option.id)}/>
            <span>{option.name} ({flavours.filter((cake) => designCakeTier(cake) === option.id).length})</span>
          </label>)}
        </div>
        <div className="field">
          <label htmlFor="design-flavour">Flavour</label>
          <select id="design-flavour" value={productId} onChange={(event) => chooseFlavour(event.target.value)} disabled={!available.length} required>
            <option value="">Select a {tier} flavour</option>
            {available.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}
          </select>
          {catalogLoaded && !available.length && <p className="subtle">No {tier} flavours in the currently approved price list. Select another category or add approved flavours in Admin.</p>}
          {!catalogLoaded && <CakeLoader size="medium" label="Loading available flavours…" />}
        </div>
        {selected && <>
          <div className="field">
            <label htmlFor="design-weight">Cake weight</label>
            <select id="design-weight" value={weightKg} onChange={(event) => setWeightKg(Number(event.target.value))} required>
              {weights.map((size) => <option key={size} value={size}>{size} kg</option>)}
            </select>
          </div>
          <p className="subtle">Your final cake price will be provided by our team after reviewing the design, flavour and {weightKg} kg weight.</p>
          <h2>2. Upload your sample design</h2>
          <label className="upload-zone" htmlFor="design-file">Upload your reference cake image
            <input key={selected.id} id="design-file" type="file" accept="image/jpeg,image/png" required
              onChange={(event) => {
                const chosen = event.target.files?.[0];
                if (chosen && chosen.size > 10 * 1024 * 1024) {
                  event.target.value = "";
                  setFile(null);
                  setFeedback("Choose a photo smaller than 10 MB.");
                } else {
                  setFile(chosen || null);
                  setFeedback("");
                }
              }}/>
            <small>JPG / PNG up to 10 MB. {file ? "Selected: " + file.name : "Select the design photo you want."}</small>
          </label>
          <h2>3. Celebration and contact details</h2>
          <div className="field"><label htmlFor="occasion">Occasion</label><select id="occasion" name="occasion">{["Birthday", "Anniversary", "Wedding", "Baby shower", "Other"].map((value) => <option key={value}>{value}</option>)}</select></div>
          <div className="field"><label htmlFor="notes">Design notes</label><textarea id="notes" name="notes" maxLength={2000} placeholder="Colours, theme, name and age"/></div>
          <div className="field-row">
            <div className="field"><label htmlFor="requiredDate">Required date</label><input id="requiredDate" name="requiredDate" type="date" required/></div>
            <div className="field"><label htmlFor="customPincode">Delivery pincode</label><input id="customPincode" name="customPincode" defaultValue={pincode} inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} required/></div>
          </div>
          <div className="field"><h3>Your contact number</h3>
            {session.authenticated && session.phone === customPhone ? <p className="verified-badge">+91 {session.phone} · Verified</p> : <PhoneVerification phone={customPhone} onPhoneChange={setCustomPhone}/>}
          </div>
          <button className="button full" disabled={busy}>{busy ? "Submitting…" : "Request a design & quote"}</button>{busy && <CakeLoader size="small" label="Submitting your design…" />}
          <p className="subtle">We confirm the design and final price before payment. Submitting this form does not place a paid order.</p>
        </>}
        <p className="form-message" role="status">{feedback}</p>
      </form>
    </div>
  </div>;
}
