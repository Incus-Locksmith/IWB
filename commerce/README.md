# I Will Bloom commerce — test-mode implementation

This backend is not deployed or connected to an account. It deliberately refuses Stripe live keys and live events. Checkout defaults closed, inventory defaults zero, and tax/shipping verification flags default false. No credentials belong in the source archive.

## Components

- Server-authoritative EUR 38 unit price and explicitly configured delivery charges. One journal per checkout until multiple-journal postage is approved.
- PostgreSQL transactions for stock reservations, unique request keys, unique Stripe sessions/payment intents and an audit trail.
- Stripe-hosted Checkout using a stable per-order idempotency key. Ambiguous network failures keep stock reserved until reconciliation; they never release a potentially payable order.
- Raw-body signature verification and canonical Stripe retrieval for payment/expiry/refund events. Paid amounts, currency, references and delivery country are checked. A success redirect cannot fulfil an order.
- Signed duplicate events do not repeat inventory changes or notifications. Refunds block fulfilment, remain separate from fulfilment status and do not automatically restock returned goods.
- Private administrator order desk at `/admin/`. Token is held in browser memory only. API responses are no-store, HTML is rendered using textContent, updates require the current order version, and mutations are recorded. This is a single-administrator test implementation; individual accounts/MFA and finer roles remain a production hardening task.
- Durable notification outbox records paid/dispatched messages. It does **not send email yet**. The desk shows the unsent count. Transactional email provider, retry/delivery handling and customer templates must be connected and tested before launch.

## Configuration and running

Use a dedicated test database and Stripe sandbox. Set the keys shown in `.env.example` in the backend environment; never put backend secrets in PUBLIC_ variables. Use exact HTTPS `STORE_ORIGIN` and `ADMIN_ORIGIN` with no trailing slash. Generate an administrator token with at least 32 unpredictable characters using a password manager. Do not reuse credentials elsewhere.

`npm ci` then `npm run commerce:migrate` creates tables with zero stock. `npm run commerce:start` starts the backend on PORT (default 3000). Use the protected stock form to enter verified available stock. Set CHECKOUT_ENABLED, TAX_VERIFIED and SHIPPING_VERIFIED true only for a reviewed test configuration. Shipping region example for **a test fixture only**: `{"eu":{"countries":["ES"],"shippingCents":600,"displayName":"Delivery"}}`. Populate the real approved country lists before wider testing. Region IDs expected by the storefront are eu, uk and rest.

Set PUBLIC_COMMERCE_ORIGIN when building the Astro frontend to reveal the test-checkout action. The offline preview leaves this empty. There is no live checkout switch in this build.

Configure the test webhook to `/api/stripe/webhook` for checkout.session.completed, checkout.session.expired, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed and charge.refunded. Choose snapshot payloads. Enter its test signing secret as STRIPE_WEBHOOK_SECRET. A missing/invalid signature is rejected. Do not mark an order paid manually.

## Recovery and daily operations

Run `npm run commerce:reconcile` in the backend environment to reconcile up to 100 creating/pending orders with current Stripe state. Unknown or ambiguous sessions remain reserved for operator review. A local elapsed timer does not release stock. Reconciliation does not send email or create new payment sessions. Further worker scheduling is not configured.

The order desk shows the latest 100 orders. Open a paid order, move it to packing, then dispatched; tracking is optional. Refunded, pending and review orders cannot be dispatched through this flow. Refunds must be carried out in Stripe, then reconciled through signed events. Automatic refund issuance, returns processing, full order search/export and notification delivery are not implemented. Do not treat this as a production-ready fulfilment system yet.

## Tests and limits

`npm test` uses real PostgreSQL-compatible SQL execution through PGlite plus a deterministic Stripe adapter. It covers duplicate and concurrent checkout attempts, stock rollback, timeout recovery, paid/unpaid/expired events, refund state, stale administration updates, and real Stripe signature verification on the HTTP endpoint. PGlite serializes test connections; this is not a multi-connection PostgreSQL load test. No real Stripe request, customer email or live payment is made by these tests. Still required: Render PostgreSQL tests, actual Stripe sandbox Checkout, webhook delivery/retries, managed browser QA, accessibility review and operational backups/restore tests.

