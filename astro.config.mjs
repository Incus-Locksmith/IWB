import { defineConfig } from 'astro/config';
export default defineConfig({site:'https://www.iwillbloom.com',output:'static',build:{inlineStylesheets:'always'},redirects:{'/reserve':'/journal/','/product-page/toiletry-bag':'/journal/'}});
