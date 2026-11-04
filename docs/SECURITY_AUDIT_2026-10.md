# Cake Galaxy security assessment — 30 October 2026

Scope: **authorized code and dependency security review** of the Cake Galaxy GitHub project, plus isolated localhost API security smoke tests in CI. This is **not** an offensive penetration test or a certification of security. No load testing, credential guessing, customer/merchant transactions, or destructive probes were made against production.

## Verified testing

- Isolated local backend test suite: **69 passed, 0 failed**, including six new security smoke tests for anonymous access controls, unknown Origin blocking, forged webhook signature refusal, basic hardening headers and oversized JSON rejection. See the [CI run](https://github.com/naveenkumarmsq19/Cake-galaxy/actions/runs/40937688849).
- `npm audit --omit=dev --json` in GitHub Actions: **1 critical, 6 high, 1 moderate** production-dependency advisories. Security audit job correctly failed because high/critical findings remain.
- No active exploit, direct production credential test, account takeover test, authenticated business-logic attack, payment test or Cloudflare WAF verification was conducted.
- Network access to https://cakegalaxy.in and https://cake-galaxy.onrender.com failed from the audit environment (DNS/access restrictions); production HTTPS certificate, HTTP security headers, bot mitigation and real API security could **not** be independently measured.
- Static code review: `apps/api/src/app.js`, `admin.js`, `providers.js`, `gallery.js`, `galleryZip.js`, `validation.js`, `models.js`, Cloudflare proxy/assistant functions, web storefront, workflow/package manifests and selected existing tests.
- No GitHub Dependabot/secret-scanning dashboard results could be accessed by the available connector. Do not treat this as proof that no secret exposure exists.

## High-priority vulnerabilities and exposures

### 1. Dependency vulnerabilities — CRITICAL priority for remediation

The production lockfile as installed in CI reports the following:

| Package | Advisory severity | Direct dependency? | Audit remediation availability |
|---|---|---:|---|
| next | Critical | Yes | 16.4.3 suggested |
| express-rate-limit | High | Yes | 8.7.2 suggested |
| multer | High | Yes | 2.5.0 suggested |
| sharp | High | Yes | 0.35.5 suggested; major upgrade |
| body-parser | High | Transitive | Available |
| ip-address | High | Transitive | Through express-rate-limit |
| source-map-js | High | Transitive | Available |
| qs | Moderate | Transitive | Available |

**Action:** Update app dependencies and lockfile in a dedicated branch; run `npm audit --omit=dev`, all tests, Next static export, upload and OTP smoke tests. Be careful: `sharp` major upgrade can change image processing. The deployed frontend is currently a static export, so a Next.js server-side advisory may not be exploitable on the deployed static frontend; applicability still needs advisory-specific review and upgrade.

### 2. Public origin bypass risk — HIGH if backend origin is directly reachable

Cloudflare Pages proxy points to `https://cake-galaxy.onrender.com`. The Render service lists this public URL. Requests directly to the Render origin might bypass **Cloudflare edge** WAF/rate limits, though the Node.js authentication/CSRF still applies. We did not successfully connect to the URL from this environment.

**Action:** Apply equivalent protections at backend/API layer, consider strict origin access controls or Cloudflare tunnel/Access architecture where compatible with payment callbacks, and do not assume Cloudflare edge rules alone protect direct Render requests. Preserve valid Razorpay webhook traffic.

### 3. Admin authentication — HIGH impact, hardening gap

`admin.js` uses salted scrypt password hashes, secure session cookies and an IP login limiter (six attempts/15 minutes), but no admin MFA, device-aware login alerting or account-level distributed attack protection appears in the reviewed code. Admin sessions have a seven-day absolute TTL without a separate idle timeout.

**Action:** Add admin MFA (TOTP or passkeys), monitor unusual sign-ins, use central rate limiting per username/IP with anti-lockout safeguards, revoke sessions after password or role changes, consider shorter idle lifetimes.

## Other improvements

### 4. NC Bot endpoint abuse and user data — MEDIUM/HIGH availability/privacy risk

`functions/api/assistant.js` caps messages at 500 characters, checks same-origin `Origin` when present, and catches provider errors. However, endpoint requests are anonymous with **no enforced per-client quota in code**. Repeated requests could exhaust the Workers AI free daily allowance, and regex-based phone/address redaction is best-effort. An absent `Origin` header is not rejected.

**Action:** Enforce Cloudflare server-side rate limits, optionally Turnstile for excessive/bot traffic, an account-level daily budget and strict no-PII prompt policy. Keep conversation normalizer isolated from any privileged order actions.

### 5. Hardening response headers — MEDIUM, production config NOT independently verified

The API explicitly sets `X-Content-Type-Options: nosniff` and `Referrer-Policy`, disables `X-Powered-By`. This audit did not find equivalent explicit server-level CSP, `Strict-Transport-Security`, `X-Frame-Options` or frame-ancestors protection and Permissions-Policy in the reviewed code. Cloudflare may separately supply some headers; live response inspection is required.

**Action:** Add HSTS after confirming HTTPS everywhere, CSP tailored to Next static assets, Razorpay and ImageKit, `frame-ancestors 'none'` or merchant-required value, and Permissions-Policy. Deploy CSP in Report-Only first to avoid breaking OTP/payment.

### 6. Session lifecycle and webhook availability — MEDIUM

Customer sessions have a 30-day TTL, admin sessions seven days. No separate server-side idle timeout or user-facing all-devices logout appears in the inspected code. Razorpay webhooks are signature-checked before parsing but are mounted ahead of the generic `/api` rate limiter; they accept signed requests up to 1 MB (bounded), without a dedicated webhook anti-abuse strategy in code.

**Action:** Introduce idle session expiration/session review and targeted webhook request protection appropriate for payment-provider retries. Preserve idempotency and signature validation.

## Existing protections observed

- Customer and admin auth checks on relevant sensitive routes; admin branch-scoped authorization and super-admin checks.
- OTP challenge age limit (5 minutes), challenge attempt limit and resend throttling in API.
- Session cookie `HttpOnly`, `SameSite=Lax`, `Secure` in production; SHA-256 token hashes stored server-side; CSRF headers on authenticated writes.
- Razorpay HMAC request and webhook signatures, captured amount/order/currency checks before marking paid.
- Server-side product selection, weight limits, delivery slot, eggless options, totals, tax and COD readiness; idempotency keys unique per customer.
- Product/customer uploads require auth and have file size, pixel-count and image transcoding controls; gallery ZIP has decompression/output bounds.
- API JSON 64 kB limit and broad per-IP limiter.
- Error handler hides internal 500 errors.

## Recommended next actions (priority order)

1. **Fix all critical/high npm advisories**, validate full CI and static-export builds; preserve known-good rollback.
2. **Protect direct Render origin** and confirm Cloudflare WAF/rate controls apply to every public entrypoint.
3. **Add admin MFA** and reliable centralized login throttling/alerts.
4. **Add Workers AI endpoint quota/anti-abuse control** and restrict PII leakage into AI inference.
5. Implement and verify **response headers** and reduce session attack window.
6. Commission a permitted staging-environment OWASP ASVS / WSTG test for auth, IDOR, payment lifecycle, uploads, XSS, privilege transitions and concurrent order creation. Never attack the live customer website with unapproved traffic.

## Conclusion

The source contains meaningful safeguards, but unresolved dependency advisories and deployment/abuse hardening gaps mean it should **not be called fully secure or penetration-tested**. No defensible numerical security percentage can be assigned from these checks alone.
