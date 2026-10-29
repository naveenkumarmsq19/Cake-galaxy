import "./globals.css";
import { StoreProvider } from "../src/components/Storefront";
import SiteShell from "../src/components/SiteShell";

const siteUrl = "https://cakegalaxy.in";
const description = "Visit Cake Galaxy Vijayanagar on Nagarabhavi Main Road, Mudalapalya, Bengaluru 560072. Explore birthday, photo and custom cakes; check delivery availability online.";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Cake Galaxy Vijayanagar | Birthday & Custom Cakes Bengaluru",
    template: "%s | Cake Galaxy Vijayanagar"
  },
  description,
  applicationName: "Cake Galaxy",
  keywords: ["Cake Galaxy", "Cake Galaxy Vijayanagar", "Cake Galaxy Mudalapalya", "Cake Galaxy Nagarabhavi", "cake shop Vijayanagar Bengaluru", "birthday cakes Bengaluru", "custom cakes Bengaluru", "photo cakes Bengaluru"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "Cake Galaxy",
    url: siteUrl,
    title: "Cake Galaxy Vijayanagar | Birthday & Custom Cakes Bengaluru",
    description,
    images: [{ url: "/images/celebration-banner.webp", alt: "Celebration cakes by Cake Galaxy" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Cake Galaxy Vijayanagar | Birthday & Custom Cakes Bengaluru",
    description,
    images: ["/images/celebration-banner.webp"]
  },
  icons: { icon: [{ url: "/images/cake-galaxy-sage-logo.webp", type: "image/webp" }] }
};

export default function RootLayout({ children }) {
  return <html lang="en"><body><StoreProvider><SiteShell>{children}</SiteShell></StoreProvider></body></html>;
}
