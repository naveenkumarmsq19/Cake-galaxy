export const metadata = {
  "title": "Sign In",
  "robots": {
    "index": false,
    "follow": false
  }
};
import { Suspense } from "react";
import CakeLoader from "../../src/components/CakeLoader";
import { Login } from "../../src/screens/Checkout";
export default function Page() { return <Suspense fallback={<CakeLoader size="large" fullScreen label="Loading sign in…"/>}><Login/></Suspense>; }
