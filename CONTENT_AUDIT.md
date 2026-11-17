# Content and asset audit — 17 November 2026

## Source evidence

The existing website intermittently times out or returns gateway errors. Indexed snapshots recovered through web search were used where direct page retrieval failed. This is a partial migration audit, not a complete Wix crawl.

- https://www.iwillbloom.com/ — founder welcome, gift/self-use positioning and published Seamus L feedback. The preview uses one short excerpt and clearly identifies his relationship to Rachel. Professional testimonial attribution remains unverified and has not been invented.
- https://www.iwillbloom.com/alettertoyou — existing founder letter. Adapted into a concise welcome without carrying over statements implying that mindset determines cancer recovery.
- https://www.iwillbloom.com/product-page/toiletry-bag — verified to be the journal product despite the unrelated slug. Price EUR 38 and accompanying extras recovered. New /journal/ route created.
- https://www.iwillbloom.com/reserve — legacy pre-arrival page; preserve the URL with a redirect to /journal/ rather than reusing outdated arrival messaging.
- /the-purpose, /contactiwb, /for-healthcare-pros remain represented in the new site. Blog inventory remains incomplete; no old article URL has been guessed or deleted.

## Original website assets

- Gold lotus: https://static.wixstatic.com/media/6e997f_c4fab83e1ead4d8c98bf6580616faf89~mv2.png . Transparent canvas trimmed and resized for web use; no symbol redrawn. Local asset public/assets/verified/lotus.png.
- Real journal photograph: https://static.wixstatic.com/media/df25fe_569043dccdef4926a6c6256c8f5d9f53~mv2.jpeg . Converted to a smaller WebP for delivery, without retouching the product. Local asset public/assets/verified/journal.webp.
- The homepage hero and product section now use this original product photo instead of a generated scene or illustrated stand-in. More original photos and inside-page previews would still improve the product gallery.

## Conflicts requiring final verification

The old listing says 260 pages, while earlier project material used approximately 250–254. The new product page omits a page count. The old site refers to tear-off strips; the current approved name Load Lighteners takes precedence. The exact packed extras, present stock, countries, delivery timelines, customs and tax treatment need operational confirmation before sales activation.

## Redirect implementation

Astro static redirects are provided for /reserve and /product-page/toiletry-bag. These generate HTML redirects for the preview. Configure equivalent HTTP 301 redirects on Render/Cloudflare before domain migration; static HTML redirects are not server-side 301 responses.

## Remaining migration work

Obtain a complete Wix URL/sitemap inventory; recover existing blog articles and professional endorsements with exact attribution; verify professional-resource text; finalise seller/legal/returns/privacy details; check all image alternative text and mobile layouts. The preview remains noindex and payments remain disconnected.
