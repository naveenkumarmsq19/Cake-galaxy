"use client";

import Link from "next/link";
import { discountAmount, money, regularUnitPrice, sizeLabel, unitPrice } from "@cake-galaxy/catalog";
import { Icon, useStore } from "./Storefront";

export function ProductCard({ product }) {
  const startingItem = { productId: product.id, size: product.weights[0], eggless: false, addons: [] };
  const startingPrice = unitPrice(startingItem, product);
  const originalPrice = regularUnitPrice(startingItem, product);
  const saving = discountAmount(startingItem, product);
  return <article className="product-card"><Link className="product-card-image" href={"/product?id=" + product.id}><img src={product.images?.[0] || product.image} alt={product.name} loading="lazy"/><span className="product-tag">{product.badge}</span></Link><div className="product-card-info"><h3><Link href={"/product?id=" + product.id}>{product.name}</Link></h3><div className="price-line"><span className="price">{money(startingPrice)}</span>{saving > 0 && <del className="price-original">{money(originalPrice)}</del>}<small>{sizeLabel(product)}</small>{product.unit === "kg" && product.weights.some((weight) => weight >= 1) && <small className="discount-badge">10% off from 1 kg</small>}</div><p className="meta">{product.photo ? "Add your photograph" : "Personalise with a message"}</p></div></article>;
}

export function Summary({ children, taxRate = null, gstRegistered = true }) {
  const { cart, catalog, subtotal, subtotalBeforeDiscount, discountTotal, quote } = useStore();
  const fee = quote?.available ? quote.deliveryFee : null;
  const tax = typeof taxRate === "number" && Number.isFinite(taxRate) ? Math.round(subtotal * taxRate / 100) : null;
  return <aside className="panel summary"><h2>Order summary</h2>{cart.map((item) => <div className="compact-item" key={item.id}><img src={catalog.find((p) => p.id === item.productId)?.image} alt=""/><span>{catalog.find((p) => p.id === item.productId)?.name}<small>{item.quantity} × {money(unitPrice(item, catalog.find((p) => p.id === item.productId)))}</small></span></div>)}<div className="summary-row"><span>Cake subtotal</span><span>{money(subtotalBeforeDiscount)}</span></div>{discountTotal > 0 && <div className="summary-row discount-row"><span>10% discount (cakes 1 kg and above)</span><span>−{money(discountTotal)}</span></div>}<div className="summary-row"><span>Subtotal after discount</span><span>{money(subtotal)}</span></div><div className="summary-row"><span>Delivery</span><span>{fee === null ? "Calculated before payment" : money(fee)}</span></div><div className="summary-row"><span>{gstRegistered ? "GST" + (taxRate !== null ? " (" + taxRate + "%)" : "") : "GST not charged"}</span><span>{tax === null ? "Shown at checkout" : money(tax)}</span></div><div className="summary-row total"><span>{fee === null || tax === null ? "Subtotal + known charges" : "Payable total"}</span><span>{money(subtotal + (fee || 0) + (tax || 0))}</span></div>{children}<p className="small-print">The payable total is checked again before the payment window opens.</p></aside>;
}

export function SectionHeading({ title, description, href = "/shop" }) { return <div className="section-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div><Link className="text-link" href={href}>View all <Icon name="arrow"/></Link></div>; }
