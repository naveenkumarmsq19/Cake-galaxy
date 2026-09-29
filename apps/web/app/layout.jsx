import "./globals.css";
import { StoreProvider } from "../src/components/Storefront";
import SiteShell from "../src/components/SiteShell";

export const metadata = {
  title: "Cake Galaxy | Made for your moments",
  description: "Shop celebration cakes, photo cakes and custom designs at Cake Galaxy. Personalise your cake and select a delivery date."
};

export default function RootLayout({ children }) {
  return <html lang="en"><body><StoreProvider><SiteShell>{children}</SiteShell></StoreProvider></body></html>;
}
