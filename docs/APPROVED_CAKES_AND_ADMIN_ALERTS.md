# Cake Galaxy approved 32-cake catalogue — 23 October 2026

User approved 32 specific products and new half-kilogram prices. See `packages/catalog/approvedCakes.js` for authoritative IDs/names/prices. A one-time migration on backend startup enables exactly these 32 and disables every other catalogue item without deleting historic orders, records, or photo galleries. The unique release key prevents reapplying and overwriting future admin changes on every deploy.

Pricing: `price = halfKgPrice × (weightKg / 0.5)`; weights from 0.5 to 20 kg in 0.5 kg increments. Discount: exactly 10% off the **cake base price** at weights **1 kg and above** (inclusive); not on addons or eggless charges. Weight 0.5 kg gets no discount. Previously seeded default descriptions are corrected once without changing admin-edited descriptions.

If photos are absent, the current catalogue image is an illustrative placeholder (not the actual cake). Upload each true gallery under Admin → Products. Previously prepared 10 photo sets can be attached with the ZIP importer, but importing those does NOT change publication status. A list of 32 is user-approved; genuine photos for the other products are still pending.

Admin sound alerts: authenticated branch-scoped `GET /api/admin/orders/attention` polls every 6 seconds for `confirmed` orders with `paymentStatus` paid or test_cod and without a requested cancellation. A repeating Web Audio chime every 12 seconds plays after the admin presses Enable repeating sound. 'Accept Order' uses existing atomic confirmed → preparing transition. When no confirmed orders remain for this admin, the sound stops. Browser must remain open: background throttling and closed tabs mean this is not guaranteed out-of-app push notification.
