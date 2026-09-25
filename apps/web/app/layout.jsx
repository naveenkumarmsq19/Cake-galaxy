import "./globals.css";
import { StoreProvider, Header, Footer, Support } from "../src/components/Storefront";

export const metadata = {
  title: "Cake Galaxy | Made for your moments",
  description: "Shop celebration cakes, photo cakes and custom designs at Cake Galaxy. Personalise your cake and select a delivery date."
};

export default function RootLayout({ children }) {
  return <html lang="en"><body><StoreProvider><a className="skip-link" href="#main">Skip to content</a><Header/><main id="main">{children}</main><Footer/><Support/></StoreProvider></body></html>;
}
