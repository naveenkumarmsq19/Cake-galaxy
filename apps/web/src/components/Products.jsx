"use client";

import Link from "next/link";
import { money, sizeLabel, unitPrice } from "@cake-galaxy/catalog";
import { Icon, useStore } from "./Storefront";

export function ProductCard({ product }) {
  return <article className="product-card"><Link className="product-card-image" href={"/product?id=" + product.id}><img src={product.image} alt={product.name} loading="lazy"/><span className="product-tag">{product.badge}</span></Link><div className="product-card-info"><h3><Link href={"/product?id=" + product.id}>{product.name}</Link></h3><div className="price-line"><span className="price">{money(product.price)}</span><small>{sizeLabel(product)}</small></div><p className="meta">{product.photo ? "Add your photograph" : "Personalise with a message"}</p></div></article>;
}

export function Summary({ children }) {
  const { cart, catalog, subtotal, quote } = useStore();
  const fee = quote?.available ? quote.deliveryFee : null;
  return <aside className="panel summary"><h2>Order summary</h2>{cart.map((item) => <div className="compact-item" key={item.id}><img src={catalog.find((p) => p.id === item.productId)?.image} alt=""/><span>{catalog.find((p) => p.id === item.productId)?.name}<small>{item.quantity} × {money(unitPrice(item, catalog.find((p) => p.id === item.productId)))}</small></span></div>)}<div className="summary-row"><span>Subtotal</span><span>{money(subtotal)}</span></div><div className="summary-row"><span>Delivery</span><span>{fee === null ? "Calculated before payment" : money(fee)}</span></div><div className="summary-row total"><span>{fee === null ? "Subtotal" : "Total"}</span><span>{money(subtotal + (fee || 0))}</span></div>{children}<p className="small-print">Final charges are confirmed before you pay.</p></aside>;
}

export function SectionHeading({ title, description, href = "/shop" }) { return <div className="section-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div><Link className="text-link" href={href}>View all <Icon name="arrow"/></Link></div>; }
