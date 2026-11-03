import { Custom } from "../../src/screens/Browse";
import { pageMetadata, breadcrumbs } from "../../src/seo/site.mjs";
import { StructuredData } from "../../src/components/SearchContent";

export const metadata = pageMetadata({ title: "Custom Cake Designs in Bengaluru", description: "Request a personalised Cake Galaxy cake in Bengaluru. Choose an available flavour and weight, upload a reference design and receive a confirmed quote.", path: "/custom/" });
export default function Page() { return <><StructuredData data={breadcrumbs([{ name: "Custom cake designs", path: "/custom/" }])}/><Custom/></>; }
