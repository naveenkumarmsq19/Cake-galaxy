# Customer API

The Express service lives in `apps/api`. Routes are under `/api`. Responses return JSON; errors use `{ "error": "customer-facing message" }`. `Session` is a server-stored random HttpOnly cookie, and authenticated writes require the `X-CSRF-Token` returned by the session or OTP verification route. Configure `WEB_ORIGIN` to the exact storefront origin; browser requests send cookies with `credentials: include`.

| Method and route | Behavior |
| --- | --- |
| `GET /health` | Health response; database connection is checked during startup. |
| `GET /catalog` | Active products and addon options, with no branch allocation. |
| `GET /delivery?pincode=` | Serviceability and delivery fee in paise. |
| `GET /session` | Auth state, verified phone and CSRF token. |
| `POST /auth/otp` | Request a six-digit SMS code, with per-IP/per-number rate limits. |
| `POST /auth/verify` | Validate provider OTP and issue a one-use session. |
| `POST /auth/logout` | Clear server session and cookie. |
| `POST /uploads` | Private photo/design upload to GridFS, max 10 MB JPG/PNG, re-encoded with Sharp. |
| `POST /custom-requests` | Store design reference and request after verifying phone, image and delivery pincode. |
| `GET /checkout/config` | Whether real checkout is enabled and the public Razorpay key ID. |
| `POST /checkout/orders` | Validate owned uploads, product options, pincode, GST details, date/slot and calculate totals on the server; persist order and create provider order. Requires a UUID `idempotencyKey`. |
| `POST /checkout/verify` | Verify signature against stored order ID and fetch the payment to confirm captured status, order, amount and INR currency. |
| `POST /webhooks/razorpay` | Verify raw-body webhook signature and reconcile `payment.captured`. Set its secret in the Razorpay dashboard. |
| `GET /orders` | Recent orders for verified customer only. |
| `GET /orders/:reference` | One owned order. |
| `GET /orders/:reference/invoice` | Paid order PDF with merchant GST details. |
| `POST /orders/:reference/cancellation` | Record a request for review; no automated refund. |

Checkout is disabled unless Razorpay keys, valid merchant GSTIN/legal name, a tax rate and both business approval flags are present. No browser field can mark an order paid. WhatsApp order messages are optional, require customer consent and are sent only after payment capture. Notifications report provider acceptance, not delivery to the handset.

Database documents include customers, sessions, login challenges, products, private service areas, uploads, custom design requests and orders. The first startup seeds illustrative catalogue products and any `SERVICEABLE_PINCODES` from the environment if the collections are empty. Edit product and service records in the database after approval; a merchant administration screen is out of scope for this customer release.

For production, configure HTTPS, same-site app/API domains, secure cookies, MongoDB backups, provider keys and signed webhook. Confirm cancellation rules, GST treatment, slots, photos and policies with the merchant before changing approval flags. The supplied UI and provider adapters have local tests, but live OTP/payment/provider behavior needs test credentials and end-to-end checks in that merchant environment.
