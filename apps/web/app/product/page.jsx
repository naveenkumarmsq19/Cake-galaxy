import { Suspense } from "react";
import { Product } from "../../src/screens/Browse";
export default function Page() { return <Suspense fallback={<div className="wrap page">Loading cake…</div>}><Product/></Suspense>; }
