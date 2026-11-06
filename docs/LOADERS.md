# Cake Galaxy loading feedback

Loading indicators follow existing request, hydration and navigation state. There
is no minimum display duration, fake completion percentage or global network
interceptor. Public catalogue HTML remains available before hydration.

| Surface | Indicator |
| --- | --- |
| Route/Suspense fallback, initial account/admin/checkout check | Animated brand logo |
| Catalogue/category cards, product detail, bag, menu, orders | Content-shaped skeletons |
| Product, category, gallery, cart and chat photos | Image shimmer until load/error |
| Pincode, OTP send/verify, add-to-bag, address, cancellation, sign-in | Spinner inside the active button |
| Assistant request and initial chat catalogue | Bouncing dots |
| Customer design/photo upload and admin saves/imports | Indeterminate progress bar with the current stage |
| Shop filter/sort navigation | Indeterminate progress bar during the React transition |
| Delivery map initialization | Section spinner |
| Geolocation request | Pulse indicator over the map |
| Order processing and confirmation | Cake outline animation |

`CakeLoader` provides the animated variants and `ButtonContent` provides inline
spinner/text content for native buttons. The button owns `disabled` and
`aria-busy`; the child does not introduce a nested live region.
`LoadingSkeleton` has product, category, detail and row layouts. `LoadingImage`
retains native lazy loading, responsive sources and existing image geometry;
cached images settle on mount, failed images stop shimmering, and a new source
can recover after an earlier error.

Upload bars intentionally have no `aria-valuenow`: the current fetch transport
does not expose uploaded byte counts. Stage copy follows actual upload/submit
steps. All animated variants respect reduced motion; the cake silhouette stays
visible between tracing cycles. Forms remain visible while actions run, and
request errors restore the controls via their existing completion paths.

Validation: rendered React component tests cover accessible roles/text, inline
button markup, indeterminate progress, hidden skeleton artwork and SSR image
attributes. The existing web/API suites and standard/static builds remain the
release checks. Local browser checks used simulated slow responses for delivery
and chat plus image failure/recovery at desktop and 390px width. No local preview
routes or simulated API handlers are included in the release.
