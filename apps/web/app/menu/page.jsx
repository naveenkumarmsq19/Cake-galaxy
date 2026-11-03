import FullMenu from "../../src/screens/FullMenu";
import { pageMetadata, breadcrumbs } from "../../src/seo/site.mjs";
import { StructuredData } from "../../src/components/SearchContent";

export const metadata = pageMetadata({ title: "Cake Menu & Prices in Bengaluru", description: "View Cake Galaxy's current cake menu, available weights and prices. Cakes from 1 kg receive 10% off the base price. Add-ons and delivery are separate.", path: "/menu/" });
export default function Page() { return <><StructuredData data={breadcrumbs([{ name: "Menu & prices", path: "/menu/" }])}/><FullMenu/></>; }
