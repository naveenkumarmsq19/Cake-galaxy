export const metadata = {
  "title": "Order Cakes Online in Bengaluru",
  "description": "Browse birthday cakes, chocolate cakes, photo cakes and more at Cake Galaxy Bengaluru. Explore flavours and personalise your cake.",
  "alternates": {
    "canonical": "/shop/"
  }
};
import { Suspense } from "react";
import { Shop } from "../../src/screens/Browse";
export default function Page() { return <Suspense fallback={<div className="wrap page">Loading cakes…</div>}><Shop/></Suspense>; }
