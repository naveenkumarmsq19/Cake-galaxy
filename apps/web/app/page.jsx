import { Home } from "../src/screens/Browse";

const siteUrl = "https://cakegalaxy.in";
const business = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Bakery",
      "@id": siteUrl + "/#bakery",
      name: "Cake Galaxy",
      alternateName: "Cake Galaxy Vijayanagar",
      url: siteUrl,
      image: siteUrl + "/images/celebration-banner.webp",
      logo: siteUrl + "/images/cake-galaxy-sage-logo.webp",
      description: "Birthday cakes, photo cakes and customised celebration cakes from Cake Galaxy on Nagarabhavi Main Road, Mudalapalya, Vijayanagar, Bengaluru.",
      menu: siteUrl + "/menu/",
      address: {
        "@type": "PostalAddress",
        streetAddress: "No. 1, Nagarabhavi Main Road, opposite Bank of Baroda, Mudalapalya, Vijayanagar, Govindaraja Nagar Ward",
        addressLocality: "Bengaluru",
        addressRegion: "Karnataka",
        postalCode: "560072",
        addressCountry: "IN"
      },
      areaServed: { "@type": "City", name: "Bengaluru" }
    },
    {
      "@type": "WebSite",
      "@id": siteUrl + "/#website",
      name: "Cake Galaxy",
      url: siteUrl,
      publisher: { "@id": siteUrl + "/#bakery" },
      inLanguage: "en-IN"
    }
  ]
};

export default function Page() {
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(business).replace(/</g, "\\u003c") }} />
    <Home />
  </>;
}
