import { Suspense } from "react";
import { Confirmation } from "../../src/screens/Checkout";
export default function Page() { return <Suspense fallback={<div className="wrap page">Checking order…</div>}><Confirmation/></Suspense>; }
