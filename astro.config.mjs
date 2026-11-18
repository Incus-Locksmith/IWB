import { defineConfig } from 'astro/config';
import { redirects, site } from './src/data/site.mjs';

export default defineConfig({
  site,
  output: 'static',
  build: { inlineStylesheets: 'always' },
  trailingSlash: 'always',
  redirects: Object.fromEntries(Object.entries(redirects).map(([source, destination]) =>
    [source, { status: 301, destination }]
  )),
});
