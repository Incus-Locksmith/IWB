import {checkoutParameters,paidSessionMatchesOrder} from './checkout.mjs';
import {reserveOrder,bindSession,transaction,audit,ShopError} from './store.mjs';
export async function createCheckout({db,stripe,config},input,key){
 const order=await reserveOrder(db,input,config,key);
 if(!['creating','pending'].includes(order.status))throw new ShopError('This checkout has already ended. Please start a new order.',409);
 let session;
 if(order.stripe_session_id)session=await stripe.checkout.sessions.retrieve(order.stripe_session_id);
 else {
  if(Number(order.expires_at)<Math.floor(Date.now()/1000)+60)throw new ShopError('This checkout needs reconciliation before it can be retried.',409);
  const params=checkoutParameters(input,config);params.client_reference_id=order.id;params.metadata.order_id=order.id;params.expires_at=Number(order.expires_at);
  // Keep the reservation on errors: a timeout may still have created a payable session.
  session=await stripe.checkout.sessions.create(params,{idempotencyKey:'iwb-'+order.id});
  await bindSession(db,order,session);
 }
 if(session.livemode!==false)throw new Error('Only Stripe test sessions are permitted in this development build.');
 if(session.status!=='open'||!session.url)throw new ShopError('This checkout is no longer available.',409);
 const url=new URL(session.url);if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw new Error('Unexpected payment URL');
 return {url:session.url};
}
export async function processStripeEvent({db,stripe,config},event){
 if(event.livemode!==false)throw new ShopError('Live events are not enabled.',400);
 const sessionEvents=['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.expired','checkout.session.async_payment_failed'];
 if(!sessionEvents.includes(event.type)&&event.type!=='charge.refunded')return;
 // Retrieve canonical current state to handle duplicate and out-of-order deliveries.
 const obj=event.type==='charge.refunded'?await stripe.charges.retrieve(event.data.object.id):await stripe.checkout.sessions.retrieve(event.data.object.id);
 if(obj.livemode!==false)throw new Error('Unexpected live object');
 await transaction(db,async c=>{
  const claimed=await c.query('INSERT INTO stripe_events(id,type) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id',[event.id,event.type]);if(!claimed.rows.length)return;
  if(event.type==='charge.refunded'){
   const row=(await c.query('SELECT * FROM orders WHERE payment_intent_id=$1 FOR UPDATE',[obj.payment_intent])).rows[0];
   // Retry if the refund raced with the original payment webhook.
   if(!row)throw new Error('Refund received before order payment was recorded');
   if(obj.currency!=='eur'||obj.amount!==row.total_cents||obj.amount_refunded<0||obj.amount_refunded>row.total_cents)throw new Error('Refund amount mismatch');
   await c.query('UPDATE orders SET refunded_cents=GREATEST(refunded_cents,$2),version=version+1,updated_at=now() WHERE id=$1',[row.id,obj.amount_refunded]);
   await audit(c,row.id,'refund_recorded','stripe',{amount_cents:obj.amount_refunded});return;
  }
  const id=obj.metadata?.order_id;if(!id||!isUUID(id))throw new Error('Missing order reference');
  const row=(await c.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!row)throw new Error('Order reference not found');
  if(row.stripe_session_id&&row.stripe_session_id!==obj.id)throw new Error('Session reference mismatch');
  // The webhook can arrive before the create-session request stores the session ID.
  const linked={id:row.id,totalCents:row.total_cents,stripeSessionId:row.stripe_session_id||obj.id};
  if(obj.client_reference_id!==row.id)throw new Error('Client reference mismatch');
  if(paidSessionMatchesOrder(obj,linked)){
   if(typeof obj.payment_intent!=='string'||!obj.payment_intent)throw new Error('Missing payment reference');
   if(['paid','packing','dispatched'].includes(row.status))return;
   const shipping=obj.collected_information?.shipping_details||obj.shipping_details;
   const country=shipping?.address?.country;
   if(!config.regions[row.region]?.countries.includes(country)||!row.reserved||!['creating','pending'].includes(row.status)){
    await c.query("UPDATE orders SET status='review',version=version+1,updated_at=now() WHERE id=$1",[row.id]);await audit(c,row.id,'payment_needs_review','stripe');return;
   }
   await c.query("UPDATE orders SET status='paid',reserved=false,stripe_session_id=$2,payment_intent_id=$3,customer_email=$4,delivery=$5,version=version+1,updated_at=now() WHERE id=$1",[row.id,obj.id,obj.payment_intent,obj.customer_details?.email||null,JSON.stringify(shipping)]);
   await c.query("INSERT INTO notification_outbox(order_id,kind) VALUES($1,'paid') ON CONFLICT DO NOTHING",[row.id]);await audit(c,row.id,'payment_verified','stripe');return;
  }
  if(obj.payment_status==='paid'){
   await c.query("UPDATE orders SET status='review',version=version+1,updated_at=now() WHERE id=$1",[row.id]);await audit(c,row.id,'payment_amount_mismatch','stripe');return;
  }
  // Never release based only on a local clock or an unverified client redirect.
  if(obj.status==='expired'&&obj.payment_status==='unpaid'&&row.reserved&&['creating','pending'].includes(row.status)){
   await c.query('UPDATE inventory SET available=available+$1 WHERE sku=$2',[row.quantity,'iwb-journal']);
   await c.query("UPDATE orders SET status='expired',reserved=false,stripe_session_id=$2,version=version+1,updated_at=now() WHERE id=$1",[row.id,obj.id]);await audit(c,row.id,'reservation_released','stripe');
  }
 });
}
export const isUUID=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
