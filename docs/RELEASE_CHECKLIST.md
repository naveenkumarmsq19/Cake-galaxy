# Release checklist

This branch extends the WhatsApp OTP and weight-discount feature branch and fixes several source-review issues. Do not merge or enable live payments without CI and sandbox E2E validation.

## Automated
- Run `npm ci && npm run check` with Node 22.
- Run `CAKE_STATIC_EXPORT=1 npm run build -w @cake-galaxy/web`.
- Confirm Cloudflare Pages build uses the same export flag and publishes `apps/web/out`, with Pages Functions in the correct project root.
- Check `/api/ready` returns HTTP 200 with MongoDB connected; `/api/health` is liveness-only.

## Provider and operational prerequisites (not safely auto-configurable)
- Review the detailed policy draft pages and `docs/POLICIES_TO_APPROVE.md`; populate the public business/grievance/FSSAI details and obtain legal review. Leave `POLICIES_APPROVED=false` until merchant-approved.
- Approve product images, catalogue, exact variant prices and tax details before setting `CATALOG_APPROVED=true`.
- Configure verified MSG91 WhatsApp OTP and notification templates. Confirm recipient delivery in provider sandbox.
- Configure Razorpay test keys and webhook signing secret, test captured/failed/duplicate and delayed callbacks, retries and refunds before live keys.
- Set a reviewed preparation cutoff via `MIN_PREP_MINUTES` (defaults to 0) and configure valid delivery slots.
- Approve branch 3 address and service-area mapping; a PIN code alone cannot guarantee exact 5 km geofencing.
- Get tax adviser approval for invoice numbering/tax format before production.
- Payments remain gated behind explicit approvals, GST information, Razorpay keys and a webhook secret.
