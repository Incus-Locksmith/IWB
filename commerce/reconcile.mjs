// Manual recovery tool. Read-only Stripe calls; records only verified canonical results.
import Stripe from 'stripe';
import {paypalClient} from './paypal-client.mjs';
import {recordPayPalOrder} from './paypal.mjs';
import {transaction,audit} from './store.mjs';
import pg from 'pg';
import {loadConfig} from './config.mjs';
import {bindSession} from './store.mjs';
import {processStripeEvent} from './service.mjs';
export async function reconcile(deps){
 if(deps.config.paymentProvider==='paypal'){
  const rows=(await deps.db.query("SELECT * FROM orders WHERE payment_provider='paypal' AND status IN ('creating','pending') ORDER BY created_at LIMIT 100")).rows;
  const result={checked:rows.length,matched:0,unresolved:0};
  for(const row of rows){
   if(!row.paypal_order_id){result.unresolved++;continue;}
   const remote=await deps.paypal.get(row.paypal_order_id);
   if(remote.status==='VOIDED')await transaction(deps.db,async c=>{const current=(await c.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[row.id])).rows[0];if(current.reserved&&['creating','pending'].includes(current.status)){await c.query('UPDATE inventory SET available=available+$1 WHERE sku=$2',[row.quantity,'iwb-journal']);await c.query("UPDATE orders SET reserved=false,status='expired',version=version+1,updated_at=now() WHERE id=$1",[row.id]);await audit(c,row.id,'paypal_voided_reservation_released','paypal');}});
   else await recordPayPalOrder(deps,remote);
   result.matched++;
  }
  return result;
 }

 const rows=(await deps.db.query("SELECT * FROM orders WHERE payment_provider='stripe' AND status IN ('creating','pending') ORDER BY created_at LIMIT 100")).rows;
 const result={checked:rows.length,matched:0,unresolved:0};
 for(const row of rows){let session;
  if(row.stripe_session_id)session=await deps.stripe.checkout.sessions.retrieve(row.stripe_session_id);
  else{
   const created=Math.floor(new Date(row.created_at).getTime()/1000);
   // Search the original creation window; never create a second payable session.
   for await(const candidate of deps.stripe.checkout.sessions.list({created:{gte:created-60,lte:created+3600},limit:100})){
    if(candidate.client_reference_id===row.id&&candidate.metadata?.order_id===row.id){if(session)throw new Error('Multiple checkout sessions require manual review');session=candidate;}
   }
   if(session)await bindSession(deps.db,row,session);
  }
  if(!session){result.unresolved++;continue;}
  await processStripeEvent(deps,{id:'reconcile:'+session.id+':'+session.status+':'+session.payment_status,type:session.status==='expired'?'checkout.session.expired':'checkout.session.completed',livemode:false,data:{object:{id:session.id}}});result.matched++;
 }
 return result;
}
if(import.meta.url===new URL(process.argv[1]||'', 'file:').href){
 const config=loadConfig(),db=new pg.Pool({connectionString:process.env.DATABASE_URL});
 try{console.log(await reconcile({db,config,stripe:config.paymentProvider==='stripe'?new Stripe(process.env.STRIPE_SECRET_KEY):null,paypal:config.paymentProvider==='paypal'?paypalClient({clientId:process.env.PAYPAL_CLIENT_ID,secret:process.env.PAYPAL_CLIENT_SECRET,webhookId:process.env.PAYPAL_WEBHOOK_ID}):null}));}finally{await db.end();}
}
