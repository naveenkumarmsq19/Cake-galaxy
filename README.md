# Cake Galaxy

Cake Galaxy customer storefront. The web app uses Next.js App Router and React; the API uses Express, Node.js and MongoDB. The UI has a light sage palette and a compact image banner on mobile. Business data, OTP, payments and notifications stay on the server.

## Project structure

| Path | Purpose |
| --- | --- |
| `apps/web` | Next.js customer website and responsive screens |
| `apps/api` | Express API, MongoDB models, OTP, uploads, orders, Razorpay, invoices |
| `packages/catalog` | Seed products and shared display pricing |
| `docs/API.md` | API routes, setup and deployment considerations |

Customer routes: home, catalogue/search, product options and photo cake upload, custom cake samples and design request, bag, delivery details with inline sender phone verification, checkout, confirmation, orders, help and policies. The sender owns the order and receives optional WhatsApp updates; recipient details are stored separately for delivery. The chatbot answers common questions using local rules. Offers/coupons, public branch details and live rider tracking are not part of this scope. The private operations panel is at `/admin`.

## Local development

Requires Node.js 22+, npm and a reachable MongoDB instance. In the repository root:

```sh
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
npm run dev
```

Open `http://localhost:3000` (API on `http://localhost:4000`). The sample API config enables a development OTP only outside production; its code appears in the API terminal. Do not enable real checkout until products, prices, policies, business tax information, service areas and provider accounts are configured. The sample catalogue contains illustrative images, names and prices, not confirmed merchant inventory.

On Windows PowerShell, create the same files from the repository root:

```powershell
Copy-Item .\apps\api\.env.example .\apps\api\.env
Copy-Item .\apps\web\.env.example .\apps\web\.env.local
npm run dev
```

`apps/api/.env` contains `MONGODB_URI=mongodb://127.0.0.1:27017/cake_galaxy` as a local example. A MongoDB server must actually be running at that address. If you use a hosted MongoDB database, replace this value with its connection string. The API loads `apps/api/.env` even if you start Node from the repository root. Never commit real connection strings or provider keys.

```sh
npm run check
```

This runs API validation/signature/HTTP tests and the production Next.js build. The full MongoDB and real provider flows require a configured database, verified provider sandbox credentials and an end-to-end checkout test. No provider credentials are stored in the repository.

## Business setup

1. Set `ADMIN_BOOTSTRAP_EMAIL` and a unique 12–128 character `ADMIN_BOOTSTRAP_PASSWORD` in the API environment, start the API once, then remove both variables and restart. On Render, set these in the API service's Environment page (not the web service); redeploy, wait for `Initial Super Admin created` in the log, then remove them. A missing or weak bootstrap password leaves the customer API running but does not create an admin. Sign in at `/admin` on the web domain. Create Branch Managers there; they see only their own branch orders and custom requests. Super Admin can view and manage all branches, managers, products and service mappings.
   Bootstrap variables never change an existing Super Admin. To replace a lost or exposed password, connect the local API `.env` to the same MongoDB database and run `npm run admin:reset -w @cake-galaxy/api` in an interactive terminal. Confirm the existing admin email and enter the new password when prompted. The command signs out existing admin sessions. Remove the bootstrap variables from Render afterward.
2. Branches BR01 (Peenya, 560058) and BR02 (Nagasandra, 560073) are created inactive with their own base pincode mappings. Branch 3 was not added because the supplied address duplicated Branch 2. Confirm its actual address before creating it in the panel. Activate branches and map verified 6-digit service pincodes under Coverage. Each pincode maps to exactly one branch; orders and custom requests save the assigned branch at creation. Old service area rows without a branch mapping are unavailable at checkout. Do not infer all covered pincodes from a 5 km radius: a pincode spans an area and exact distance needs a verified delivery address/map location. `radiusKm: 5` records the operating rule, while actual fulfillment currently uses the approved pincode list.
   On API startup, each branch's base pincode gets a mapping if that pincode does not already have one. Existing mappings, including paused ones, are preserved. A newly created branch still needs to be activated before its base pincode becomes serviceable.
