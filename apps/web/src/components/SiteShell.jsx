"use client";

import { usePathname } from "next/navigation";
import { Header, Footer } from "./Storefront";
import SmartChat from "./SmartChat";

export default function SiteShell({ children }) {
  const path = usePathname();
  if (path.startsWith("/admin")) return <main id="main">{children}</main>;
  return <><a className="skip-link" href="#main">Skip to content</a><Header/><main id="main">{children}</main><Footer/><SmartChat/></>;
}
