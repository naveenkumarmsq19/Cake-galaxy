# Design Cake – tiered flavour and design-request flow

## Customer journey

1. Open **Create your cake** from the storefront (`/custom`).
2. Choose a flavour price band: **Basic** (listed starting-size cake base price below ₹600), **Standard** (₹600–₹1,000 inclusive), or **Premium** (above ₹1,000). The starting size is the lowest offered weight, normally 0.5 kg. Tiers reflect *flavour cake list-price bands* and do not change when a larger weight is selected.
3. Choose an **active kg-based cake** from that category, then a supported cake weight **at least 1 kg**. The live estimate uses the same shared pricing logic as the normal shop, including the 10% cake-base-price discount at 1 kg and above. The displayed estimate excludes design labour/decorations, delivery, GST if applicable, and optional paid extras.
4. **Upload an actual design reference image** (JPG or PNG, maximum 10 MB). Inspiration gallery images are not submitted instead of a customer reference.
5. Enter occasion, optional budget and notes, required date, eligible delivery pincode and OTP-verified phone, then submit the design enquiry.
6. The server verifies the chosen product, weight, category and owned upload against the database, recomputes the estimate and saves the assigned branch and a **CGC** enquiry reference. An enquiry is **not** an order or a paid checkout.
7. Branch staff review the image, flavour, weight, budget and price estimate in **Admin → Custom requests** and update `requested → reviewing / quoted / closed`. Contact and final quotation remain manual, as before.

## Pricing and catalogue behaviour

- Flavour tiers depend on the cake **starting-size base price**, not the customer budget or the price of the chosen larger size.
- ₹599.99 is Basic; ₹600 and ₹1,000 are Standard; ₹1,000.01 is Premium.
- The 32 cakes approved October 23, 2026 all have half-kg prices from ₹379 to ₹699, so **the Premium category currently has no eligible cakes**. It fills automatically when an active cake has an approved starting-size price above ₹1,000.
- Exact final custom-design labour/material charge must be confirmed by staff. Do not take payment based only on the base-cake estimate.
- The request stores `productId`, `flavourTier`, `weightKg` and `estimatedCakePrice` (paise), in addition to the original contact/design fields. These are computed and validated on the server.
- The API requires an owned image upload for new requests. Existing historical requests and stored statuses remain intact.

## Verification

Run `npm run check` and test: valid Basic/Standard/Premium classification, unavailable categories, 1 kg 10% discount, precise multi-kg price, valid design-image upload, rejected missing/foreign uploads, unserviceable pincode, admin display, and submitted quote review.

This feature branch is based on `fix/ten-percent-discount-from-1kg-20261025` because the inclusive weight-discount update has not yet been merged into `main`.
