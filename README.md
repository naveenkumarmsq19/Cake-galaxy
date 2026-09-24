# Cake Galaxy storefront

Responsive customer website with a sage-green and white visual theme.

## Run locally

Requires Node.js 20 or later. There are no package dependencies to install.

    npm start

Open http://localhost:3000.

    npm run check

This runs module syntax, asset, pricing, cart, escaping and screen-render checks.

## Included

- Compact photographic homepage banner, category navigation and mobile bottom navigation.
- Mobile header, three-column occasion grid and two-column product cards.
- Product search, category filtering and price sorting.
- Product detail, weight, flavour, eggless selection, message and add-ons.
- Photo cake upload and custom design samples / reference upload.
- Local shopping bag with quantity changes and consistent calculated prices.
- Delivery address, preferred date / slot and optional WhatsApp consent.
- Phone login and OTP interfaces with server API hooks.
- Order review, GST billing fields and Razorpay Standard Checkout connector.
- Order, invoice, cancellation, confirmation and support screens.
- A rule-based FAQ chatbot. It does not use an external language model.
- Bundled product photographs and a dependency-free local server.

## Source

- dist/index.html: document shell, navigation, dialogs and support panel.
- dist/assets/styles.css: design system and responsive layouts.
- dist/assets/catalog.js: illustrative product catalogue and price calculations.
- dist/assets/views.js: customer screens.
- dist/assets/state.js: device-local bag and in-memory checkout state.
- dist/assets/app.js: navigation, validation and interactions.
- dist/assets/api.js: backend requests and Razorpay integration.
- dist/assets/images: bundled photographs.
- scripts/serve.mjs: local static server.
- scripts/check.mjs: source and functional checks.
- docs/API.md: required backend API contracts.

## Current integration boundary

This package is the complete customer frontend, not an operational commerce backend. Browsing, filters, cart calculations, upload previews, address collection and payment review work locally.

Live SMS, authentication, delivery availability, persistent custom requests, order storage, payments, invoices and WhatsApp sending require the merchant's backend and provider configuration. These services are not connected in this delivery. The local server returns a service-unavailable response for /api routes. The frontend never treats an arbitrary OTP, a button click or an unverified payment callback as a successful transaction.

The Razorpay connector loads the official checkout only after an enabled backend configuration and authenticated session are present. Order creation and payment verification happen through the backend contract in docs/API.md. No card form or payment secret is included in browser code.

Product names, sizes and prices are illustrative catalogue data. Confirm the merchant's catalogue, taxes, serviceable pincodes, slot availability, refund terms and legal policies before launch. The short policy pages are not a substitute for approved merchant policies.

## Deployment

Publish the contents of dist on your preferred static host and configure the merchant domain. Route /api to the application backend on the same origin, using HTTPS. No build command is needed. The archive is portable and contains no hosting-account configuration, credentials or repository history.

## Image sources

The bundled photographs came from these Unsplash image sources and are used as catalogue design references. Replace them with the merchant's product photographs before launch.

- chocolate.jpg: https://images.unsplash.com/photo-1578985545062-69928b1d9587
- celebration.jpg: https://images.unsplash.com/photo-1558301211-0d8c8ddee6ec
- berry.jpg: https://images.unsplash.com/photo-1562777717-dc6984f65a63
- pastel.jpg: https://images.unsplash.com/photo-1464349095431-e9a21285b5f3
- custom.jpg: https://images.unsplash.com/photo-1535141192574-5d4897c12636
- cupcakes.jpg: https://images.unsplash.com/photo-1587668178277-295251f900ce

The homepage celebration-banner.webp is an original campaign illustration, not a photograph of a listed merchant product. Its call to action opens the catalogue. The image is stored locally as a 1600 × 900 WebP. HTML provides the heading and button so they stay readable and accessible on smaller screens.
