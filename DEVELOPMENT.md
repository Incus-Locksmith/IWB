# I Will Bloom — development checkpoint

17 November 2026. Working Astro homepage preview; not a production shop.

## Existing site review
The homepage timed out in research fetches and failed in the browser (HTTP2 protocol error). Successfully read the indexed contact and journal pages. This is a partial audit; a complete crawl, sitemap export and Wix URL inventory remain necessary before migration.

| Existing URL | Action |
| --- | --- |
| / | Replace only after approval |
| /the-purpose | Preserve as journal information route |
| /contactiwb | Preserve contact route and public email |
| /for-healthcare-pros | Preserve; content retrieval timed out |
| /product-page/toiletry-bag | Existing purchase link; investigate and redirect to journal product route after confirming product identity |
| /alettertoyou | Found in earlier prototype only; verify before redirecting |

Sources reviewed: https://www.iwillbloom.com/contactiwb and https://www.iwillbloom.com/the-purpose . Keep useful daily-page, life-logistics, milestones, colouring and short-story content. Review older medical-sounding claims rather than carrying them over. Current approved terminology takes precedence: Load Lighteners, Colour & Calm, Moments of Wonder.

## Implemented
Astro static build, responsive homepage, semantic sections, keyboard focus, skip link, native FAQ disclosures, order preview dialog, quantity and regional postage estimates. No secret keys or account connections. No payment or order is submitted. Preview has noindex/nofollow and robots disallow. Generated styled imagery is explicitly labelled; illustrated journal is a placeholder. Existing prototype supplied the initial copy and direction. Library article cards remain labelled planned articles. No testimonials have been invented.

## Next implementation
- Complete crawl and redirect inventory; preserve blogs and founder letter.
- Build product, founder, Bloom Library, professional, contact and legal pages. Import exact approved testimonials with attribution and permission.
- Replace concept images with verified product photography and the approved lotus logo. Self-host licensed Forum and Red Hat Display fonts.
- Render static frontend from GitHub; separate Render Node service for Stripe Checkout and webhooks; durable PostgreSQL order and inventory storage. Cloudflare DNS stays unchanged until launch approval.
- Server-authoritative EUR price 3800 cents, allowlisted destinations, validated quantity, shipping configuration, idempotent signed webhook handling, transactional stock reservation and reconciliation. Never fulfil from a success URL. Store minimal order data, restrict management access and verify email delivery.
- Stripe test mode first: successful/declined/abandoned payments, duplicate and delayed events, refunds, out-of-stock and address validation. Payment account connection requires approval.
- Maintain €38 with no additional IVA in current preview. Verify tax treatment before payment activation. Postage €6 EU, €10 UK, €22 other regions is an estimate for one journal; confirm destinations and multiple quantities.
- Production SEO: remove preview indexing blocks only at launch, add canonical metadata, sitemap, Product/Organization/Breadcrumb structured data using verified facts, article authors and dates, redirects and Search Console. Search and AI visibility cannot be guaranteed.
- QA mobile and desktop, keyboard, contrast, links, image sizes, performance, structured data, checkout/webhooks and order management; final design approval before live publishing.

## Local development
npm ci
npm run dev
npm run build

Build output: dist. Render static command: npm ci && npm run build. Publish directory: dist. Do not deploy this checkpoint to the live domain.

## Second development checkpoint
Connected journal, founder-story draft, professional information, contact, privacy-preview notice, delivery-preview notice, and Bloom Library pages with three new editorial drafts. Existing original blog content has not been overwritten or represented as imported. Homepage and shared layouts now offer mobile menu navigation. Core pricing/session validation helpers have three passing Node tests covering tampered prices, unverified configuration, invalid destinations/quantities and mismatched/unpaid sessions. These helpers are a foundation, not a connected checkout or complete backend. Stripe webhook signatures, database persistence, stock control, authentication and order administration still need implementation and end-to-end tests. Stripe reference docs: https://docs.stripe.com/checkout/quickstart and https://docs.stripe.com/webhooks .

Browser QA remains unverified: the managed preview service previously timed out after Astro reported readiness. No production deployment or account connection has been made.

## Commerce checkpoint — 17 November 2026
Implemented a test-only Stripe Checkout service and PostgreSQL schema; atomic stock reservations; idempotent checkout creation and stock adjustments; raw-body signed webhook processing; canonical payment/expiry/refund reconciliation; private administrator order desk with audit history and versioned packing/dispatch updates; and a manual recovery command for stranded checkout sessions. The Astro page can reveal a test-checkout action only when a backend origin is supplied at build time. The saved offline preview leaves it disconnected.

Seventeen automated tests pass using PGlite SQL, a deterministic Stripe adapter, local HTTP requests and Stripe's signature utility. No actual Stripe sandbox payment, Render database or browser interaction has been tested. Live keys and events are refused by code. Notification delivery remains an unsent durable outbox, not an email integration. See commerce/README.md for exact setup, recovery and remaining launch requirements.

A separate order-desk demonstration uses fictional local sample data; it does not connect to the backend or process actual orders. Dependency audit identified vulnerabilities in the initial Astro version; upgraded to Astro 7.4.12 and revalidated build/dependencies.

## PayPal-first checkpoint
The user does not have a Stripe account and requested PayPal for the initial shop. Added a sandbox-only PayPal Orders v2 adapter, provider selection, PayPal-hosted approval flow, secure return/capture route, verified webhook handling, merchant/amount/delivery checks, idempotent captures and refunds, and conservative reconciliation. Updated checkout preview copy to PayPal. Stripe remains an optional implementation and its credentials are not required in PayPal mode. No merchant account or live payment has been connected. Read commerce/README.md for pending real-sandbox and production checks.
