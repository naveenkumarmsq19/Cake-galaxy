# Cake Galaxy search, answers and AI discovery

The storefront now exports readable HTML for the active public catalogue. Every built cake has a stable `/cakes/<id>/` page, and every nonempty active category has a `/collections/<slug>/` page. The menu, shop fallback, navigation and product cards link to those pages. Existing `/product?id=...` links still work and move to the canonical cake page in the browser when one exists.

## What is configured in code

- Each public page has its own title, description, canonical, Open Graph URL and social preview metadata.
- Bakery and WebSite JSON-LD use the confirmed Nagarabhavi/Mudalapalya address. Telephone, opening hours, social profiles, stock promises and review ratings are omitted because they have not been verified for this store.
- Cake pages contain a Product and Offer using the same paise-to-INR conversion and pricing functions as checkout. The visible starting price and schema price agree. Public GridFS cake images are allowed through robots.txt; other API routes remain excluded.
- Breadcrumbs and category collections provide linked discovery paths.
- The home and help pages use one shared set of visible ordering questions and FAQ JSON-LD. The visit page explains the actual store location and pincode-dependent delivery.
- The sitemap includes public informational, category and cake pages only. Account, bag, checkout, admin and legacy duplicate routes keep `noindex`.
- The optional `/llms.txt` discovery file links to canonical pages and gives the same business facts. It is supplementary: it is not an indexing requirement, ranking signal or promise of AI citations.
- Cloudflare `_headers` marks the project's `pages.dev` host and deployment previews `noindex`. The primary indexable origin is `https://cakegalaxy.in`.
- Existing Google verification HTML is retained. Optional Google and Bing meta ownership tokens are supported through build environment variables.

## Build and catalogue freshness

`npm run build -w @cake-galaxy/web` first reads `SEO_CATALOG_URL`, which defaults to `https://cakegalaxy.in/api/catalog`. This endpoint returns active, approved products only. The build allowlists public fields and writes an ignored generated snapshot used by Next.js static rendering. Bad responses or invalid product data stop the build instead of exposing sample inventory.

The browser refreshes the catalogue after hydration. New cakes that have not yet been built use the existing purchase route. Checkout continues to confirm live inventory, delivery eligibility and totals on the API.

**Rebuild Cloudflare Pages after changes to product prices, names, photos, availability or category assignments.** Static product metadata and sitemap entries describe the most recent successful build. An admin change alone does not rebuild the frontend. A Cloudflare Deploy Hook or an approved scheduled rebuild can automate this once the hosting owner configures it. No hook or scheduled task is created by this change.

Existing production build settings remain: `CAKE_STATIC_EXPORT=1`, public API `/api`, and output `apps/web/out` for a repository-root build. The public API must be reachable from the build environment. No API credentials belong in `SEO_CATALOG_URL`.

## Validation

```sh
npm ci
npm run check
CAKE_STATIC_EXPORT=1 npm run build -w @cake-galaxy/web
npm run check:search-export -w @cake-galaxy/web
```

The export verifier checks every sitemap URL for a rendered heading, one matching canonical, its own social URL, business schema and absence of `noindex`. It also checks product prices in raw HTML against schema, readable product links in the initial menu/shop HTML, and private-page exclusions. CI runs this after the Cloudflare export.

## Owner-account steps after deployment

| Account | Concrete action | Status of this code change |
| --- | --- | --- |
| Google Search Console | Verify the domain/property, submit `https://cakegalaxy.in/sitemap.xml`, inspect the home/menu/store page and representative cake URLs, then request indexing where appropriate. | Ownership file retained; submission and property status require account access. |
| Bing Webmaster Tools | Verify/import the same property and submit the sitemap. | Optional `BING_SITE_VERIFICATION` support is ready; verification/submission require the owner account. |
| Google Business Profile | Confirm the Nagarabhavi listing belongs to this merchant; use the same business name, verified phone, address and website. Set the menu/order links and maintain accurate hours and photos. | No listing was created or changed, and no verification is claimed. |
| Cloudflare Pages | Deploy the reviewed change; verify production serves the new pages and robots/sitemap. Arrange rebuilds when the catalogue changes. Check bot/WAF settings do not challenge public search crawlers. | Static build and response headers are prepared in the repository. Dashboard controls are separate. |

Optional build variables `GOOGLE_SITE_VERIFICATION` and `BING_SITE_VERIFICATION` must be copied from the corresponding owner's account. Do not invent tokens, business contact details, opening hours or geographic delivery promises. Existing public support/operator environment fields remain in use.

## Measuring results

Use Search Console and Bing to record indexed pages, impressions, clicks, queries and landing pages after release. Compare actual search-origin orders in the store's approved analytics workflow. No analytics property or tracking identifier has been invented. Crawling, indexing, rankings, rich results and inclusion in generated answers are decisions made by the relevant search service.

## Primary references

- [Google: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)
- [Google: Product structured data](https://developers.google.com/search/docs/appearance/structured-data/product-snippet)
- [Google: Local business structured data](https://developers.google.com/search/docs/appearance/structured-data/local-business)
- [Google: FAQ rich-result eligibility](https://developers.google.com/search/blog/2023/08/howto-faq-changes) — commercial bakery FAQs do not imply a Google FAQ rich result.
- [Cloudflare: headers](https://developers.cloudflare.com/pages/configuration/headers/)
