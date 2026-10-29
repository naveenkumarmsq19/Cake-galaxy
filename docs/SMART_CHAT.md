# Cake Galaxy Smart Sales Assistant (feature branch)

## Scope

English-only customer-facing assistant with typo tolerance, Romanized-Tamil normalization when an AI binding exists, real catalogue products, server-aligned cake-unit prices, confirmed add-to-bag actions, six-digit pincode validation, My Orders / Custom Cakes handoff, and existing OTP-authenticated checkout.

This is a safe customer-facing **shopping helper**, not an autonomous payment processor or a newly trained Tiny-LLM. No orders are submitted directly by the bot. Customers must review the bag, enter/verify OTP in the existing flow, confirm delivery, agree to policies, and complete COD/online checkout.

## Deployment

The chatbot displays without any external model configuration and uses a limited local fallback. For proper language understanding, set up Cloudflare Workers AI:

1. Open Cloudflare dashboard → Workers & Pages → **the Cake Galaxy Pages project** → Settings → Bindings.
2. Add **Workers AI** binding with the exact variable name **AI** for Production and optionally Preview.
3. Redeploy Pages so `context.env.AI` is available to `functions/api/assistant.js`.
4. Ensure your static export includes `_routes.json` with `/api/*` (already present). If Pages root is `apps/web`, use the duplicate `apps/web/functions/api/assistant.js`.
5. Set Cloudflare WAF / bot protection / rate limiting for `/api/assistant` to prevent abuse or free-tier quota depletion. The endpoint restricts size and same-origin requests, but Origin alone is not proof of a human user. A stricter Turnstile-based verification flow can be added if necessary.
6. Test in Preview before merging into `main`; keep API/Pages configuration and checkout secrets private.

Workers AI model: `@cf/meta/llama-3.1-8b-instruct`. Usage is **not guaranteed unlimited free**; free daily neuron limits apply and can change. If AI binding is absent, exhausted, or returns malformed data, the frontend falls back to deterministic English product and policy responses. No model credentials are sent to the browser.

## Security, truthfulness and order safety

- AI only *normalizes customer language*; products and prices always come from live `/api/catalog` and `@cake-galaxy/catalog`.
- Local product matching is confidence-based; ambiguous matches produce selectable options. Photo cakes go through their existing upload flow.
- No customer identity, session cookie, OTP or payment credential is submitted to Workers AI. The function redacts apparent phone numbers, pincodes and order references. For strict privacy guarantees, avoid putting personal information in free-tier AI prompts; redaction is best-effort.
- Customer clicks **Add to bag** explicitly. No bot-initiated `POST /api/checkout/orders`.
- Delivery checks reuse `/api/delivery`. A returned unavailable/unverified pincode cannot be promised delivery.
- The existing authenticated checkout revalidates order totals, availability, allowed COD methods, OTP session and CSRF token.
- Customer support responses are in formal English even if the user types mixed language.
- For general unsupported questions, the bot points to Help instead of inventing facts.
- Not yet a full autonomous agent: no automatic date/slot entry, authenticated order tracking within the chat, or fully semantic knowledge retrieval. These require additional work before claiming full coverage.

## Tests

```sh
npm ci
npm run test:chat -w @cake-galaxy/web
npm run check
CAKE_STATIC_EXPORT=1 npm run build -w @cake-galaxy/web
```

Manual preview test examples:
- `choclate trufle cake 1kg egles venum` → Chocolate Truffle, 1 kg, eggless, English reply, verified calculation
- `show choclate cakes` → choose from matching chocolate cakes
- `half kg` after a selected cake → asks for/uses selected size
- `560072` after delivery question → real service area lookup, never guess
- `track my order` → My Orders (authenticated)
- `custom photo cake` → Custom Cakes, no unquoted price
- Tap Add to bag, follow `/cart`, finish OTP + checkout normally

Production configuration and live end-to-end OTP/COD/payment confirmation remain mandatory for launch.
