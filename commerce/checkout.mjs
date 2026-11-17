// Server-only checkout configuration. Not connected to the preview UI.
export const JOURNAL_CENTS = 3800;
export function checkoutParameters(input, config) {
  if (!input || !Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 4) throw new Error('Choose between one and four journals.');
  if (input.quantity !== 1) throw new Error('Multiple-journal postage must be confirmed before checkout.');
  if (!config?.taxVerified || !config?.shippingVerified) throw new Error('Checkout configuration has not been verified.');
  const region = config.regions?.[input.region];
  if (!region || !Array.isArray(region.countries) || !region.countries.length || !Number.isInteger(region.shippingCents) || region.shippingCents < 0) throw new Error('Delivery region unavailable.');
  const origin = new URL(config.storeOrigin);
  if (origin.protocol !== 'https:') throw new Error('A secure storefront URL is required.');
  return {
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{price_data:{currency:'eur', unit_amount:JOURNAL_CENTS, product_data:{name:'I Will Bloom guided cancer support journal'}},quantity:input.quantity}],
    shipping_address_collection:{allowed_countries:region.countries},
    shipping_options:[{shipping_rate_data:{type:'fixed_amount',fixed_amount:{amount:region.shippingCents,currency:'eur'},display_name:region.displayName}}],
    automatic_tax:{enabled:false},
    success_url:new URL('/order-received/?session_id={CHECKOUT_SESSION_ID}',origin).href.replace('%7BCHECKOUT_SESSION_ID%7D','{CHECKOUT_SESSION_ID}'),
    cancel_url:new URL('/#shop',origin).href,
    metadata:{sku:'iwb-journal',quantity:String(input.quantity),region:input.region}
  };
}

// Only call after verifying the webhook signature on its raw body.
// The durable order service must also enforce unique session/payment IDs.
export function paidSessionMatchesOrder(session, order) {
  return Boolean(session && order && session.mode === 'payment' && session.payment_status === 'paid'
    && session.currency === 'eur' && session.amount_total === order.totalCents
    && session.id === order.stripeSessionId && session.metadata?.order_id === order.id);
}
