export const metadata = {
  "title": "Policies",
  "robots": {
    "index": false,
    "follow": false
  }
};
import { Suspense } from "react";
import CakeLoader from "../../src/components/CakeLoader";
import { Policy } from "../../src/screens/Info";
export default function Page() { return <Suspense fallback={<CakeLoader variant="logo" size="large" fullScreen label="Loading Cake Galaxy policies…" />}><Policy/></Suspense>; }
