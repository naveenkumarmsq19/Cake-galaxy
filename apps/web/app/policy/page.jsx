export const metadata = {
  "title": "Policies",
  "robots": {
    "index": false,
    "follow": false
  }
};
import { Suspense } from "react";
import { Policy } from "../../src/screens/Info";
export default function Page() { return <Suspense fallback={<div className="wrap page">Loading…</div>}><Policy/></Suspense>; }
