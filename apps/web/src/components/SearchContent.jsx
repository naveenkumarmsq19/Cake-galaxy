import Link from "next/link";
import { cakeFaqs } from "../content/faqs.mjs";
import { business, faqGraph, jsonLd } from "../seo/site.mjs";

export function StructuredData({ data }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }}/>;
}

export function CakeFaqs({ items = cakeFaqs, heading = "Cake orders: your questions answered" }) {
  return <section className="section cake-answers" aria-label={heading}>
    <h2>{heading}</h2>
    {items.map((item) => <details className="faq" key={item.question}><summary>{item.question}</summary><p>{item.answer}{item.href && <> <Link href={item.href}>{item.link}</Link>.</>}</p></details>)}
    <StructuredData data={faqGraph(items)}/>
  </section>;
}

export function StoreLocation() {
  return <section className="section store-location" aria-labelledby="cake-galaxy-location">
    <span className="overline">NAGARBHAVI · BENGALURU</span>
    <h2 id="cake-galaxy-location">Visit Cake Galaxy in Mudalapalya</h2>
    <p>{business.address}.</p><p>Browse the menu for current cakes and prices. Check your pincode before choosing a delivery date and slot.</p>
    <Link href="/visit/" className="text-link">Store location &amp; ordering information</Link>
  </section>;
}
