export const metadata = {
  "title": "Cake Details",
  "robots": {
    "index": false,
    "follow": true
  },
  "alternates": { "canonical": null }
};
import { Suspense } from "react";
import CakeLoader from "../../src/components/CakeLoader";
import { LegacyProduct } from "../../src/screens/Browse";
export default function Page() { return <Suspense fallback={<CakeLoader variant="logo" size="large" fullScreen label="Loading cake…"/>}><LegacyProduct/></Suspense>; }
