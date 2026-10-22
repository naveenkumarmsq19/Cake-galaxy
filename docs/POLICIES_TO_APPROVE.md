# Cake Galaxy – policy review before production

These are **drafts**, written to match the actual source code on the Cake Galaxy fix branch as reviewed on 22 October 2026. The text is visible at `/policy?type=terms`, `privacy`, `refund`, and `delivery`; the help page explains complaints. The business operator must review accuracy and have counsel/food-safety/accounting advisers check applicable requirements before taking live orders.

## Required public details

Set the following `apps/web` **build-time** values and rebuild the Cloudflare site:

- `NEXT_PUBLIC_LEGAL_BUSINESS_NAME`: actual registered operator/business name.
- `NEXT_PUBLIC_BUSINESS_ADDRESS`: verified customer-facing business correspondence address.
- `NEXT_PUBLIC_SUPPORT_EMAIL`: monitored customer support email.
- `NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME`: designated complaint officer.
- `NEXT_PUBLIC_GRIEVANCE_EMAIL`: monitored grievance and privacy request email.
- `NEXT_PUBLIC_FSSAI_LICENSE_NUMBER`: genuine license or registration identifier (verify appropriate e-commerce FBO coverage).

Never invent these details or enable `POLICIES_APPROVED=true` while they are blank or unverified. Business identity requirements also may require a contact phone and grievance officer details under applicable e-commerce rules; publish these once verified.

## Decisions that must be settled and reflected in actual operations

1. Approve customer support hours, complaint handling, escalation responsibilities, refund approval authority and timelines. Complaints should be acknowledged within 48 hours and resolved within one month as applicable.
2. Decide preparation/dispatch cutoffs, rescheduling process, unavailable recipient handling and safe cake storage instructions. The code currently uses four 3-hour slots and pincode-based fulfillment, not a verified 5 km geofence.
3. Confirm ingredient, allergen and eggless claims with the actual bakery. Do not promise allergen-free products without a reliable system.
4. Define and implement actual refund approval, provider-refund initiation, status reconciliation and customer notifications. The existing app only captures cancellation requests and manager review/rejection.
5. Confirm raw image/order data retention/deletion controls, subprocessor locations, personal data access/erasure and incident procedure; OTP and sessions have configured expiries but long-lived order/image deletion needs a formal policy and implementation.
6. Confirm FSSAI licensing and GST invoice/legal fields. Sample images/prices must be replaced. Do not activate live checkout merely because these draft pages exist.

## Reference checks (informative; not legal advice)

- Consumer Protection (E-Commerce) Rules, 2020: https://consumeraffairs.nic.in/acts-and-rules/consumer-protection/consumer-protection
- FSSAI licensing: https://fssai.gov.in/business/registration
- MeitY DPDP Rules 2025 and phased implementation: https://www.meity.gov.in/documents/act-and-policies?persona=It-professional

The Digital Personal Data Protection Act and Rules have phased commencements; don't describe every provision as fully in force in October 2026. Re-evaluate the applicable requirements before launch and after implementation deadlines.
