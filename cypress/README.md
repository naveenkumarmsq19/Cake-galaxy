# Cake Galaxy Cypress E2E

This is a **non-destructive public-page smoke-test foundation**, not a completed authenticated E2E audit.

## Run locally
From the repository root:
```bash
npm install -D cypress
npx cypress open --e2e
```
Start the web app locally first. Set `CYPRESS_BASE_URL` to the correct local/staging URL (default: http://localhost:3000).

Headless:
```bash
CYPRESS_BASE_URL=https://staging.example.com npx cypress run
```

Windows PowerShell:
```powershell
$env:CYPRESS_BASE_URL='https://staging.example.com'
npx cypress run
```

## Coverage and limitations
- Public routes, navigation links, responsive overflow and image loading.
- Does **not** log in, create orders, charge payments, upload images or mutate production.
- Customer authentication, My Orders data isolation, cart and checkout state, payment test-mode, admin product/category CRUD, order alerts and real-time sync require seeded staging users, selectors, fixtures and test-mode payment credentials.
- Route and UI assertions should be adjusted against the current web app if its router differs.
- Cypress test failures are not automatically product bugs; reproduce and inspect API/network evidence before reporting.
