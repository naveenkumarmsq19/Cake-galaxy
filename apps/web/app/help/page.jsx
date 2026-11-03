import { Help } from "../../src/screens/Info";
import { CakeFaqs, StructuredData } from "../../src/components/SearchContent";
import { breadcrumbs, pageMetadata } from "../../src/seo/site.mjs";

export const metadata = pageMetadata({ title: "Cake Orders, Delivery & Custom Cake FAQs", description: "Find Cake Galaxy answers about cake prices, the 1 kg discount, custom designs, eggless options, pincode delivery checks, cancellations and store location.", path: "/help/" });
export default function Page() { return <><StructuredData data={breadcrumbs([{ name: "Help & contact", path: "/help/" }])}/><Help><CakeFaqs/></Help></>; }
