# Borzo courier booking on admin acceptance (feature-gated)

This change integrates Borzo Business API 1.8 into the existing Cake Galaxy order lifecycle.

**Trigger:** only the authenticated, CSRF-protected admin PATCH of
`/api/admin/orders/:reference/status` from `confirmed` to `preparing`.
A customer placing a COD order or paying online does NOT book a courier.
`BORZO_ENABLED=false` by default. Existing order flow works unchanged.

## Setup (test first)

1. Rotate the token if it has appeared in screenshots or public chat; copy the **new**
   test API token from the Borzo test cabinet to your **backend-only** env.
2. Configure the **actual pickup branch** in Cake Galaxy Admin > Branches.
   The current seed examples are Peenya (BR01) and Nagasandra (BR02); **do not**
   assume they are the correct Cake Galaxy Nagarbhavi pickup location.
   Choose the correct active branch and confirm its street address and service-area mapping.
3. Add these variables to Render backend secrets:

   ```env
   BORZO_ENABLED=false
   BORZO_ENV=test
   BORZO_API_TOKEN=<rotated-test-token>
   BORZO_CALLBACK_SECRET=<secret-from-borzo-cabinet>
   BORZO_PICKUP_PHONE=<your-real-10-digit-pickup-phone>
   BORZO_APPROVED_BRANCH_CODES=<verified-code-from-branch-record>
   BORZO_PAYMENT_METHOD=balance
   BORZO_MAX_COST_PAISE=15000
   BORZO_COD_ENABLED=false
   BORZO_ALLOW_TEST_ORDERS=false
   BORZO_THERMOBOX_ENABLED=false
   ```

   `BORZO_MAX_COST_PAISE` is **paise** and is a safety ceiling for provider
   quotes; choose a limit that reflects Cake Galaxy's actual delivery pricing.
   `BORZO_PAYMENT_METHOD` controls paying the **courier**, not the customer's
   Cake Galaxy payment method. `balance` requires funded Borzo balance; `cash`
   or `bank_card` have separate operational implications.

4. In the **test** Borzo cabinet > Integration, set Callback URL to
   `https://<your-render-backend-host>/api/webhooks/borzo`. Configure the
   callback secret in the cabinet, put the exact secret in
   `BORZO_CALLBACK_SECRET`, and enable order and delivery callbacks.
5. Set `BORZO_ALLOW_TEST_ORDERS=true` and **then** `BORZO_ENABLED=true`
   for a controlled test order in the test environment only. Use Cake Galaxy
   test COD as needed, but keep `BORZO_COD_ENABLED=false` until Borzo explicitly
   activates merchant cash collection, fees and settlement.
6. Log in as an admin; click **Accept Order** once. Check Admin > Orders for
   `Borzo: Courier booked` with provider ID and inspect the Borzo test cabinet.
   Check delivery callbacks and confirm that My Orders only exposes real tracking
   links after Borzo provides them. Turn `BORZO_ENABLED=false` again until
   production credentials and the courier operational process are approved.

## How it works

* The selected Order's `branchId` determines the pickup address.
  `BORZO_APPROVED_BRANCH_CODES` is an explicit allowlist so wrong seed addresses
  cannot silently be booked.
* The chosen delivery slot stays intact. Pickup is scheduled 90–30 minutes
  before slot start. Borzo's schedule constraints may reject that timing;
  such cases are flagged for manual dispatch, not ignored.
* The backend makes `calculate-order` then `create-order`, with the
  checkout reference in `client_order_id` and a configurable cost cap.
* Only the backend holds the Borzo token; `X-DV-Auth-Token` is sent to Borzo.
  Callbacks use the **raw body**, verified against HMAC-SHA256
  `X-DV-Signature`. Never use browser-side API credentials.
* An atomic MongoDB claim allows **one automatic booking attempt per order**.
  A create-order timeout, ambiguous server error or malformed success is marked
  `needs_review`, **never automatically retried**: first reconcile by order
  reference / delivery details in Borzo to avoid a second courier booking.
* A provider quote above `BORZO_MAX_COST_PAISE`, missing branch info or
  bad delivery timing marks the attempt `failed`. In this version automatic
  retry is deliberately disabled; use a manual courier and investigate.
* Borzo callbacks update courier state and tracking only. They **do not**
  mark Cake Galaxy payments paid, and do not silently mark a Cake Galaxy
  order delivered.
* COD-specific `taking_amount` is only sent if
  `BORZO_COD_ENABLED=true`; until merchant COD settlement has been verified,
  **keep this false**. Existing Cake Galaxy COD collection confirmation
  remains manual and must only be used with actual payment proof.

## Current limitations and safe rollout

* Borzo cancellation is **not yet automatically coupled** to Cake Galaxy
  cancellation/refund. Approval of cancellation or branch reassignment is
  blocked while Borzo state is booked / booking / needs_review. Reconcile or
  cancel the courier with Borzo staff before carrying out the customer
  cancellation manually; do not refund assuming the courier has stopped.
* Booking happens synchronously during admin acceptance; the provider may take
  several seconds. Booking failure does not roll back admin acceptance; status
  remains `preparing` with a visible error and a manual fulfillment path.
* This version does not schedule an order for a different pickup time if Borzo
  rejects the selected window. The configured slots/pickup lead time require
  an actual test with Cake Galaxy's preparation workflow.
* Borzo test credentials cannot be used in production. After successful tests,
  request **production Business API access** from Borzo, rotate/configure new
  production credentials, verify cost, COD, pickup address, callback signature
  and enable `BORZO_ENV=production` only when ready.
* A 3–5 kg cake can fit in the documented weight limit but may not fit safely
  on a motorbike by dimension; validate box dimensions and packaging. No
  automatic multi-vehicle allocation is implemented.

API documentation: https://borzodelivery.com/in/business-api/doc
