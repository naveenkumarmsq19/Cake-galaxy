import { Suspense } from "react";
import { Shop } from "../../src/screens/Browse";
export default function Page() { return <Suspense fallback={<div className="wrap page">Loading cakes…</div>}><Shop/></Suspense>; }
