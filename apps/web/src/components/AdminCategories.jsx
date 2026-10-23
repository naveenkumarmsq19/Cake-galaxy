"use client";

import { useState } from "react";

const empty = { name: "", keywords: "", image: "", sortOrder: "100" };
const fromCategory = c => ({ name: c.name, keywords: (c.keywords || []).join(", "), image: c.image || "", sortOrder: String(c.sortOrder ?? 100) });

export default function AdminCategories({ categories, products, isSuperAdmin, busy, request, execute }) {
  const [draft, setDraft] = useState(empty);
  const [editing, setEditing] = useState(null);
  const set = (key, value) => setDraft(current => ({ ...current, [key]: value }));
  const reset = () => { setEditing(null); setDraft(empty); };
  const save = event => {
    event.preventDefault();
    execute(async () => {
      const payload = {
        keywords: [...new Set(draft.keywords.split(",").map(s => s.trim().toLowerCase()).filter(Boolean))],
        image: draft.image.trim(),
        sortOrder: Number(draft.sortOrder)
      };
      if (editing) await request("categories/" + encodeURIComponent(editing._id), "PATCH", payload);
      else await request("categories", "POST", { ...payload, name: draft.name.trim() });
      reset();
    }, editing ? "Category updated; automatic product assignments refreshed" : "Category created and products automatically matched");
  };
  return <div className="admin-category-manager">
    <div className="admin-card">
      <div className="admin-card-head">
        <div><h2>Store categories</h2><p>Only enabled categories appear on the customer website. Old categories are kept disabled, not deleted.</p></div>
        {isSuperAdmin && <button type="button" className="admin-primary" onClick={reset}>+ New category</button>}
      </div>
      <div className="admin-category-grid">
        {categories.map(category => {
          const count = products.filter(p => !p.deletedAt && p.active && (p.category || []).includes(category.name)).length;
          return <article className="admin-category-entry" key={category._id}>
            <div className="admin-category-entry-head">
              <strong>{category.name}</strong>
              <span className={category.active ? "admin-pill good" : "admin-pill"}>{category.active ? "Enabled" : "Disabled"}</span>
            </div>
            <p>{count} live cake{count === 1 ? "" : "s"} · Order {category.sortOrder}</p>
            <small>Keywords: {(category.keywords || []).join(", ") || "Manual mapping only / fallback"}</small>
            {isSuperAdmin && <div className="admin-actions">
              <button type="button" className="admin-ghost" disabled={busy} onClick={() => { setEditing(category); setDraft(fromCategory(category)); }}>Edit</button>
              <button type="button" className="admin-ghost" disabled={busy || (category.name === "Signature Cakes" && category.active)}
                onClick={() => execute(() => request("categories/" + encodeURIComponent(category._id), "PATCH", { active: !category.active }), category.active ? "Category disabled; affected cakes reassigned" : "Category enabled; auto-matched cakes refreshed")}>
                {category.active ? "Disable" : "Enable"}
              </button>
            </div>}
          </article>;
        })}
      </div>
    </div>
    {isSuperAdmin && <form className="admin-card admin-form" onSubmit={save}>
      <div className="admin-card-head"><h2>{editing ? "Edit " + editing.name : "Create category"}</h2>{editing && <button type="button" className="admin-text" onClick={reset}>Cancel</button>}</div>
      <div className="admin-fields">
        <label>Category name<input required disabled={Boolean(editing)} minLength={3} maxLength={60} value={draft.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Matcha Cakes"/></label>
        <label>Display order<input type="number" min="0" max="1000" step="1" required value={draft.sortOrder} onChange={e=>set("sortOrder",e.target.value)}/></label>
        <label className="admin-wide">Auto-match keywords (comma separated)<input value={draft.keywords} maxLength={500} onChange={e=>set("keywords",e.target.value)} placeholder="matcha, green tea"/></label>
        <label className="admin-wide">Category image URL (optional)<input value={draft.image} onChange={e=>set("image",e.target.value)} maxLength={500} placeholder="/images/celebration.jpg or https://..."/></label>
      </div>
      <p className="admin-muted">Auto mode matches product name and flavour to the earliest matching category. Manual mapping in Products always takes priority. Unknown flavours go into Signature Cakes.</p>
      <button className="admin-primary" disabled={busy}>{editing ? "Save category" : "Create category"}</button>
    </form>}
  </div>;
}
