import {randomUUID} from 'node:crypto';
import {checkoutParameters} from './checkout.mjs';
export class ShopError extends Error {constructor(message,status=400){super(message);this.status=status;}}
export async function transaction(db,fn){const c=await db.connect();try{await c.query('BEGIN');const result=await fn(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
export async function audit(c,id,action,actor,details={}){await c.query('INSERT INTO order_audit(order_id,action,actor,details) VALUES($1,$2,$3,$4)',[id,action,actor,JSON.stringify(details)]);}
export async function reserveOrder(db,input,config,key){
  const params=checkoutParameters(input,config);
  const total=3800*input.quantity+params.shipping_options[0].shipping_rate_data.fixed_amount.amount;
  return transaction(db,async c=>{
    // Claim the idempotency key before stock. A concurrent duplicate waits for this row.
    const id=randomUUID(),expires=Math.floor(Date.now()/1000)+35*60;
    const inserted=await c.query('INSERT INTO orders(id,request_key,quantity,region,total_cents,expires_at,payment_provider) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(request_key) DO NOTHING RETURNING *',[id,key,input.quantity,input.region,total,expires,config.paymentProvider||'stripe']);
    if(!inserted.rows.length){const existing=(await c.query('SELECT * FROM orders WHERE request_key=$1 FOR UPDATE',[key])).rows[0];if(existing.payment_provider!==(config.paymentProvider||'stripe')||existing.quantity!==input.quantity||existing.region!==input.region||existing.total_cents!==total)throw new ShopError('This checkout request has changed. Please start again.',409);return existing;}
    const stock=await c.query('UPDATE inventory SET available=available-$1 WHERE sku=$2 AND available >= $1 RETURNING available',[input.quantity,'iwb-journal']);
    if(!stock.rows.length)throw new ShopError('The journal is currently out of stock.',409);
    await audit(c,id,'stock_reserved','checkout');return inserted.rows[0];
  });
}
export async function bindSession(db,order,session){
  return transaction(db,async c=>{const row=(await c.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[order.id])).rows[0];
    if(row.stripe_session_id&&row.stripe_session_id!==session.id)throw new Error('Checkout session mismatch');
    await c.query("UPDATE orders SET stripe_session_id=$2,status=CASE WHEN status='creating' THEN 'pending' ELSE status END,updated_at=now() WHERE id=$1",[order.id,session.id]);
  });
}
export async function updateFulfilment(db,id,input,version){
 return transaction(db,async c=>{const row=(await c.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!row)throw new ShopError('Order not found.',404);
  if(row.version!==version)throw new ShopError('This order changed. Refresh before updating.',409);
  if(row.refunded_cents>0||!({paid:'packing',packing:'dispatched'}[row.status]===input.status))throw new ShopError('This order cannot move to that status.',409);
  if(input.tracking!==undefined&&typeof input.tracking!=='string')throw new ShopError('Tracking must be text.');const tracking=input.tracking?.trim()||null;if(tracking&&tracking.length>500)throw new ShopError('Tracking information is too long.');
  const updated=(await c.query('UPDATE orders SET status=$2,tracking=COALESCE($3,tracking),version=version+1,updated_at=now() WHERE id=$1 RETURNING *',[id,input.status,tracking])).rows[0];
  await audit(c,id,'fulfilment_updated','admin',{from:row.status,to:input.status});
  if(input.status==='dispatched')await c.query("INSERT INTO notification_outbox(order_id,kind) VALUES($1,'dispatched') ON CONFLICT DO NOTHING",[id]);return updated;
 });
}
