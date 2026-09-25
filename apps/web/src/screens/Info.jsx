"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function Help() {
  return <div className="wrap page"><div className="page-heading"><h1>How can we help?</h1></div><div className="help-layout"><div><details className="faq"><summary>How do I personalise my cake?</summary><p>Choose a cake, add a message and select your size. For a unique design, use the Custom cakes page.</p></details><details className="faq"><summary>Can I send a cake to someone else?</summary><p>Yes. Enter the recipient's delivery address and preferred date at checkout.</p></details><details className="faq"><summary>Which areas can you deliver to?</summary><p>Use the pincode checker before checkout. Delivery is offered only where availability is confirmed.</p></details><details className="faq"><summary>Can I cancel an order?</summary><p>Submit a request from My orders. We review it against the merchant's approved cancellation terms before deciding on any refund.</p></details></div><aside className="help-note"><h2>Made for your moments.</h2><p>For help with an existing order, open My orders.</p><Link href="/orders" className="button">My orders</Link></aside></div></div>;
}

export function Policy() {
  const type = useSearchParams().get("type") || "terms";
  const sections = {
    terms: ["Terms & conditions", "Order acceptance, pricing, preparation and delivery are confirmed before payment. Merchant-approved terms will be published before live ordering is enabled."],
    refund: ["Cancellation & refunds", "Submit a cancellation request from My orders. A request is not an automatic refund. Eligibility and timelines will follow the merchant's approved policy, published before live orders are enabled."],
    delivery: ["Delivery information", "Check your pincode and choose an available delivery date and slot during checkout. Availability and charges are verified before payment."],
    privacy: ["Privacy", "Contact and delivery details are used to process your request. WhatsApp order messages are sent only when you choose to receive them. The merchant's full privacy terms will be published before live ordering is enabled."]
  };
  const [title, description] = sections[type] || sections.terms;
  return <div className="wrap page"><div className="policy-content"><div className="breadcrumb"><Link href="/">Home</Link><span>/</span>{title}</div><h1>{title}</h1><p>{description}</p><Link href="/help" className="text-link">Help & contact</Link></div></div>;
}
