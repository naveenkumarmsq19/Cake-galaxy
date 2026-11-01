# Cake Galaxy security, validation and mobile performance hardening

## Scope
- No Cloudflare Workers migration, no hosting change, no secrets changed and no production mutations.
- Proposed hardening is staged on a feature branch for review, regression tests and controlled deployment.
- Based on the mobile PageSpeed session provided November 1, 2026: Performance 91, FCP 0.9s, LCP 3.2s, TBT 10ms, CLS 0, SEO 100.
- GitHub baseline on Oct 30 passed 63 backend tests, 58 frontend tests, but npm install reported eight advisories. Re-run the dependency inventory after refreshing the lockfile.

## Code changes in this branch
1. Next.js 16.3.6 -> 16.4.3 (patched Oct 2026 line); lockfile refreshed by one-time GitHub workflow.
2. Disable fixed test OTP / simulated COD in NODE_ENV=production regardless of TEST_MODE_ENABLED. Test-mode tests now run under NODE_ENV=test; verify production rejection.
3. Set no-store on authenticated / personal APIs and proxy responses; allow 30-second caching for public catalogue only.
4. Add CSP protective directives, framing restrictions, Permissions Policy, HSTS for static Pages content. The API proxy applies its own security headers because Pages _headers do not cover Functions.
5. Add ImageKit-only responsive image transformations; preserve existing private image links and original full-resolution gallery view.
6. Add image-delivery regression tests and dependency-audit inventory in CI.

## Manual production verification required (cannot be completed from source code)
- Render env: NODE_ENV=production, TEST_MODE_ENABLED=false, DEV_OTP_ENABLED=false, TEST_PHONE/TEST_OTP_CODE removed, no exposed secrets; never commit .env.
- Cloudflare DNS, HTTPS-only redirect, WAF/rate-limiting, bot management, deployment, cache rules, security headers on API responses.
- Verify Render trust proxy chain and real client IP in logs (avoid spoofable forwarded headers). Confirm admin / OTP rate limits with authorized staging tests.
- GitHub, Render, Cloudflare, MongoDB Atlas, ImageKit and payment provider accounts: enable 2FA and least privilege.
- MongoDB Atlas backup creation and test restore; uptime/payment-alert monitoring.
- True Razorpay sandbox checkout + signed webhook + refund, MSG91 test phone, image upload, admin branch authorization, concurrency and duplicate requests.
- Run Chrome Lighthouse after deploy and compare p75 real-user LCP plus FCP/TBT/CLS; re-expand 'Improve image delivery' details for exact file optimization.
- Render Free cold-start cannot be eliminated by a repository patch; paid always-on hosting or changed infrastructure needed.

## Release gates
- npm ci and all repository tests pass.
- npm audit reviewed and every relevant high/critical advisory addressed or justified.
- Verified production NODE_ENV and test-mode off.
- Razorpay webhook and refund reconciled in a sandbox; no live customer charges.
- Header/cookie checks against actual deployed domain.
- Screenshot compare mobile/desktop, load at least two network conditions, rollback ready.

## Read-only smoke check
`node scripts/check-public-endpoints.mjs https://cakegalaxy.in`

Script makes only GET requests and measures HTTP; it is not a concurrency/load or pen test.