3. Replace the starter `Product` documents with approved cake photos, names, sizes and prices. Super Admin can edit individual products in the panel. Current pricing scales the catalogue base price proportionally by weight; eggless costs an extra ₹50 per 500 g (₹100 per kg), and a 10% discount applies to the cake base price of each kg-based cake weighing 1 kg or more (but not to eggless charges or add-ons). The earlier PDF workbook uses exact pastry/small/medium prices and missing size weights; a dedicated variant pricing importer is needed before it can be imported without changing amounts. Replace the starter copy in `apps/web/src/screens/Info.jsx` with approved terms, privacy and cancellation/refund text.
4. Supply the merchant's **actual** legal/trading identity, then configure invoicing correctly. GST-registered merchants use `MERCHANT_GST_REGISTERED=true`, their real `MERCHANT_GSTIN` and proper `GST_RATE_PERCENT` for GST tax invoices. For legitimately non-GST-registered merchants use `MERCHANT_GST_REGISTERED=false`, a blank `MERCHANT_GSTIN`, and `GST_RATE_PERCENT=0`; a payment receipt (not a GST invoice) is generated after successful payment. Do not use false GST registration details. Confirm tax registration obligations with an accountant; a payment gateway's no-GST onboarding option does not override tax law.
5. For WhatsApp-only customer login, set `CUSTOMER_OTP_CHANNEL=whatsapp` on the Render API service, `MSG91_AUTH_KEY` to a **private** live MSG91 authkey, `MSG91_WHATSAPP_NUMBER` to the connected sender number including 91 (digits only), `MSG91_WHATSAPP_OTP_TEMPLATE_NAME` to the actual approved **Authentication** Copy Code OTP template name, and `MSG91_WHATSAPP_OTP_TEMPLATE_LANGUAGE=en`. Optional: `MSG91_WHATSAPP_OTP_TEMPLATE_NAMESPACE` if MSG91 supplies/requires it. The OTP is sent as both `body_1` and `button_1`. The separate `MSG91_WHATSAPP_TEMPLATE_NAME` is exclusively for order updates and may stay unset. The older `MSG91_SMS_OTP_TEMPLATE_ID` must not cause SMS fallback when `CUSTOMER_OTP_CHANNEL=whatsapp`. MSG91 can queue a request even if delivery later fails; check WhatsApp delivery reports/logs. If Meta has not enabled Authentication templates for this WABA, code changes cannot bypass that restriction.
6. Configure Razorpay keys and a webhook secret. Test captured, pending, failed and duplicate callbacks in the provider test environment.
7. Set `CATALOG_APPROVED=true` and `POLICIES_APPROVED=true` only after approved catalogue and policies are in place. Checkout remains disabled without these approvals, valid GST **or non-GST receipt** settings, and live-ready Razorpay keys/webhook. Enabling the website toggle does not itself activate Razorpay's merchant account.

See `apps/api/.env.example` for server variables and `apps/web/.env.example` for public build-time business identity and support contact values. Policy draft pages and launch approvals are documented in `docs/POLICIES_TO_APPROVE.md`. Keep `POLICIES_APPROVED=false` until operator and legal review is complete. `.env` files are ignored by Git.

## Deployment

Deploy `apps/web` on Cloudflare Pages with build-time `NEXT_PUBLIC_API_URL=/api`, then rebuild. The Pages Function under `functions/api/[[path]].js` forwards `/api/*` to the Render API through the website's origin so browser sessions remain first-party. A copy also exists under `apps/web/functions` for Pages projects whose root directory is `apps/web`. The static output includes `_routes.json` to invoke the Function only for `/api/*`. Deploy `apps/api` on Render with MongoDB and provider secrets. Set `WEB_ORIGIN` to the exact public website origin, or set `WEB_ORIGINS` to a comma-separated list of the Pages and custom-domain origins (no paths, no `/admin`, no trailing slash). `WEB_ORIGINS` overrides `WEB_ORIGIN`. Set `NODE_ENV=production` and `COOKIE_SECURE=true`. Check both Render `/api/health` and the Pages website `/api/health` return `{ "ok": true }`. Configure the merchant domain, provider webhooks at the Render `/api/webhooks/razorpay` endpoint and database backups. Use the real provider test environment before live keys.

The Next.js app can also produce a static preview with `CAKE_STATIC_EXPORT=1 npm run build -w @cake-galaxy/web`; files are generated in `apps/web/out`. In the preview, shoppers can enter a pincode on a product, add it to their bag, fill their address and review checkout. If the API is offline, the pincode is saved as unverified and payment stays disabled. A static preview does not host Express or MongoDB. Real checkout requires a separately reachable API, correct CORS and cookie settings, service areas and live merchant credentials; the API rechecks the delivery area and total before creating a payment order.

## Image credits

The bundled photographs are design references. Replace them with the merchant's approved product photographs before launch. Sources: [chocolate](https://images.unsplash.com/photo-1578985545062-69928b1d9587), [celebration](https://images.unsplash.com/photo-1558301211-0d8c8ddee6ec), [floral](https://images.unsplash.com/photo-1562777717-dc6984f65a63), [rainbow](https://images.unsplash.com/photo-1464349095431-e9a21285b5f3), [custom](https://images.unsplash.com/photo-1535141192574-5d4897c12636), [cupcakes](https://images.unsplash.com/photo-1587668178277-295251f900ce). The sage celebration banner is a bundled original visual.

### Live Cash on Delivery (COD)

The checkout offers **Pay online** and **Cash on Delivery** when their respective server-side readiness checks pass. COD never calls Razorpay and is available only for active service-area pincodes and verified customer accounts. The normal delivery fee and configured tax are still included.

To activate COD, review the merchant's legal identity, tax/receipt settings, catalogue, and public policies, then set `COD_ENABLED=true` **on the Render API service** and redeploy. `CATALOG_APPROVED=true` and `POLICIES_APPROVED=true` must be approved separately. Without that configuration, COD remains safely disabled. To turn it off, set `COD_ENABLED=false` and redeploy; existing COD orders remain visible.

