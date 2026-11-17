# I Will Bloom

Astro ecommerce website and test-only PayPal-first commerce service.

Status: development preview. This repository does not replace the live Wix site. Checkout, final content, legal details and production publishing remain subject to review. No credentials are included.

## Development

Requires Node.js 24 or later.

```sh
npm ci
npm test
npm run build
npm run dev
```

The static site builds to `dist`. Preview indexing is blocked intentionally. PayPal integration defaults to sandbox only and must not be enabled for live payments without a reviewed change.

## Commerce

Read [commerce/README.md](commerce/README.md) for configuration, database migration, payment verification, inventory, order administration and limitations. Use `.env.example` for variable names only; keep actual secrets in the hosting provider's secret settings.

The planned hosting uses a Render Static Site, a separate Node commerce service and PostgreSQL. No automatic deployment configuration is enabled by this initial upload.

## Content and design

The homepage, founder story and Bloom Library are drafts. Concept imagery is labelled and must be replaced with approved product photography before launch. Exact testimonials and existing website URLs still require verification. See [DEVELOPMENT.md](DEVELOPMENT.md) for development checkpoints.
