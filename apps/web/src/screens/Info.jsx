"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { policies, policyUpdatedAt } from "../content/policies";

const legalName = process.env.NEXT_PUBLIC_LEGAL_BUSINESS_NAME || "";
const businessAddress = process.env.NEXT_PUBLIC_BUSINESS_ADDRESS || "";
const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "";
const grievanceOfficer = process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME || "";
const grievanceEmail = process.env.NEXT_PUBLIC_GRIEVANCE_EMAIL || "";
const fssaiNumber = process.env.NEXT_PUBLIC_FSSAI_LICENSE_NUMBER || "";
const fullyConfigured = Boolean(legalName && businessAddress && supportEmail && grievanceOfficer && grievanceEmail && fssaiNumber);

function BusinessContact() {
  return <section className="policy-contact" aria-labelledby="business-contact-heading">
    <h2 id="business-contact-heading">Business &amp; contact information</h2>
    {!fullyConfigured && <p className="subtle">Pre-launch notice: verified operator, food-license and complaint contact details will be published before live ordering is enabled.</p>}
    <p><strong>Trading name:</strong> Cake Galaxy</p>
    {legalName && <p><strong>Legal operator:</strong> {legalName}</p>}
    {businessAddress && <p><strong>Business address:</strong> {businessAddress}</p>}
    {fssaiNumber && <p><strong>FSSAI license/registration:</strong> {fssaiNumber}</p>}
    {supportEmail && <p><strong>Customer support:</strong> <a href={"mailto:" + supportEmail}>{supportEmail}</a></p>}
    {grievanceOfficer && <p><strong>Grievance officer:</strong> {grievanceOfficer}</p>}
    {grievanceEmail && <p><strong>Grievance / privacy requests:</strong> <a href={"mailto:" + grievanceEmail}>{grievanceEmail}</a></p>}
    <p>Include your order reference when reporting an order problem. For cancellation requests, use <Link href="/orders">My Orders</Link>.</p>
  </section>;
}

export function Help({ children }) {
  return <div className="wrap page">
    <div className="page-heading"><h1>How can we help?</h1></div>
    <div className="help-layout">
      <div>{children}</div>
      <aside className="help-note"><h2>We're here for your celebration.</h2><p>View your order, then quote the reference when contacting support.</p><Link href="/orders" className="button">My Orders</Link></aside>
    </div>
    <BusinessContact/>
  </div>;
}

export function Policy() {
  const params = useSearchParams();
  const requested = params.get("type") || "terms";
  const selected = Object.hasOwn(policies, requested) ? requested : "terms";
  const policy = policies[selected];
  return <div className="wrap page">
    <div className="policy-content">
      <div className="breadcrumb"><Link href="/">Home</Link><span>/</span>{policy.title}</div>
      <h1>{policy.title}</h1>
      <p className="subtle">Draft updated: {policyUpdatedAt}</p>
      <p>{policy.intro}</p>
      <nav aria-label="Other policies"><Link href="/policy?type=terms">Terms</Link>{" · "}<Link href="/policy?type=privacy">Privacy</Link>{" · "}<Link href="/policy?type=refund">Cancellation &amp; refunds</Link>{" · "}<Link href="/policy?type=delivery">Delivery</Link></nav>
      {policy.sections.map((section) => <section key={section.heading}>
        <h2>{section.heading}</h2>
        {section.paragraphs?.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        {section.bullets && <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}
      </section>)}
      <BusinessContact/>
      <p><Link href="/help" className="text-link">Help &amp; contact</Link></p>
    </div>
  </div>;
}