New COD orders start `status=confirmed` and `paymentStatus=cod_pending`; staff receive the existing new-order alert, can accept and prepare orders, and must explicitly confirm **cash received** when marking the order delivered. That final action atomically sets `paymentStatus=cod_paid` and records the collector/time. A receipt becomes available only after collection. A COD cancellation before collection requires staff review but has no Razorpay refund. Do not confirm collection unless cash was actually received; there is no automated cash reconciliation or courier collection integration.

### Temporary customer checkout test

For an end-to-end customer and branch workflow test before payment activation, set these **Render API environment variables** and redeploy:

- `TEST_MODE_ENABLED=true`
- `TEST_PHONE=` the one 10-digit mobile number used as the sender
- `TEST_OTP_CODE=` a private six-digit code of your choosing

Use that number in Delivery details. The code is entered on the website; no SMS is sent to the test number. The checkout then offers **Cash on delivery · Test only**, including when Razorpay is not configured. It creates a `CGT...` order mapped to the service area branch, visible to that branch's manager and the Super Admin. Staff can progress its status. The order is marked as a test, does not collect money, call Razorpay, send WhatsApp, create a GST invoice, or count as paid revenue. Other phones have no test COD option and retain the normal MSG91 and Razorpay flow. A serviceable pincode and active branch mapping are still required. The website must use `NEXT_PUBLIC_API_URL=/api` for the first-party session cookie.

After testing, change `TEST_MODE_ENABLED=false`, redeploy, and remove `TEST_PHONE` and `TEST_OTP_CODE` from Render. Do not commit the code or phone to the repository. Existing test orders remain marked as tests for audit purposes.

### Test Cake Galaxy WhatsApp OTP

1. On Render **API service** (never the public Next.js frontend), enter the WhatsApp environment variables above, then save/deploy. Do not paste provider keys into GitHub or screenshots. Rotate any authkey that was previously exposed.
2. In MSG91, ensure the exact template name is **Authentication / Approved** and tied to the integrated sender. Test using a **personal WhatsApp account**, not a WhatsApp Business recipient.
3. Use a mobile number other than the configured `TEST_PHONE` on https://cakegalaxy.in to request a WhatsApp OTP; enter the actual six-digit code within five minutes. `TEST_MODE_ENABLED=true` continues to bypass delivery **only for `TEST_PHONE`**, useful for testing the checkout without using message credits.
4. If the app reports a send failure, check Render runtime logs (without exposing keys), MSG91 WhatsApp **API Failed Logs** and **Logs**, and the template status. A queued result confirms MSG91 accepted the API call, **not** WhatsApp delivery. Do not use test OTPs for real customer accounts.
5. The provider request/response validation is covered by `apps/api/test/msg91-whatsapp-otp.test.js`. Run `npm run check` before releasing.

### Customer cancellation, store approval and refunds

- Customers open **My orders**, select a cancellation category and supply a reason of at least 10 characters. A request is only possible for a paid/test order that is not already delivered/cancelled; duplicate requests are rejected. Customer sees **Awaiting store review**, **Approved** or **Declined** with the store's response.
- A Super Admin opens **/admin → Orders**, reviews the submitted reason, and explicitly **Approves** or **Declines** (with a written reason). Approved orders are cancelled and no longer move through delivery. A cancelled test order requires no refund.
- For a genuine paid order, approval alone does **not** move money. Super Admin must separately click **Issue full refund**, confirm the amount, then the backend calls Razorpay's normal refund endpoint with a stable, persisted `X-Refund-Idempotency` value. API may return pending: never represent a pending refund as processed. The store can click **Refresh refund status** to reconcile with Razorpay.
- Subscribe the existing verified Razorpay webhook URL `/api/webhooks/razorpay` to `refund.processed` and `refund.failed` alongside capture events. Match refund ID/payment ID/amount before updating the order. A failed/uncertain refund requires inspection in Razorpay before any manual intervention. Normal refunds may take several business days.
- Existing kg-based cake pricing adds ₹50 for each 500g of eggless cake (500g ₹50, 1kg ₹100, 1.5kg ₹150, 2kg ₹200). This remains per cake and is not included in the cake-only percentage discount.

### ImageKit product photos

After uploading and verifying the **198 deduplicated WebP images** for 30 owner-supplied product galleries under `/cake-galaxy/products/<approved-product-id>/image-XX.webp` in ImageKit account `yh2bfhc93`, set `IMAGEKIT_GALLERIES_ENABLED=true` on the **Render API service**, save/deploy. The catalogue endpoint then returns `https://ik.imagekit.io/yh2bfhc93/...` photos for cards, product pages and gallery thumbnails. Default is **off**, so no broken ImageKit URLs appear before upload. The two products lacking matching photo ZIPs retain their current photos. The ImageKit private API key must remain in the operator's local upload process, never GitHub, Cloudflare, browsers or logs. Upload-ready package `Cake_Galaxy_ImageKit_Verified_198.zip` includes 198 unique WebP files, `gallery-manifest.json`, the uploader, CDN availability checker and instructions. Re-running the upload uses stable filenames. The website API itself uses **public CDN URLs only**; no ImageKit private key is required on Render.
