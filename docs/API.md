# Customer API

The Express service lives in `apps/api`. Routes are under `/api`. Responses return JSON; errors use `{ "error": "customer-facing message" }`. `Session` is a server-stored random HttpOnly cookie, and authenticated writes require the `X-CSRF-Token` returned by the session or OTP verification route. Configure `WEB_ORIGIN` to the exact storefront origin; browser requests send cookies with `credentials: include`.

| Method and route | Behavior |
| --- | --- |
| `GET /health` | Health response; database connection is checked during startup. |
| `GET /catalog` | Active products and addon options, with no branch allocation. |
| `GET /delivery?pincode=` | Serviceability and delivery fee in paise for a pincode mapped to an active branch. Branch details remain private. |
| `GET /session` | Auth state, verified phone and CSRF token. |
| `POST /auth/otp` | Request a six-digit SMS code, with per-IP/per-number rate limits. |
| `POST /auth/verify` | Validate provider OTP and issue a one-use session. |
| `POST /auth/logout` | Clear server session and cookie. |
| `POST /uploads` | Private photo/design upload to GridFS, max 10 MB JPG/PNG, re-encoded with Sharp. |
| `POST /custom-requests` | Store design reference and request after verifying phone, image and delivery pincode. |
| `GET /checkout/config` | Whether real checkout is enabled and the public Razorpay key ID. |
| `POST /checkout/orders` | Validate owned uploads, product options, active branch mapping, GST details, date/slot and calculate totals on the server; persist assigned branch and create provider order. Requires a UUID `idempotencyKey`. |
| `POST /checkout/verify` | Verify signature against stored order ID and fetch the payment to confirm captured status, order, amount and INR currency. |
| `POST /webhooks/razorpay` | Verify raw-body webhook signature and reconcile `payment.captured`. Set its secret in the Razorpay dashboard. |
| `GET /orders` | Recent orders for verified customer only. |
| `GET /orders/:reference` | One owned order. |
| `GET /orders/:reference/invoice` | Paid order PDF with merchant GST details. |
| `POST /orders/:reference/cancellation` | Record a request for review; no automated refund. |

Checkout is disabled unless Razorpay keys, valid merchant GSTIN/legal name, a tax rate and both business approval flags are present. No browser field can mark an order paid. WhatsApp order messages are optional, require customer consent and are sent only after payment capture. Notifications report provider acceptance, not delivery to the handset.

## Operations API

The separate `/api/admin` namespace uses a server stored, seven day HttpOnly session cookie and requires `X-CSRF-Token` on every authenticated write. The first Super Admin is created by one-time `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` environment variables. Remove both variables after the first successful start. Login is rate limited. Every branch-scoped query uses the signed-in manager's branch ID on the server, not a submitted client filter.

| Method and route | Access and behavior |
| --- | --- |
| `POST /admin/login`, `GET /admin/me`, `POST /admin/logout` | Admin sign in, session refresh, sign out. |
| `GET /admin/summary`, `GET /admin/orders`, `PATCH /admin/orders/:reference/status` | All branches for Super Admin; own branch for Branch Manager. Paid orders progress confirmed → preparing → out_for_delivery → delivered. |
| `POST /admin/orders/:reference/reassign` | Super Admin only. Active destination branch and a required reason; change and audit entry are saved together. This is an explicit override when coverage changes. |
| `POST /admin/orders/:reference/cancellation-rejection` | Super Admin only. Reject a cancellation request with a recorded reason. Approved refunds must be settled and reconciled in Razorpay separately. |
| `GET /admin/custom-requests`, `PATCH /admin/custom-requests/:reference`, `GET /admin/uploads/:id` | Branch-scoped enquiries and owned design images. |
| `GET /admin/branches`, `POST /admin/branches`, `PATCH /admin/branches/:id` | Super Admin creates/updates branches; Branch Manager sees their branch only. Branches start inactive. |
| `GET /admin/service-areas`, `PUT /admin/service-areas/:pincode`, `DELETE /admin/service-areas/:pincode` | Super Admin assigns/pauses one pincode per branch; Branch Manager can view only their own mappings. Pausing preserves order history. |
| `GET /admin/managers`, `POST /admin/managers`, `PATCH /admin/managers/:id` | Super Admin creates managers, changes branch/access, resets password; changes revoke sessions. |
| `GET /admin/products`, `POST /admin/products`, `PATCH /admin/products/:id` | Super Admin edits catalogue, manager has read only access. New products start hidden. |

Two known branches (560058 and 560073) are seeded inactive. No customer-facing branch names or addresses are returned. The third supplied branch address duplicates the second and is intentionally not seeded. Existing unassigned service-area rows are not serviceable until mapped. Pincode assignment is deterministic and auto applied to orders, while exact 5 km geofencing needs verified branch/customer coordinates and is not implemented from a pincode alone. Cancellation requests appear on orders; refund processing remains in Razorpay until an approved refund workflow is connected.

For production, configure HTTPS, same-site app/API domains, secure cookies, MongoDB backups, provider keys and signed webhook. Confirm cancellation rules, GST treatment, slots, photos and policies with the merchant before changing approval flags. The supplied UI and provider adapters have local tests, but live OTP/payment/provider behavior needs test credentials and end-to-end checks in that merchant environment.