## Deployment preparation

Intended stack: GitHub source; Render Static Site for Astro (`npm ci && npm run build`, publish dist); Render Node Web Service for commerce (`npm ci --omit=dev`, `npm run commerce:start`); Render PostgreSQL; Cloudflare DNS. No services, paid plans, GitHub repository or DNS changes have been created. Run migration against the test database before backend startup. Serve both surfaces over HTTPS. Restrict database access, configure backups, and put edge request throttling in place before exposing checkout. Current in-process rate limiting is per server instance; behind a proxy it conservatively groups the socket IP and is not a distributed abuse control.

Production remains blocked on verified seller/legal and delivery/tax details, final design and photos, authenticated account connections, notification delivery, stronger administration authentication and actual end-to-end testing. Live Stripe support requires a separate reviewed code change and explicit launch approval.

References: https://docs.stripe.com/api/checkout/sessions/create ; https://docs.stripe.com/webhooks ; https://node-postgres.com/features/transactions .

## PayPal-first checkout — current direction

PayPal is now the planned initial payment provider; a Stripe account is **not** required for it. Set PAYMENT_PROVIDER=paypal and PUBLIC_PAYMENT_PROVIDER=paypal. This development implementation uses only `api-m.sandbox.paypal.com` and `www.sandbox.paypal.com`; live PayPal use is refused by configuration. No PayPal account has been connected and no actual sandbox API request has been tested.

PayPal credentials: a sandbox REST app client ID/secret, its configured webhook ID, the sandbox receiving merchant ID, and an independently generated private PAYPAL_STATE_SECRET (at least 32 unpredictable characters). All remain server-side. The PayPal approval return carries a server-generated order-bound HMAC; it is cleared from the browser address bar after loading. No PayPal JavaScript SDK, password or merchant secret is embedded in the storefront.

Orders v2 is used to create a single physical-journal EUR 38 order plus verified postage. The buyer approves on PayPal's hosted page using PAY_NOW. Before server capture, the integration verifies the authoritative order amount, invoice reference, receiving merchant and shipping country. The capture is checked again before the order can be packed. Repeated capture requests use a stable provider request ID, and duplicate callbacks do not consume stock or enqueue messages twice.

Subscribe `/api/paypal/webhook` to CHECKOUT.ORDER.APPROVED, PAYMENT.CAPTURE.COMPLETED, PAYMENT.CAPTURE.REFUNDED, PAYMENT.CAPTURE.REVERSED, PAYMENT.CAPTURE.DENIED and CUSTOMER.DISPUTE.CREATED. Signatures are verified by posting the original event to PayPal's sandbox verification endpoint; certificates are never fetched from arbitrary supplied URLs. Approved events can finish an explicitly approved PAY_NOW payment if the buyer closes the return page. Completed captures are re-read from PayPal before recording. Refunds are retrieved from PayPal and summed idempotently; reversals/disputes hold fulfilment for review. The PayPal mock webhook simulator does not support this postback verification method; actual sandbox-app events must be used for the integration test.

PayPal reconciliation reads known provider orders; only a confirmed VOIDED order releases its reservation. Unknown sessions and elapsed timers do not release stock automatically. If initial order creation times out, the same request key may be retried within the implemented one-hour retry window; later retries are held for operator reconciliation rather than risking a second provider order. There is no automatic merchant refund action.

The order desk continues to work with both provider types. Notification delivery and live account integration remain outstanding. Before launch: connect the intended merchant account with approval, verify business eligibility and receiving details, test approval/cancellation/capture/pending/refund flows with a sandbox buyer, then separately review live configuration and obtain publication approval. Card or guest payment availability must be checked for the account; do not promise it to customers until verified.

PayPal references: https://developer.paypal.com/api/orders/v2 ; https://developer.paypal.com/api/rest/requests/ ; https://developer.paypal.com/api/rest/webhooks/rest/ .

## Current storefront direction

Stripe is the default for the 18 November website brief. The PayPal sandbox adapter remains available for an explicitly configured fallback. The storefront now starts checkout from /journal/ and estimates postage for one journal at a time. Keep all provider credentials disconnected from the design preview.
