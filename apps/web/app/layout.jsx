import "./globals.css";
import { StoreProvider } from "../src/components/Storefront";
import SiteShell from "../src/components/SiteShell";

const siteUrl = "https://cakegalaxy.in";
const description = "Discover birthday cakes, photo cakes and custom-designed cakes at Cake Galaxy in Bengaluru. Browse the cake menu, choose flavours and request personalised designs.";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Cake Galaxy | Birthday & Custom Cakes in Bengaluru",
    template: "%s | Cake Galaxy"
  },
  description,
  applicationName: "Cake Galaxy",
  keywords: ["Cake Galaxy", "Cake Galaxy Bengaluru", "Cake Galaxy bakery", "birthday cakes Bengaluru", "custom cakes Bengaluru", "photo cakes Bengaluru", "cakes Nagarbhavi"],
  alternates: { canonical: "/" },
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
  return <html lang="en"><body><StoreProvider><SiteShell>{children}</SiteShell></StoreProvider></body></html>;
}
