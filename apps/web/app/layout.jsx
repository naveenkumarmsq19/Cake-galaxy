import "./globals.css";
import { StoreProvider } from "../src/components/Storefront";
import SiteShell from "../src/components/SiteShell";
import catalog from "../src/seo/snapshot";
import { bakeryGraph, business, jsonLd } from "../src/seo/site.mjs";

const siteUrl = "https://cakegalaxy.in";
const description = business.description;

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Cake Galaxy | Cakes in Nagarbhavi, Bengaluru",
    template: "%s | Cake Galaxy"
  },
  description,
  applicationName: "Cake Galaxy",
  keywords: ["Cake Galaxy", "Cake Galaxy Bengaluru", "Cake Galaxy bakery", "birthday cakes Bengaluru", "custom cakes Bengaluru", "photo cakes Bengaluru", "cakes Nagarbhavi"],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : {}),
    ...(process.env.BING_SITE_VERIFICATION ? { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } } : {})
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "Cake Galaxy",
    url: siteUrl,
    title: "Cake Galaxy | Birthday & Custom Cakes in Bengaluru",
    description,
    images: [{ url: "/images/celebration-banner.webp", alt: "Celebration cakes by Cake Galaxy" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Cake Galaxy | Birthday & Custom Cakes in Bengaluru",
    description,
    images: ["/images/celebration-banner.webp"]
  },
  icons: { icon: [{ url: "/images/cake-galaxy-sage-logo.webp", type: "image/webp" }] }
};

export default function RootLayout({ children }) {
  return <html lang="en-IN"><body><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(bakeryGraph()) }}/><StoreProvider initialCatalog={catalog}><SiteShell>{children}</SiteShell></StoreProvider></body></html>;
}
