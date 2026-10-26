export const metadata = {
  "title": "Sign In",
  "robots": {
    "index": false,
    "follow": false
  }
};
import { Suspense } from "react";
import { Login } from "../../src/screens/Checkout";
export default function Page() { return <Suspense fallback={<div className="wrap page">Loading sign in…</div>}><Login/></Suspense>; }
