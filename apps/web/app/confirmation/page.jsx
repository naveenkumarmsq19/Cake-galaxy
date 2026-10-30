export const metadata = {
  "title": "Order Confirmation",
  "robots": {
    "index": false,
    "follow": false
  }
};
import { Suspense } from "react";
import CakeLoader from "../../src/components/CakeLoader";
import { Confirmation } from "../../src/screens/Checkout";
export default function Page() { return <Suspense fallback={<CakeLoader size="large" fullScreen label="Checking order…"/>}><Confirmation/></Suspense>; }
