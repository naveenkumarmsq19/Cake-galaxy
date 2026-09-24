# Application API contract

All endpoints are under /api on the same HTTPS origin. This document defines the integration contract; it is not a backend implementation.

Use JSON responses with a suitable HTTP status. Error responses use { "message": "Customer-safe explanation" }. Do not send provider secrets or internal stack traces to the browser.

## Session and phone verification

- GET /session returns authenticated, phone (10 digits), and csrfToken.
- POST /auth/otp accepts phone in +91 form. Returns sent: true, requestId and retryAfter only after the SMS provider accepts the request.
- POST /auth/verify accepts requestId and otp. Returns authenticated: true and a fresh csrfToken only after server-side provider verification. Establish a Secure, HttpOnly, SameSite session cookie.
- Bind every OTP challenge to its phone and session. Enforce expiry, attempt limits, resend limits and rate limits by phone and IP. Never trust the client authenticated flag.
- Verify request origin and CSRF tokens for state-changing endpoints. The frontend sends X-CSRF-Token when supplied by GET /session.

## Delivery and uploads

- GET /delivery?pincode=560072 returns available (boolean), deliveryFee (integer paise when available), and optional available dates / slots. Do not expose kitchen or branch assignment. Recheck serviceability and slot capacity during order creation.
- POST /uploads accepts a reference file through multipart FormData and returns id. Require authentication before accepting a checkout upload.
- Restrict to validated JPEG/PNG file content, maximum 10 MB, safe random names, private storage, scan/re-encode uploads, and use signed delivery URLs. Client checks are only convenience validation.
- POST /custom-requests accepts reference, optional sample, occasion, weight, flavour, budget, notes, requiredDate, customPincode and customPhone. Return a reference only after durable storage. Validate contact and uploads, apply rate limits and obtain required consent.

## Checkout

- GET /checkout/config returns paymentsEnabled and public Razorpay keyId.
- POST /checkout/orders accepts items, address, delivery, preferredMethod and optional gst data. A client item includes productId, size, quantity, flavour, eggless, message, addon IDs and an optional uploadId.
- Require a verified phone session. Validate serviceable address, inventory, supported product options, delivery date, cutoff and available slot.
- Compute prices, tax, add-ons and delivery from server-owned data. Never trust browser totals, product prices or a client-claimed payment result.
- Use a stable idempotency key per checkout attempt. Avoid duplicate merchant orders or charges on retries.
- Create and persist the merchant order before requesting a Razorpay order. Return orderId (Razorpay), reference (merchant), amount (integer paise), currency: INR.
- The public key ID belongs in the frontend response. The Razorpay key secret belongs only on the backend.

## Payment verification

POST /checkout/verify accepts reference, razorpay_order_id, razorpay_payment_id and razorpay_signature.

1. Authenticate the user and verify that the merchant order belongs to the session.
2. Load the provider order ID and expected amount from the database, not client assertions.
3. Verify the signature server-side using the stored provider order ID, payment ID and secret.
4. Confirm the provider payment's order, amount, currency and captured status.
5. Update the merchant order idempotently and trigger fulfilment once.
6. Return status: paid and an order only after verification. Pending or merely authorised payments must not be presented as paid.

Use authenticated Razorpay webhooks for reconciliation, including payment.captured and order.paid as appropriate. Verify webhook signatures against the raw request body and process events idempotently. The browser callback alone is not a reliable record of payment.

Send WhatsApp confirmation only from the backend after order confirmation and customer consent. Set whatsappSent: true only when the provider accepted the message; it must not imply delivery or reading.

Official integration reference:
https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/

## Orders

- GET /orders returns { orders: [...] }, limited to the authenticated customer's orders.
- Order shape: reference, amount (paise), status (confirmed/preparing/dispatched/delivered), statusLabel, paymentStatus, deliveryLabel and whatsappSent.
- GET /orders/:reference/invoice returns application/pdf only for an authorised customer's issued invoice. Include merchant-approved tax and billing details.
- POST /orders/:reference/cancellation accepts a reason and returns requestId after the request is durably recorded. Apply the approved eligibility rules on the server. A request is not automatically a refund.

## Before accepting real orders

Configure the business domain and HTTPS, provider credentials, rate limits, session security, durable order and upload storage, approved product and tax data, delivery rules, refunds and legal policies. Complete provider test payments, failure/cancellation/pending-payment tests, webhook reconciliation and customer notification tests before enabling live keys.
