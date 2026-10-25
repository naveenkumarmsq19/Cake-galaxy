# Design Cake – admin-only final quotation

## Customer journey

1. Open **Create your cake** (`/custom`).
2. Select **Basic**, **Standard** or **Premium** flavour tier, choose an available active kg-based cake, then a supported weight of at least 1 kg. Tier names are displayed without prices.
3. Upload a required customer **design reference image** (JPG/PNG, max 10 MB).
4. Enter occasion, optional design notes, required date, eligible delivery pincode, and OTP-verified phone.
5. Submit the **Design Cake request**. Customer receives only a `CGC...` reference and a message that the bakery will contact them with pricing.

There is **no budget field, product price, estimated price, discount amount or price-tier numeric range visible on the Design Cake customer page**. There is no auto-priced custom cake checkout or automatic payment. The ordinary cake shop and its existing 1 kg+ 10% discount are unchanged.

## Admin quotation

1. Go to **Admin → Custom requests**, select the assigned-branch request and review its uploaded design, flavour, weight, date, notes and **internal cake base estimate**.
2. Enter the **final quoted price in INR**, optionally add inclusions/exclusions, and click **Save final quote · Mark Quoted**.
3. The server checks that the request is visible to the authenticated branch admin and that the quoted price is a valid integer amount in paise between ₹1 and ₹10,00,000. The saved request stores `quotedPrice` (paise), `quoteNotes`, `quotedAt`, `quotedBy` and `status: "quoted"`.
4. The admin can **copy a quote message** and share it through their own customer communication channel. **No SMS/WhatsApp is sent automatically**, no payment link is created, and saving a quote is not a paid order. Admin may revise the quote or mark a request reviewing/closed later.

## Technical details

- Tier classification remains internal, determined from each active cake's listed starting-size base price: Basic below ₹600, Standard ₹600–₹1,000 inclusive, Premium above ₹1,000. Currently 25 approved Basic, 7 Standard, no Premium.
- The server still computes an **internal-only** `estimatedCakePrice` from the selected flavour and kg; customer submissions cannot set this or `quotedPrice`.
- The custom request POST ignores a legacy/client-supplied `budget`, and does not return any price to the customer. Historical requests may retain old `budget` data in MongoDB, but no UI reads or displays it.
- The quote is chosen solely by the admin after design review. It is not bound automatically to the internal estimate.
- Existing customer session/OTP, image ownership, supported pincode, branch assignment and request status workflows are preserved.

## Verification

Run `npm run check` and verify customer UI has no price or budget, customer API response contains only the reference, admin quote endpoint requires auth and CSRF, rejects missing/invalid quote amounts, permits admin revisions, and preserves branch scoping. Production deployment must be verified separately after merge.
