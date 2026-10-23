"use client";

import { useEffect, useMemo, useState } from "react";

const empty = { id: "", name: "", price: "", variantPrices: "", variantLabels: "", category: "", categoryMode: "auto", flavour: "", weights: "0.5,1", unit: "kg", description: "", badge: "", leadDays: "0", eggless: false, photo: false, active: false };
const entries = (value) => Object.entries(value?.toJSON?.() || value || {});
const formatMap = (value, asRupees = false) => entries(value).map(([key, n]) =>
  key.replace(/^w_/, "").replace("_", ".") + ":" + (asRupees ? (Number(n) / 100).toFixed(2).replace(/\.00$/, "") : n)
).join(", ");
function parseMap(raw, asRupees = false) {
  const map = {};
  for (const part of raw.split(",").map(x => x.trim()).filter(Boolean)) {
    const colon = part.indexOf(":");
    const code = part.slice(0, colon).trim(), value = part.slice(colon + 1).trim();
    if (colon < 1 || !/^\d+(?:\.\d+)?$/.test(code) || !value) throw new Error("Use code:value pairs, e.g. 1:Pastry, 2:Small or 0.5:249");
    const key = "w_" + String(Number(code)).replace(".", "_");
    if (asRupees) {
      if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error("Prices must be valid rupee amounts.");
      const paise = Math.round(Number(value) * 100);
      if (!Number.isSafeInteger(paise) || paise < 1 || paise > 100000000) throw new Error("Invalid option price.");
      map[key] = paise;
    } else if (value.length <= 30) map[key] = value;
    else throw new Error("Option label must contain at most 30 characters.");
  }
  return map;
}
function fromProduct(p) {
  return { id: p.id, name: p.name || "", price: String(Number(p.price || 0) / 100), variantPrices: formatMap(p.variantPrices, true), variantLabels: formatMap(p.variantLabels), category: p.category?.[0] || "", categoryMode: p.categoryMode || "auto", flavour: p.flavour || "", weights: (p.weights || []).join(","), unit: p.unit || "kg", badge: p.badge || "", leadDays: String(p.leadDays || 0), description: p.description || "", eggless: p.eggless === true, photo: p.photo === true, active: p.active === true };
}
async function toSmallWebp(file) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Use JPG, PNG or WebP photos only.");
  if (file.size > 15 * 1024 * 1024) throw new Error("Original photo must be smaller than 15 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const factor = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * factor));
    canvas.height = Math.max(1, Math.round(bitmap.height * factor));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser cannot compress images.");
    ctx.fillStyle = "#fff";ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    for (const quality of [0.85,0.75,0.65,0.5,0.35]) {
      const blob = await new Promise(resolve=>canvas.toBlob(resolve,"image/webp",quality));
      if (blob && blob.type === "image/webp" && blob.size < 2_000_000) return new File([blob],file.name.replace(/\.[^.]+$/,"")+".webp",{type:"image/webp"});
    }
    throw new Error("Could not compress "+file.name+" below 2 MB.");
  } finally { bitmap.close?.(); }
}
const adminPreview = url => url.replace(/^\/api\/product-images\//,"/api/admin/product-images/");

export default function AdminProducts({ products, categories, isSuperAdmin, busy, request, uploadImages, importGalleryBundle, execute }) {
  const [draft, setDraft] = useState(empty);
  const [editing, setEditing] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [uploadProgress, setUploadProgress] = useState("");
  const [pendingPhotos, setPendingPhotos] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [photoError, setPhotoError] = useState("");
  useEffect(() => {
    const next = pendingPhotos.map(file => ({ url: URL.createObjectURL(file), name: file.name }));
    setPhotoPreviews(next);
    return () => next.forEach(photo => URL.revokeObjectURL(photo.url));
  }, [pendingPhotos]);
  const currentProduct = products.find(p=>p.id===editing);
  const currentPhotos = currentProduct?.images || [];
  function choosePhotos(list) {
    const files = [...list];
    if (files.length > 12) { setPhotoError("Choose up to 12 photos at a time."); return; }
    if (files.length + currentPhotos.length > 16) { setPhotoError("A cake can have up to 16 photos in total."); return; }
    if (files.some(file => !["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 15 * 1024 * 1024)) {
      setPhotoError("Use JPG, PNG or WebP files under 15 MB each.");
      return;
    }
    setPendingPhotos(files);
    setPhotoError("");
  }
  async function compressPhotos(files) {
    const converted = [];
    for (let i=0; i<files.length; i++) {
      setUploadProgress("Compressing photo " + (i+1) + " / " + files.length + "…");
      converted.push(await toSmallWebp(files[i]));
    }
    return converted;
  }
  async function putNewPhotosFirst(productId, oldImages, uploadedImages) {
    const added = uploadedImages.filter(url => !oldImages.includes(url));
    if (!added.length || !oldImages.length) return;
    const addedSet = new Set(added);
    const sorted = [...added, ...uploadedImages.filter(url => !addedSet.has(url))];
    await request("products/" + encodeURIComponent(productId) + "/images/order", "PUT", { images: sorted });
  }
  async function sendPhotos(files) {
    if (!currentProduct) throw new Error("Select and save a product before uploading photos.");
    if (files.length < 1 || files.length > 12) throw new Error("Select 1–12 images at a time.");
    try {
      const converted = await compressPhotos(files);
      setUploadProgress("Uploading " + converted.length + " photos…");
      const result = await uploadImages(currentProduct.id, converted);
      await putNewPhotosFirst(currentProduct.id, currentPhotos, result.images || []);
    } finally { setUploadProgress(""); }
  }
  async function changeOrder(from,to) {
    const next=[...currentPhotos];
    const [moving]=next.splice(from,1);next.splice(to,0,moving);
    await request("products/"+encodeURIComponent(editing)+"/images/order","PUT",{images:next});
  }
  const matched = useMemo(() => products.filter(p => {
    if (filter === "draft" && (p.active || p.deletedAt)) return false;
    if (filter === "live" && (!p.active || p.deletedAt)) return false;
    if (filter === "photos" && (!p.images?.length || p.deletedAt)) return false;
    if (filter === "deleted" && !p.deletedAt) return false;
    if (filter === "menu" && (!p.menuImported || p.deletedAt)) return false;
    if (filter !== "deleted" && p.deletedAt) return false;
    return (p.name + " " + p.id + " " + (p.category || []).join(" ")).toLowerCase().includes(search.toLowerCase());
  }), [products, filter, search]);
  const clearPhotoSelection = () => { setPendingPhotos([]); setPhotoError(""); setUploadProgress(""); };
  const selectProduct = p => { setEditing(p.id); setDraft(fromProduct(p)); clearPhotoSelection(); };
  const startNew = () => { setEditing(""); setDraft(empty); clearPhotoSelection(); };
  const change = (key, value) => setDraft(previous => ({ ...previous, [key]: value }));
  function save(event) {
    event.preventDefault();
    if (!editing && !pendingPhotos.length) { setPhotoError("Choose at least one cake photo before creating a product."); return; }
    if (photoError) return;
    execute(async () => {
      const sizes = draft.weights.split(",").map(v => Number(v.trim()));
      if (!sizes.length || sizes.some(v => !Number.isFinite(v) || v <= 0)) throw new Error("Enter valid sizes.");
      if (draft.unit === "menu" && draft.eggless) throw new Error("Menu options need confirmed kilogram weights before eggless pricing.");
      const prices = parseMap(draft.variantPrices, true);
      const labels = parseMap(draft.variantLabels);
      if (draft.unit === "menu" && sizes.some(w => !prices["w_" + String(w).replace(".", "_")] || !labels["w_" + String(w).replace(".", "_")])) throw new Error("Each printed-menu size needs a label and exact price.");
      if (draft.categoryMode === "manual" && !categories.some(c => c.active && c.name === draft.category)) throw new Error("Choose an enabled category.");
      const productId = editing || draft.id;
      const current = editing ? products.find(p => p.id === editing) : null;
      if (current?.deletedAt) throw new Error("Restore the deleted product before editing.");
      if (pendingPhotos.length + (current?.images?.length || 0) > 16) throw new Error("Maximum 16 images per product.");
      const publishAfterUpload = draft.active && pendingPhotos.length > 0 && !current?.active && !(current?.images?.length);
      const payload = {
        name: draft.name, flavour: draft.flavour, price: Math.round(Number(draft.price) * 100),
        unit: draft.unit, weights: sizes, variantPrices: prices, variantLabels: labels, leadDays: Number(draft.leadDays),
        categoryMode: draft.categoryMode, ...(draft.categoryMode === "manual" ? { category: [draft.category] } : {}),
        badge: draft.badge, description: draft.description,
        eggless: draft.eggless, photo: draft.photo, active: publishAfterUpload ? false : draft.active
      };
      let created = false;
      try {
        await request(editing ? "products/" + encodeURIComponent(editing) : "products", editing ? "PATCH" : "POST",
          editing ? payload : { ...payload, id: productId });
        if (!editing) { created = true; setEditing(productId); setDraft(previous => ({ ...previous, active: false })); }
        if (pendingPhotos.length) {
          const compressed = await compressPhotos(pendingPhotos);
          setUploadProgress("Uploading " + compressed.length + " cake photo(s)…");
          const result = await uploadImages(productId, compressed);
          if (!result.images?.length) throw new Error("The server did not confirm your photos.");
          await putNewPhotosFirst(productId, current?.images || [], result.images);
          setPendingPhotos([]);
        }
        if (publishAfterUpload) {
          await request("products/" + encodeURIComponent(productId), "PATCH", { active: true });
          setDraft(previous => ({ ...previous, active: true }));
        }
      } catch (error) {
        if (created) throw new Error("Product draft saved as disabled, but photo upload or publishing failed. Select this product and retry your photos. " + error.message);
        throw error;
      } finally { setUploadProgress(""); }
    }, editing ? "Product and photos saved" : "Product created and photos uploaded");
  }
  return <div className="admin-product-manager">
    <div className="admin-card">
      <div className="admin-card-head"><h2>Manage product catalogue</h2>{isSuperAdmin && <button className="admin-primary" type="button" onClick={startNew}>+ Add product</button>}</div>
      <p className="admin-muted">Imported menu items start disabled. Check product photos, portion definitions, allergen details and prices before enabling. Delete safely archives an item; orders remain intact.</p>
      <div className="admin-toolbar">
        <input type="search" aria-label="Search products" placeholder="Search flavour or product ID" value={search} onChange={e=>setSearch(e.target.value)}/>
        <select aria-label="Filter product status" value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="all">All products ({products.length})</option>
          <option value="menu">Imported menu ({products.filter(p=>p.menuImported && !p.deletedAt).length})</option>
          <option value="photos">Photos uploaded</option>
          <option value="live">Live</option><option value="draft">Disabled</option><option value="deleted">Deleted</option>
        </select>
      </div>
      <p className="admin-muted">{matched.length} products</p>
      <div className="admin-product-list">{matched.map(p=><div key={p.id} className="admin-product-entry">
        <button type="button" className={editing===p.id?"active":""} onClick={()=>selectProduct(p)}>
          {p.name}<small>{p.category?.[0] ? p.category[0]+" · " : ""}₹{(Number(p.price||0)/100).toLocaleString("en-IN")} · {p.deletedAt?"Deleted":p.active?"Live":"Disabled"}</small>
          {p.id === "menu-chocolate-and-oreo" && !p.images?.some(url => /^\/api\/product-images\//.test(url)) && <small className="admin-product-photo-warning">Choco Oreo needs original product photos · upload to replace old cover</small>}
        </button>
        {isSuperAdmin && !p.deletedAt && <>
          <button type="button" className="admin-ghost" disabled={busy} onClick={()=>selectProduct(p)}>Edit</button>
          <button type="button" className="admin-ghost" disabled={busy||(!p.active&&!p.images?.length)} title={!p.images?.length?"Upload photos before enabling":undefined} onClick={()=>execute(()=>request("products/"+encodeURIComponent(p.id),"PATCH",{active:!p.active}),p.active?"Product disabled":"Product enabled")}>{p.active?"Disable":"Enable"}</button>
          <button type="button" className="admin-ghost" disabled={busy} onClick={()=>{if(window.confirm("Delete "+p.name+"? The cake will disappear from the store. Past orders are kept, and the product can be restored."))execute(()=>request("products/"+encodeURIComponent(p.id),"DELETE"),"Product deleted (archived)");}}>Delete</button>
        </>}
        {isSuperAdmin && p.deletedAt && <button type="button" className="admin-ghost" disabled={busy} onClick={()=>execute(()=>request("products/"+encodeURIComponent(p.id)+"/restore","POST"),"Product restored as disabled")}>Restore</button>}
      </div>)}</div>
    </div>
    {isSuperAdmin && <form className="admin-card admin-form" onSubmit={save}>
      <div className="admin-card-head"><h2>{editing?"Edit "+draft.name:"Add a product"}</h2><button type="button" className="admin-text" onClick={startNew}>New product / Clear form</button></div>
      <div className="admin-fields">
        <label>Product ID<input required disabled={Boolean(editing)} placeholder="e.g. menu-rose-cake" value={draft.id} onChange={e=>change("id",e.target.value)}/></label>
        <label>Product name<input required value={draft.name} onChange={e=>change("name",e.target.value)}/></label>
        <label>Flavour<input required value={draft.flavour} onChange={e=>change("flavour",e.target.value)}/></label>
        <label>Category assignment<select value={draft.categoryMode} onChange={e=>change("categoryMode",e.target.value)}><option value="auto">Automatic (based on name / flavour)</option><option value="manual">Manual category</option></select></label>
         {draft.categoryMode === "manual" && <label>Category<select required value={draft.category} onChange={e=>change("category",e.target.value)}><option value="">Choose category</option>{categories.filter(c=>c.active).map(c=><option key={c.slug} value={c.name}>{c.name}</option>)}</select></label>}
         {draft.categoryMode === "auto" && <p className="admin-muted admin-wide">The matching enabled category will be selected automatically. You can change it to Manual at any time.</p>}
        <label>Size type<select value={draft.unit} onChange={e=>change("unit",e.target.value)}><option value="kg">Kilograms</option><option value="pieces">Pieces</option><option value="menu">Printed menu portions</option></select></label>
        <label>{draft.unit==="menu"?"Option codes (e.g. 1,2,3)":"Available sizes (comma separated)"}<input required value={draft.weights} onChange={e=>change("weights",e.target.value)}/></label>
        <label>Base price (₹)<input required type="number" min="0.01" step="0.01" value={draft.price} onChange={e=>change("price",e.target.value)}/></label>
        <label>Exact prices (code:₹)<input placeholder="1:40, 2:249, 3:399" value={draft.variantPrices} onChange={e=>change("variantPrices",e.target.value)}/></label>
        <label className="admin-wide">Option labels (code:name)<input placeholder="1:Pastry, 2:Small, 3:Medium" value={draft.variantLabels} onChange={e=>change("variantLabels",e.target.value)}/></label>
        <label>Preparation notice (days)<input type="number" min="0" max="31" step="1" value={draft.leadDays} onChange={e=>change("leadDays",e.target.value)}/></label>
        <label>Product badge<input maxLength={100} value={draft.badge} onChange={e=>change("badge",e.target.value)}/></label>
        <div className="admin-wide admin-product-photo-picker">
          <label className="admin-photo-upload-label" htmlFor="admin-new-product-photos">
            Product photos {editing ? "(add more, optional)" : "(required)"}
            <input id="admin-new-product-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple
              disabled={busy || (editing && currentPhotos.length >= 16)}
              onChange={event => { choosePhotos(event.target.files || []); event.target.value = ""; }}/>
          </label>
          <p className="admin-muted">Choose photos from your phone or computer. JPG, PNG or WebP; max 12 at once, 16 total. Images are compressed and uploaded when you save. The first image becomes the cover.</p>
          {photoError && <p className="admin-alert" role="alert">{photoError}</p>}
          {photoPreviews.length > 0 && <div className="admin-product-photo-previews" aria-label="Photos selected for upload">
            {photoPreviews.map((photo, index) => <div key={photo.url}><img src={photo.url} alt={"Selected cake photo " + (index+1)}/><small>{index === 0 && !currentPhotos.length ? "Cover · " : ""}{photo.name}</small></div>)}
          </div>}
          {pendingPhotos.length > 0 && <button type="button" className="admin-text" onClick={clearPhotoSelection}>Clear selected photos</button>}
        </div>
        <label className="admin-wide">Description<textarea maxLength={1000} value={draft.description} onChange={e=>change("description",e.target.value)}/></label>
      </div>
      <div className="admin-checks">
        <label><input type="checkbox" checked={draft.active} onChange={e=>change("active",e.target.checked)}/> Enable website listing</label>
        <label><input type="checkbox" disabled={draft.unit==="menu"} checked={draft.eggless} onChange={e=>change("eggless",e.target.checked)}/> Eggless option</label>
        <label><input type="checkbox" checked={draft.photo} onChange={e=>change("photo",e.target.checked)}/> Customer photo upload</label>
      </div>
      {draft.unit==="menu" && <p className="admin-muted">Menu codes: 1=Pastry, 2=Small, 3=Medium. They are not kg weights. PDF extra charges are shown on the menu only; they are not automatically charged at checkout.</p>}
      {uploadProgress && <p className="admin-photo-note" role="status">{uploadProgress}</p>}
      <button type="submit" className="admin-primary" disabled={busy||Boolean(products.find(p=>p.id===editing)?.deletedAt)}>
        {busy ? "Saving photos…" : editing ? "Save product & upload photos" : "Create product & upload photos"}
      </button>
    </form>}
    {isSuperAdmin && <div className="admin-card admin-gallery-wrap">
      <h2>Product photo gallery</h2>
      <p className="admin-photo-note">Select an existing product above, then choose multiple photos. Your browser compresses each photo below 2 MB, and the server compresses again before storing it in MongoDB. Maximum 16 images per product.</p>
      {!currentProduct ? <p className="admin-muted">Select a product from the list to upload its photos.</p> : <>
        {currentProduct.id === "menu-chocolate-and-oreo" && !currentPhotos.some(url => /^\/api\/product-images\//.test(url)) && <p className="admin-note" role="status">Choco Oreo's original gallery was not included in the 202-image ZIP. Upload approved Choco Oreo photos under Edit Product → Choose Photos. Saving replaces the old cover photo on the store.</p>}
        <h3>{currentProduct.name} – {currentPhotos.length} image(s)</h3>
        <div className="admin-gallery-grid">{currentPhotos.map((url,i)=><div className="admin-gallery-image" key={url}>
          <img src={adminPreview(url)} alt={currentProduct.name+" image "+(i+1)} loading="lazy"/>
          <small>{i===0?"Cover image":"Image "+(i+1)}</small>
          <div className="admin-gallery-actions">
            <button type="button" disabled={busy||i===0} aria-label={"Move photo "+(i+1)+" left"} onClick={()=>execute(()=>changeOrder(i,i-1),"Photos reordered")}>←</button>
            <button type="button" disabled={busy||i===currentPhotos.length-1} aria-label={"Move photo "+(i+1)+" right"} onClick={()=>execute(()=>changeOrder(i,i+1),"Photos reordered")}>→</button>
            <button type="button" disabled={busy} aria-label={"Remove photo "+(i+1)} onClick={()=>{if(window.confirm("Remove photo "+(i+1)+" from "+currentProduct.name+"?"))execute(()=>request("products/"+encodeURIComponent(currentProduct.id)+"/images/"+encodeURIComponent(url.split("/").pop()),"DELETE"),"Photo removed");}}>Remove</button>
          </div>
        </div>)}</div>
        <label className="admin-gallery-picker">Choose photos for {currentProduct.name} (multiple allowed)
          <input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy||currentPhotos.length>=16} onChange={e=>{
            const files=[...(e.target.files||[])];e.target.value="";
            if(files.length)execute(()=>sendPhotos(files),"Photos compressed, uploaded and saved");
          }}/>
        </label>
        {uploadProgress && <p role="status" className="admin-photo-note">{uploadProgress}</p>}
      </>}
      <div className="admin-gallery-wrap">
        <h3>Import all 12 prepared cake galleries in one step</h3>
        <p className="admin-photo-note">Upload the compressed Cake Galaxy ZIP bundle (with menu-ID folders). The server validates images and stores each gallery without changing product visibility. The approved list now contains 32 cakes; the 10 matched photos will attach to those cakes and the remaining cakes stay enabled with their pending photos.</p>
        <label className="admin-gallery-picker">Choose prepared ZIP bundle (up to 32 MB)
          <input type="file" accept=".zip,application/zip" disabled={busy} onChange={e=>{
            const file=e.target.files?.[0];e.target.value="";
            if(file && window.confirm("Import all recognized cake galleries? Product enabled/disabled status will stay unchanged.")) execute(async()=>{
              const result=await importGalleryBundle(file);
              if(!result.imported?.length) throw new Error("No known cake images were imported.");
            },"Gallery ZIP imported; product statuses unchanged");
          }}/>
        </label>
      </div>
      <div className="admin-gallery-wrap">
        <h3>Publish the approved 32-cake list</h3>
        <p className="admin-photo-note">This disables non-approved products and enables only the 32 cakes from the owner's latest price list. Images and historical orders remain unchanged.</p>
        <button type="button" className="admin-primary" disabled={busy} onClick={()=>{
          if(window.confirm("Show only the approved 32 cakes? This will hide other products without deleting them.")) execute(async ()=>{
            const result=await request("catalogue/publish-uploaded-only","POST");
            if(!result.enabled && !result.disabled) throw new Error("No catalogue statuses were changed.");
          },"Approved 32-cake list published");
        }}>Publish approved 32 cakes</button>
      </div>
    </div>}

  </div>;
}
