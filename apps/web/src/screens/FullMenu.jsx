"use client";

import { useState } from "react";
import Link from "next/link";
import { menuSections, menuExtras } from "@cake-galaxy/catalog";

const amount = value => value === null ? "—" : "₹" + value.toLocaleString("en-IN");

export default function FullMenu() {
  const [query,setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = menuSections.map(group => ({...group,items:group.items.filter(item => !q || (group.title + " " + item.name).toLowerCase().includes(q))})).filter(group => group.items.length > 0);
  const count = shown.reduce((sum,group) => sum + group.items.length,0);
  return <div className="wrap page full-menu-page">
    <div className="breadcrumb"><Link href="/">Home</Link><span>/</span>Our Menu</div>
    <header className="menu-intro"><span className="overline">CAKE GALAXY • FULL FLAVOUR LIST</span><h1>Our Menu</h1>
      <p>Discover 74 flavours in 14 categories, with pastry, small and medium prices from our printed menu.</p>
      <p className="menu-size-note">Small and Medium are names from the provided menu. Their weights are not specified; ask the bakery to confirm the weight before ordering.</p>
    </header>
    <div className="menu-toolbar"><label htmlFor="menu-search">Search flavours</label><input id="menu-search" value={query} onChange={e=>setQuery(e.target.value)} type="search" placeholder="Chocolate, Mango, Red Velvet..."/><span role="status">{count} flavours</span></div>
    <nav aria-label="Jump to menu category" className="menu-jump">{menuSections.map(section=><a key={section.id} href={"#"+section.id}>{section.title}</a>)}</nav>
    {shown.length ? <div className="menu-sections">{shown.map(section=><section className="menu-section" key={section.id} id={section.id}>
      <h2>{section.title}</h2><div className="menu-table-scroll"><table className="menu-table">
        <thead><tr><th scope="col">Cake flavour</th><th scope="col">Pastry</th><th scope="col">Small</th><th scope="col">Medium</th></tr></thead>
        <tbody>{section.items.map(item=><tr key={item.name}><th scope="row">{item.name}</th><td>{amount(item.pastry)}</td><td>{amount(item.small)}</td><td>{amount(item.medium)}</td></tr>)}</tbody>
      </table></div></section>)}</div> : <div className="empty-state"><h2>No matching flavours</h2><button className="button outline" onClick={()=>setQuery("")}>Clear search</button></div>}
    <section className="menu-terms"><h2>Extra charges & special orders</h2><div className="menu-extras">{menuExtras.map(extra=><div key={extra.label}><strong>{extra.label}</strong><span>{extra.detail}</span></div>)}</div>
      <p>These prices come from the uploaded printed menu. Some flavours are not active for online checkout yet. The cart's final price and availability must be confirmed before payment. Actual designs/images should be verified with the bakery.</p>
      <div className="menu-ctas"><Link href="/shop" className="button">Shop available cakes</Link><Link href="/custom" className="button outline">Request a custom cake</Link></div>
    </section>
  </div>;
}
