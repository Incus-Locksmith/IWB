import { indexable, routes, site } from '../data/site.mjs';

export function GET() {
  const entries = indexable ? routes.map(path => `<url><loc>${site}${path}</loc></url>`).join('') : '';
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
