import Link from "next/link";
import { CakeFaqs, StructuredData } from "../../src/components/SearchContent";
import { cakeFaqs } from "../../src/content/faqs.mjs";
import { breadcrumbs, business, pageMetadata } from "../../src/seo/site.mjs";

export const metadata = pageMetadata({ title: "Cake Shop in Nagarbhavi, Mudalapalya", description: "Visit Cake Galaxy on Nagarabhavi Main Road, opposite Bank of Baroda, Mudalapalya, Bengaluru 560072. View the menu, request custom cakes and check delivery.", path: "/visit/" });

export default function Page() {
  const mapsUrl = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(business.name + " " + business.address);
  return <div className="wrap page">
    <StructuredData data={breadcrumbs([{ name: "Nagarbhavi store", path: "/visit/" }])}/>
    <div className="breadcrumb"><Link href="/">Home</Link><span>/</span>Nagarbhavi store</div>
    <div className="page-heading"><div><span className="overline">CAKE GALAXY · BENGALURU</span><h1>Cake shop in Nagarbhavi, Mudalapalya</h1><p>Choose a cake for your next celebration from Cake Galaxy in Bengaluru.</p></div></div>
    <section className="panel store-location"><h2>Find Cake Galaxy</h2><address>{business.address}</address><p><strong>Landmark:</strong> Opposite Bank of Baroda, on Nagarabhavi Main Road.</p><a href={mapsUrl} className="text-link" target="_blank" rel="noopener noreferrer">Find the store on Google Maps</a></section>
    <section className="section"><h2>Choose your cake</h2><p>Browse the current menu and open a product to see its available weights, prices and personalisation options. For a design inspired by your celebration, upload a reference image through the custom cake form. The bakery confirms custom design details and the final quote before payment.</p><div className="menu-ctas"><Link href="/menu/" className="button">View menu &amp; prices</Link><Link href="/custom/" className="button outline">Request a custom cake</Link></div></section>
    <section className="section"><h2>Check delivery before ordering</h2><p>Delivery depends on your six-digit pincode and the active branch serving that area. Check availability on the website, then choose an available future date and slot. Delivery charges are shown before payment.</p><Link href="/shop/" className="text-link">Choose a cake and check your pincode</Link></section>
    <CakeFaqs items={cakeFaqs.filter((_, index) => [1, 3, 4, 5].includes(index))}/>
  </div>;
}
