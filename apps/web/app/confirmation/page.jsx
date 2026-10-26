export const metadata = {
  "title": "Order Confirmation",
  "robots": {
    "index": false,
    "follow": false
  }
};
import { Suspense } from "react";
import { Confirmation } from "../../src/screens/Checkout";
export default function Page() { return <Suspense fallback={<div className="wrap page">Checking order…</div>}><Confirmation/></Suspense>; }
