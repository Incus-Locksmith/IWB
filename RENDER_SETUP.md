# Render setup prepared for review

Confirmed workspace: **YDP Dispatch Demo** (`tea-da5eqvou01pc73f0dao0`).
GitHub source: **Incus-Locksmith/IWB**, branch **main**.

The static design preview is deployed at https://iwb-preview.onrender.com/ . Automatic deployment is off. No paid compute plan, backend, database, custom-domain/DNS change or payment credential has been provisioned. Static builds and traffic count towards the existing workspace allowances.

## Frontend staging service

- Existing static site: `iwb-preview` (`srv-dbu7r1mi0phs7390n8fg`).
- Repository root: repository root.
- Build command: `npm ci && npm run build`.
- Publish directory: `dist`.
- Node version: 24.
- Automatic deploy: off; update the preview only after deliberate review.
- Leave `PUBLIC_COMMERCE_ORIGIN` unset until the sandbox backend is ready.
- `PUBLIC_PAYMENT_PROVIDER=paypal` when test checkout is connected.
- The code intentionally blocks indexing during development. This does not make a hosted preview private; access controls need to be selected before deployment if private staging is required.

## Commerce sandbox service

- Separate Node web service, proposed name: `iwb-commerce-test`.
- Region: Frankfurt, matching the workspace's related services.
- Build command: `npm ci --omit=dev`.
- Start command: `npm run commerce:start`.
- Health path: `/health`.
- Separate PostgreSQL database; initialise with `npm run commerce:migrate`.
- Verify hosting/database plan, cost, retention and backup arrangements before provisioning.
- Default checkout closed; initial stock zero. Actual stock must be entered after verification.

Enter secrets directly in protected hosting settings, not GitHub files: DATABASE_URL, PAYPAL_CLIENT_SECRET, PAYPAL_STATE_SECRET and ADMIN_TOKEN. Configure the remaining variable names from `.env.example`. No Stripe account is required in PayPal mode. The developer app exists according to the owner; its credentials have not been connected or tested.

Set exact sandbox frontend/backend origins, receiving sandbox merchant ID and webhook ID before testing. Bind the PayPal webhook to `/api/paypal/webhook` once the HTTPS endpoint is available. See commerce/README.md for events, verification, reconciliation and operational limits.

## Approval gates

Before provisioning any paid resource, show the selected plan and cost for approval. Before publishing the replacement website or changing the existing domain, obtain explicit launch approval. Keep the current Wix website active throughout development.

Required remaining checks: final design/content and product photography, seller/legal/delivery/tax details, actual PayPal sandbox transactions, email delivery, administration security, real PostgreSQL concurrency, and browser QA.

## Preview verification

The initial stylesheet asset failure was corrected by inlining the small Astro page styles. Browser checks confirmed the desktop layout, image loading, journal/library navigation and order-preview calculations. Inactive payment controls remain hidden using an explicit CSS hidden rule. Full mobile, accessibility and real-payment checks remain outstanding.
