"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { money, unitPrice } from "@cake-galaxy/catalog";
import { useStore } from "../components/Storefront";

function slug(value) { return value.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""); }
function quotedPrice(product, weight) {
  if (!product.weights?.includes(weight)) return "—";
  return money(unitPrice({ productId:product.id, size:weight, addons:[], eggless:false },product));
}

export default function FullMenu() {
  const { catalog, catalogLoaded } = useStore();
  const [query,setQuery] = useState("");
  const q=query.trim().toLowerCase();
  const sections=useMemo(() => {
    const byGroup=new Map();
    for (const product of catalog) {
      const category=product.menuCategory || product.category?.[0] || "Cakes";
      if (!byGroup.has(category)) byGroup.set(category,[]);
      byGroup.get(category).push(product);
    }
    return [...byGroup.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([title,items])=>({
      title, id:slug(title),items:items.filter(p=>(p.name+" "+title).toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name))
    })).filter(group=>group.items.length);
  },[catalog,q]);
  const count=sections.reduce((sum,group)=>sum+group.items.length,0);
  return <div className="wrap page full-menu-page">
    <div className="breadcrumb"><Link href="/">Home</Link><span>/</span>Our Menu</div>
    <header className="menu-intro">
      <span className="overline">CAKE GALAXY • CURRENTLY AVAILABLE CAKES</span>
      <h1>Our Menu &amp; Prices</h1>
      <p>Explore the cakes currently enabled for ordering, grouped by flavour category.</p>
      <p className="menu-size-note">Half-kg prices are set by Cake Galaxy. A 1 kg cake has a base price of twice the half-kg price. Cakes weighing 1 kg or more receive 10% off the cake base price. Add-ons and delivery are shown separately at checkout.</p>
    </header>
    <div className="menu-toolbar">
      <label htmlFor="menu-search">Search cakes</label>
      <input id="menu-search" value={query} onChange={e=>setQuery(e.target.value)} type="search" placeholder="Chocolate, Mango, Red Velvet..."/>
      <span role="status">{catalogLoaded ? count+" available cakes" : "Loading menu..."}</span>
    </div>
    {catalogLoaded && <nav aria-label="Jump to menu category" className="menu-jump">{sections.map(section=><a key={section.id} href={"#"+section.id}>{section.title}</a>)}</nav>}
    {sections.length ? <div className="menu-sections">{sections.map(section=><section className="menu-section" key={section.id} id={section.id}>
      <h2>{section.title}</h2>
      <div className="menu-table-scroll"><table className="menu-table">
        <thead><tr><th scope="col">Cake</th><th scope="col">½ kg</th><th scope="col">1 kg (10% off)</th><th scope="col">1½ kg (10% off)</th></tr></thead>
        <tbody>{section.items.map(product=><tr key={product.id}>
          <th scope="row"><Link href={"/product?id="+encodeURIComponent(product.id)}>{product.name} ↗</Link></th>
          <td>{quotedPrice(product,0.5)}</td><td>{quotedPrice(product,1)}</td><td>{quotedPrice(product,1.5)}</td>
        </tr>)}</tbody>
      </table></div>
    </section>)}</div> : <div className="empty-state"><h2>{catalogLoaded ? "No matching cakes" : "Loading the latest menu..."}</h2>{catalogLoaded && <button type="button" className="button outline" onClick={()=>setQuery("")}>Clear search</button>}</div>}
    <section className="menu-terms">
      <h2>Other cake sizes</h2><p>Choose weights up to 20 kg in ½ kg increments on the product page. Final totals include any selected extras and delivery charges. Products not yet approved for sale remain hidden from this live menu. Photos may be illustrative until actual bakery images are uploaded.</p>
      <div className="menu-ctas"><Link href="/shop" className="button">Shop available cakes</Link><Link href="/custom" className="button outline">Request a custom cake</Link></div>
    </section>
  </div>;
}
