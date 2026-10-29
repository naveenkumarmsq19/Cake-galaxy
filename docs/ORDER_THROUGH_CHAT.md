# Order through Chat — customer flow

This feature embeds the Cake Galaxy ordering process in the existing English-language chatbot. It does not require a second checkout backend, another LLM, or a paid inference service. Its core flow works when Workers AI is not bound.

## Customer journey

1. Select a regular cake from the chatbot catalogue and press **Add to bag**.
2. Press **Order through Chat** in the bot response or quick actions.
3. Enter a six-digit pincode; the bot checks `GET /api/delivery?pincode=` against **active** delivery branches.
4. Choose a delivery date and allowed time slot in Asia/Kolkata. The backend verifies this again on order submission.
5. Enter a verified customer phone using the existing `PhoneVerification` component. The OTP is only entered into the verification form; it never goes to the LLM.
6. Enter the sender name and recipient phone, name, address, and optional WhatsApp consent in the chat window.
7. Review the actual catalogue subtotal, service-area delivery fee, tax and payable total. Choose an enabled payment method and accept terms/cancellation policy explicitly.
8. Press the final confirmation button:
   - **COD**: `POST /api/checkout/orders` with a unique idempotency key and `preferredMethod=cod`; the server checks authentication, CSRF, valid options, size, discount, serviceability, tax, delivery slot and active readiness, then creates the order.
   - **Online payment**: prepare the order with the same API and open the existing Razorpay secure checkout modal inside the website. Only `POST /api/checkout/verify` plus server payment verification confirms payment.
   - **Test COD**: offered only if the backend verifies that the signed-in phone is an authorized test user; clearly marked as test and no money collected.
9. Display a server-returned reference in the chat on confirmation and offer **My Orders**.

No chat message alone places or pays for an order. The customer must press an explicit confirmation button. Failed requests with ambiguous submission status direct the customer to **My Orders**, avoiding accidental duplicate orders.

## Safety

- AI normalization remains limited to the ordinary, pre-checkout shopping chat. No OTP, address, phone, invoice, or payment details are sent to the LLM. The checkout wizard only uses authenticated existing Cake Galaxy APIs.
- Orders require an OTP-verified HttpOnly cookie session and the current CSRF token on each authenticated write.
- Idempotency keys are reused for retried submissions with identical basket and checkout details, mitigating duplicate orders.
- Backend recalculates payable amount and verifies product, branch, date and allowed payment method. Client also rejects unexpected totals.
- Custom cake quotes require staff review; photo cakes must already have a valid authorized image upload.
- Checkout is unavailable when the backend business approval flags or payment providers are unconfigured.
- The order wizard collects recipient details only in browser memory and saves the same existing checkout data in session storage for recovery by the normal flow. The chatbot message list does not contain this PII.
- The chat-only form currently does not offer a map pin selector; map pin remains optional in the backend. If pin collection is mandatory for the business, add this before rollout.

## Limits and operations

Order through Chat is a guided in-chat form/wizard, not free-form natural-language collection of addresses or OTPs. That keeps sensitive details out of AI prompts and preserves deterministic validation. Manual QA using a configured OTP provider, authorized test phone, enabled delivery area and checkout settings is necessary before production customer orders. The CI tests do not prove end-to-end payment/provider availability.

```sh
npm ci
npm run test:chat -w @cake-galaxy/web
npm run check
CAKE_STATIC_EXPORT=1 npm run build -w @cake-galaxy/web
```

Recommended manual cases: unavailable pincode, elapsed same-day slot, wrong OTP, expired session, malformed recipient phone, stale catalogue/eggless option, tax or delivery-fee change, duplicate submit, COD disabled, failed Razorpay payment, successful test COD, resumed order from My Orders, and safe fallback when Workers AI quota is exhausted.
