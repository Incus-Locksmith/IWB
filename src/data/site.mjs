export const site = 'https://www.iwillbloom.com';
export const indexable = process.env.IWB_PUBLIC_INDEX === 'true';
export const routes = [
  '/', '/journal/', '/the-purpose/', '/alettertoyou/', '/bloom-library/',
  '/bloom-library/when-words-feel-difficult/', '/bloom-library/a-gift-without-expectations/',
  '/bloom-library/no-right-way-to-use-a-journal/', '/for-healthcare-pros/',
  '/testimonials/', '/contactiwb/', '/delivery-returns/', '/privacy/',
];
export const redirects = {
  '/product-page/toiletry-bag': '/journal/',
  '/reserve': '/journal/',
};
