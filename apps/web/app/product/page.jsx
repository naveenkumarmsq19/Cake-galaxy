export const metadata = {
  "title": "Cake Details",
  "robots": {
    "index": false,
    "follow": false
  }
};
import { Suspense } from "react";
import { Product } from "../../src/screens/Browse";
export default function Page() { return <Suspense fallback={<div className="wrap page">Loading cake…</div>}><Product/></Suspense>; }
