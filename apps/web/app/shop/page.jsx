import { Suspense } from "react";
import { DefaultShop, Shop } from "../../src/screens/Browse";
import { pageMetadata, breadcrumbs } from "../../src/seo/site.mjs";
import { StructuredData } from "../../src/components/SearchContent";

export const metadata = pageMetadata({ title: "Order Cakes Online in Bengaluru", description: "Browse Cake Galaxy's available cakes, prices and weights. Choose a birthday or celebration cake and check your delivery pincode in Bengaluru.", path: "/shop/" });
export default function Page() {
  return <><StructuredData data={breadcrumbs([{ name: "Cakes", path: "/shop/" }])}/><Suspense fallback={<DefaultShop/>}><Shop/></Suspense></>;
}
