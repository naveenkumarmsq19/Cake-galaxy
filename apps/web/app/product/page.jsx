export const metadata = {
  "title": "Cake Details",
  "robots": {
    "index": false,
    "follow": false
  }
};
import { Suspense } from "react";
import CakeLoader from "../../src/components/CakeLoader";
import { Product } from "../../src/screens/Browse";
export default function Page() { return <Suspense fallback={<CakeLoader size="large" fullScreen label="Loading cake…"/>}><Product/></Suspense>; }
