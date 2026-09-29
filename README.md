# Cake Galaxy

Cake Galaxy customer storefront. The web app uses Next.js App Router and React; the API uses Express, Node.js and MongoDB. The UI has a light sage palette and a compact image banner on mobile. Business data, OTP, payments and notifications stay on the server.

## Project structure

| Path | Purpose |
| --- | --- |
| `apps/web` | Next.js customer website and responsive screens |
| `apps/api` | Express API, MongoDB models, OTP, uploads, orders, Razorpay, invoices |
| `packages/catalog` | Seed products and shared display pricing |
| `docs/API.md` | API routes, setup and deployment considerations |

Customer routes: home, catalogue/search, product options and photo cake upload, custom cake samples and design request, bag, address, phone login, checkout, confirmation, orders, help and policies. The chatbot answers common questions using local rules. Offers/coupons, public branch details and live rider tracking are not part of this scope. The private operations panel is at `/admin`.

## Local development

Requires Node.js 22+, npm and a reachable MongoDB instance. In the repository root:

```sh
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
npm run dev
```

Open `http://localhost:3000` (API on `http://localhost:4000`). The sample API config enables a development OTP only outside production; its code appears in the API terminal. Do not enable real checkout until products, prices, policies, business tax information, service areas and provider accounts are configured. The sample catalogue contains illustrative images, names and prices, not confirmed merchant inventory.

On Windows PowerShell, create the same files from the repository root:

```powershell
Copy-Item .\apps\api\.env.example .\apps\api\.env
Copy-Item .\apps\web\.env.example .\apps\web\.env.local
npm run dev
```

`apps/api/.env` contains `MONGODB_URI=mongodb://127.0.0.1:27017/cake_galaxy` as a local example. A MongoDB server must actually be running at that address. If you use a hosted MongoDB database, replace this value with its connection string. The API loads `apps/api/.env` even if you start Node from the repository root. Never commit real connection strings or provider keys.

```sh
npm run check
```

This runs API validation/signature/HTTP tests and the production Next.js build. The full MongoDB and real provider flows require a configured database, verified provider sandbox credentials and an end-to-end checkout test. No provider credentials are stored in the repository.

## Business setup

1. Set `ADMIN_BOOTSTRAP_EMAIL` and a unique 12–128 character `ADMIN_BOOTSTRAP_PASSWORD` in the API environment, start the API once, then remove both variables and restart. On Render, set these in the API service's Environment page (not the web service); redeploy, wait for `Initial Super Admin created` in the log, then remove them. A missing or weak bootstrap password leaves the customer API running but does not create an admin. Sign in at `/admin` on the web domain. Create Branch Managers there; they see only their own branch orders and custom requests. Super Admin can view and manage all branches, managers, products and service mappings.
2. Branches BR01 (Peenya, 560058) and BR02 (Nagasandra, 560073) are created inactive with their own base pincode mappings. Branch 3 was not added because the supplied address duplicated Branch 2. Confirm its actual address before creating it in the panel. Activate branches and map verified 6-digit service pincodes under Coverage. Each pincode maps to exactly one branch; orders and custom requests save the assigned branch at creation. Old service area rows without a branch mapping are unavailable at checkout. Do not infer all covered pincodes from a 5 km radius: a pincode spans an area and exact distance needs a verified delivery address/map location. `radiusKm: 5` records the operating rule, while actual fulfillment currently uses the approved pincode list.
3. Replace the starter `Product` documents with approved cake photos, names, sizes and prices. Super Admin can edit individual products in the panel. The earlier PDF workbook uses exact pastry/small/medium prices and missing size weights; the current product model still uses one base price and proportional size pricing. A dedicated variant pricing importer is needed before that workbook can be imported without changing amounts. Replace the starter copy in `apps/web/src/screens/Info.jsx` with approved terms, privacy and cancellation/refund text.
4. Set the merchant GSTIN, legal name and correct tax rate; GST invoices are generated for paid orders when those fields are configured.
5. Configure MSG91 SMS OTP credentials and an approved WhatsApp template if order updates are desired. Obtain customer consent through checkout.
6. Configure Razorpay keys and a webhook secret. Test captured, pending, failed and duplicate callbacks in the provider test environment.
7. Set `CATALOG_APPROVED=true` and `POLICIES_APPROVED=true` only after the approved catalogue and policies are in place. Checkout remains disabled without these approvals, valid GST settings and Razorpay keys.

See `apps/api/.env.example` for every variable. `.env` files are ignored by Git.

## Deployment

Deploy `apps/web` on Cloudflare Pages with the build-time `NEXT_PUBLIC_API_URL` set to the full Render API URL ending in `/api`, for example `https://api.example.com/api`. Rebuild the frontend after changing this value. Deploy `apps/api` on Render with MongoDB and provider secrets. Set `WEB_ORIGIN` to the exact public website origin, or set `WEB_ORIGINS` to a comma-separated list of the Pages and custom-domain origins (no paths, no `/admin`, no trailing slash). `WEB_ORIGINS` overrides `WEB_ORIGIN`. For reliable cookie based phone/admin sessions, serve the storefront and API from the same site, such as `www.example.com` and `api.example.com`, over HTTPS. Set `NODE_ENV=production` and `COOKIE_SECURE=true`. Check Render `/api/health` returns `{ "ok": true }` before opening the frontend. Configure the merchant domain, provider webhooks at `/api/webhooks/razorpay` and database backups. Use the real provider test environment before live keys.

The Next.js app can also produce a static preview with `CAKE_STATIC_EXPORT=1 npm run build -w @cake-galaxy/web`; files are generated in `apps/web/out`. In the preview, shoppers can enter a pincode on a product, add it to their bag, fill their address and review checkout. If the API is offline, the pincode is saved as unverified and payment stays disabled. A static preview does not host Express or MongoDB. Real checkout requires a separately reachable API, correct CORS and cookie settings, service areas and live merchant credentials; the API rechecks the delivery area and total before creating a payment order.

## Image credits

The bundled photographs are design references. Replace them with the merchant's approved product photographs before launch. Sources: [chocolate](https://images.unsplash.com/photo-1578985545062-69928b1d9587), [celebration](https://images.unsplash.com/photo-1558301211-0d8c8ddee6ec), [floral](https://images.unsplash.com/photo-1562777717-dc6984f65a63), [rainbow](https://images.unsplash.com/photo-1464349095431-e9a21285b5f3), [custom](https://images.unsplash.com/photo-1535141192574-5d4897c12636), [cupcakes](https://images.unsplash.com/photo-1587668178277-295251f900ce). The sage celebration banner is a bundled original visual.
