export function loadConfig(env=process.env){
 const config={paymentProvider:env.PAYMENT_PROVIDER||'stripe',paypalMerchantId:env.PAYPAL_MERCHANT_ID,paypalStateSecret:env.PAYPAL_STATE_SECRET,storeOrigin:env.STORE_ORIGIN||'https://www.iwillbloom.com',adminOrigin:env.ADMIN_ORIGIN||'',checkoutEnabled:env.CHECKOUT_ENABLED==='true',taxVerified:env.TAX_VERIFIED==='true',shippingVerified:env.SHIPPING_VERIFIED==='true',adminToken:env.ADMIN_TOKEN||'',regions:{}};
 if(env.SHIPPING_REGIONS_JSON)config.regions=JSON.parse(env.SHIPPING_REGIONS_JSON);
 if(!['stripe','paypal'].includes(config.paymentProvider))throw new Error('Unknown payment provider.');
 if(config.paymentProvider==='stripe'){
 if(!env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))throw new Error('This build requires a Stripe test secret key. Live payments are disabled in code.');
 if(!env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_'))throw new Error('A Stripe test webhook signing secret is required.');
 }else{
  if(env.PAYPAL_ENV!=='sandbox')throw new Error('Only PayPal sandbox is enabled in this development build.');
  if(!env.PAYPAL_CLIENT_ID||!env.PAYPAL_CLIENT_SECRET||!env.PAYPAL_WEBHOOK_ID||!config.paypalMerchantId||!config.paypalStateSecret||config.paypalStateSecret.length<32)throw new Error('PayPal sandbox credentials and a private return-state secret are required.');
 }
 if(config.adminToken.length<32)throw new Error('An admin token of at least 32 characters is required.');
 for(const name of ['storeOrigin','adminOrigin']){const u=new URL(config[name]);if(u.protocol!=='https:'||u.origin!==config[name])throw new Error('Configure exact HTTPS origins without paths.');}
 for(const [key,region] of Object.entries(config.regions)){
  if(!/^[a-z0-9-]{1,30}$/.test(key)||!region.displayName||!Number.isInteger(region.shippingCents)||region.shippingCents<0||!Array.isArray(region.countries)||!region.countries.length||!region.countries.every(c=>/^[A-Z]{2}$/.test(c)))throw new Error('Invalid shipping region configuration.');
 }
 return config;
}
