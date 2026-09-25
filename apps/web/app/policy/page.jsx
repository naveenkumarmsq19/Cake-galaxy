import { Suspense } from "react";
import { Policy } from "../../src/screens/Info";
export default function Page() { return <Suspense fallback={<div className="wrap page">Loading…</div>}><Policy/></Suspense>; }
