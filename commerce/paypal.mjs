import {createHmac,timingSafeEqual} from 'node:crypto';
import {reserveOrder,transaction,audit,ShopError} from './store.mjs';
const cents=value=>{if(typeof value!=='string'||!/^\d+\.\d{2}$/.test(value))return NaN;return Number(value.replace('.',''));};
export const returnState=(id,config)=>createHmac('sha256',config.paypalStateSecret).update(id).digest('hex');
function validState(id,value,config){return typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)&&timingSafeEqual(Buffer.from(value),Buffer.from(returnState(id,config)));}
export function paypalParameters(order,config){
 const value=(order.total_cents/100).toFixed(2),shipping=((order.total_cents-3800)/100).toFixed(2);
 const returnUrl=new URL('/paypal-return/',config.storeOrigin);returnUrl.searchParams.set('order',order.id);returnUrl.searchParams.set('state',returnState(order.id,config));
 return {intent:'CAPTURE',purchase_units:[{reference_id:order.id,custom_id:order.id,invoice_id:order.id,payee:{merchant_id:config.paypalMerchantId},amount:{currency_code:'EUR',value,breakdown:{item_total:{currency_code:'EUR',value:'38.00'},shipping:{currency_code:'EUR',value:shipping}}},items:[{name:'I Will Bloom guided cancer support journal',sku:'iwb-journal',quantity:'1',category:'PHYSICAL_GOODS',unit_amount:{currency_code:'EUR',value:'38.00'}}]}],payment_source:{paypal:{experience_context:{brand_name:'I Will Bloom',user_action:'PAY_NOW',shipping_preference:'GET_FROM_FILE',return_url:returnUrl.href,cancel_url:new URL('/#shop',config.storeOrigin).href}}}};
}
export async function createPayPalCheckout({db,paypal,config},input,key){
 const order=await reserveOrder(db,input,{...config,paymentProvider:'paypal'},key);
 if(!['creating','pending'].includes(order.status))throw new ShopError('This checkout has ended. Please start again.',409);
 let remote;
 if(order.paypal_order_id)remote=await paypal.get(order.paypal_order_id);
 else{
  // Do not retry creation beyond the provider's idempotency window. Hold for review.
  if(Date.now()-new Date(order.created_at).getTime()>60*60*1000)throw new ShopError('This checkout needs reconciliation.',409);
  remote=await paypal.create(paypalParameters(order,config),order.id);
  await transaction(db,async c=>{const row=(await c.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[order.id])).rows[0];if(row.paypal_order_id&&row.paypal_order_id!==remote.id)throw new Error('PayPal reference mismatch');await c.query("UPDATE orders SET paypal_order_id=$2,status=CASE WHEN status='creating' THEN 'pending' ELSE status END WHERE id=$1",[order.id,remote.id]);});
 }
 if(!['CREATED','PAYER_ACTION_REQUIRED','APPROVED'].includes(remote.status))throw new ShopError('This PayPal checkout is no longer available.',409);
 const link=remote.links?.find(l=>['payer-action','approve'].includes(l.rel));if(!link)throw new Error('PayPal approval link missing');const url=new URL(link.href);if(url.protocol!=='https:'||url.hostname!=='www.sandbox.paypal.com')throw new Error('Unexpected PayPal URL');return {url:url.href,provider:'paypal'};
}
function matches(remote,row,config){const unit=remote.purchase_units?.[0];return remote.intent==='CAPTURE'&&remote.purchase_units?.length===1&&unit?.custom_id===row.id&&unit.reference_id===row.id&&unit.payee?.merchant_id===config.paypalMerchantId&&unit.amount?.currency_code==='EUR'&&cents(unit.amount?.value)===row.total_cents;}
export async function recordPayPalOrder({db,config},remote){
 return transaction(db,async c=>{const row=(await c.query("SELECT * FROM orders WHERE paypal_order_id=$1 AND payment_provider='paypal' FOR UPDATE",[remote.id])).rows[0];if(!row)throw new Error('PayPal order not linked');
  const unit=remote.purchase_units?.[0],captures=unit?.payments?.captures||[],capture=captures[0];
  if(['paid','packing','dispatched'].includes(row.status))return {status:row.status};
  if(remote.status!=='COMPLETED'||!capture||capture.status!=='COMPLETED')return {status:'pending'};
  const valid=matches(remote,row,config)&&captures.length===1&&capture.amount?.currency_code==='EUR'&&cents(capture.amount?.value)===row.total_cents&&capture.final_capture===true&&config.regions[row.region]?.countries.includes(unit.shipping?.address?.country_code)&&row.reserved&&['pending','creating'].includes(row.status);
  if(!valid){await c.query("UPDATE orders SET status='review',version=version+1,updated_at=now() WHERE id=$1",[row.id]);await audit(c,row.id,'paypal_payment_needs_review','paypal');return {status:'review'};}
  const address=unit.shipping.address;const delivery={name:unit.shipping.name?.full_name||'',address:{line1:address.address_line_1,line2:address.address_line_2,city:address.admin_area_2,state:address.admin_area_1,postal_code:address.postal_code,country:address.country_code}};
  await c.query("UPDATE orders SET status='paid',reserved=false,paypal_capture_id=$2,customer_email=$3,delivery=$4,version=version+1,updated_at=now() WHERE id=$1",[row.id,capture.id,remote.payer?.email_address||null,JSON.stringify(delivery)]);await c.query("INSERT INTO notification_outbox(order_id,kind) VALUES($1,'paid') ON CONFLICT DO NOTHING",[row.id]);await audit(c,row.id,'paypal_payment_verified','paypal');return{status:'paid'};
 });
}
export async function capturePayPalCheckout(deps,input){
 if(!input||typeof input.paypalOrderId!=='string')throw new ShopError('PayPal order reference required.');
 const row=(await deps.db.query("SELECT * FROM orders WHERE paypal_order_id=$1 AND payment_provider='paypal'",[input.paypalOrderId])).rows[0];
 if(!row||!validState(row.id,input.state,deps.config))throw new ShopError('Invalid checkout return.',403);
 if(['paid','packing','dispatched'].includes(row.status))return {status:row.status};
 let remote=await deps.paypal.get(row.paypal_order_id);
 if(!matches(remote,row,deps.config))throw new ShopError('Payment details do not match the order.',409);
 const country=remote.purchase_units[0].shipping?.address?.country_code;
 if(!deps.config.regions[row.region]?.countries.includes(country))throw new ShopError('The delivery address does not match the selected postage region. Please contact us before paying.',409);
 if(!row.reserved||!['pending','creating'].includes(row.status))throw new ShopError('This order requires review.',409);
 if(remote.status==='APPROVED'){await deps.paypal.capture(row.paypal_order_id,row.id);remote=await deps.paypal.get(row.paypal_order_id);}
 return recordPayPalOrder(deps,remote);
}
export async function processPayPalWebhook(deps,event){
 if(!event?.id||!event.event_type)throw new ShopError('Invalid webhook.');
 if(event.event_type==='CHECKOUT.ORDER.APPROVED'){
  const row=(await deps.db.query("SELECT * FROM orders WHERE paypal_order_id=$1 AND payment_provider='paypal'",[event.resource?.id])).rows[0];
  if(!row)throw new Error('PayPal approval arrived before the order reference was stored');
  await capturePayPalCheckout(deps,{paypalOrderId:row.paypal_order_id,state:returnState(row.id,deps.config)});return;
 }
 const related=event.resource?.supplementary_data?.related_ids?.order_id;
 if(event.event_type==='PAYMENT.CAPTURE.COMPLETED'){
  if(!related)throw new Error('PayPal order reference missing');
  const remote=await deps.paypal.get(related);await recordPayPalOrder(deps,remote);return;
 }
 if(event.event_type==='PAYMENT.CAPTURE.REFUNDED'){
  const refund=await deps.paypal.getRefund(event.resource?.id);
  if(refund.status!=='COMPLETED')return;
  const up=refund.links?.find(l=>l.rel==='up');
  const url=new URL(up?.href||'https://invalid.test');
  const match=url.pathname.match(/^\/v2\/payments\/captures\/([A-Z0-9]{10,32})$/i);
  if(url.protocol!=='https:'||!['api.sandbox.paypal.com','api-m.sandbox.paypal.com'].includes(url.hostname)||!match)throw new Error('Refund capture reference missing');
  const captureId=match[1];
  await transaction(deps.db,async c=>{
   const row=(await c.query("SELECT * FROM orders WHERE paypal_capture_id=$1 AND payment_provider='paypal' FOR UPDATE",[captureId])).rows[0];
   if(!row)throw new Error('Refund arrived before payment reconciliation');
   const amount=cents(refund.amount?.value);if(refund.amount?.currency_code!=='EUR'||!Number.isSafeInteger(amount)||amount<=0||amount>row.total_cents)throw new Error('Refund amount mismatch');
   await c.query('INSERT INTO paypal_refunds(id,order_id,amount_cents) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[refund.id,row.id,amount]);
   const total=Number((await c.query('SELECT sum(amount_cents) AS total FROM paypal_refunds WHERE order_id=$1',[row.id])).rows[0].total);
   if(total>row.total_cents)throw new Error('Refund total exceeds order');
   await c.query('UPDATE orders SET refunded_cents=$2,version=version+1,updated_at=now() WHERE id=$1',[row.id,total]);
   const claimed=await c.query('INSERT INTO paypal_events(id,type) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id',[event.id,event.event_type]);
   if(claimed.rows.length)await audit(c,row.id,'paypal_refund_recorded','paypal',{amount_cents:amount});
  });return;
 }
 if(['PAYMENT.CAPTURE.REVERSED','PAYMENT.CAPTURE.DENIED','CUSTOMER.DISPUTE.CREATED'].includes(event.event_type)){
  // Hold fulfilment for operator reconciliation. Never infer a refund total from a partial event.
  const captureId=event.event_type==='CUSTOMER.DISPUTE.CREATED'?event.resource?.disputed_transactions?.[0]?.seller_transaction_id:event.resource?.id;
  const row=related?(await deps.db.query('SELECT * FROM orders WHERE paypal_order_id=$1',[related])).rows[0]:(await deps.db.query('SELECT * FROM orders WHERE paypal_capture_id=$1',[captureId])).rows[0];
  if(!row)throw new Error('PayPal payment requires manual reconciliation');
  await transaction(deps.db,async c=>{const claimed=await c.query('INSERT INTO paypal_events(id,type) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id',[event.id,event.event_type]);if(!claimed.rows.length)return;await c.query("UPDATE orders SET status='review',version=version+1,updated_at=now() WHERE id=$1",[row.id]);await audit(c,row.id,'paypal_payment_exception','paypal',{type:event.event_type});});
 }
}
