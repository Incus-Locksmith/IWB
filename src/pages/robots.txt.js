import { indexable, site } from '../data/site.mjs';

export function GET() {
  const text = indexable ? `Allow: /\nSitemap: ${site}/sitemap.xml` : 'Disallow: /';
  return new Response(`User-agent: *\n${text}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
