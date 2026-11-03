import { Home } from "../src/screens/Browse";
import { CakeFaqs, StoreLocation } from "../src/components/SearchContent";
import { business, pageMetadata } from "../src/seo/site.mjs";

export const metadata = pageMetadata({ title: "Cake Galaxy | Cakes in Nagarbhavi, Bengaluru", description: business.description, path: "/" });
export default function Page() { return <Home><StoreLocation/><CakeFaqs/></Home>; }
