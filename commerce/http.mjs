import {createPayPalCheckout,capturePayPalCheckout,processPayPalWebhook} from './paypal.mjs';
import {createServer} from 'node:http';
import {timingSafeEqual,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createCheckout,processStripeEvent,isUUID} from './service.mjs';
import {updateFulfilment,ShopError,transaction} from './store.mjs';
const files={'/admin/':['admin.html','text/html; charset=utf-8'],'/admin/admin.mjs':['admin.mjs','text/javascript; charset=utf-8'],'/admin/admin.css':['admin.css','text/css; charset=utf-8']};
const digest=s=>createHash('sha256').update(s).digest();
export function makeServer(deps){const {db,stripe,config,webhookSecret}=deps;const limits=new Map();
 function limited(req,route,max){const key=route+':'+req.socket.remoteAddress,now=Date.now();if(limits.size>10000)for(const [k,v]of limits)if(v.until<now)limits.delete(k);if(limits.size>20000)throw new ShopError('Please try again later.',429);let entry=limits.get(key);if(!entry||entry.until<now){entry={until:now+60000,count:0};limits.set(key,entry);}if(++entry.count>max)throw new ShopError('Please try again shortly.',429);}
 function admin(req){limited(req,'admin',120);if(!timingSafeEqual(digest(req.headers.authorization||''),digest('Bearer '+config.adminToken)))throw new ShopError('Sign in to continue.',401);if(req.headers.origin&&req.headers.origin!==config.adminOrigin)throw new ShopError('Origin not allowed.',403);}
 async function body(req){let size=0;const parts=[];for await(const part of req){size+=part.length;if(size>262144)throw new ShopError('Request too large.',413);parts.push(part);}return Buffer.concat(parts);}
 async function jsonBody(req){if(!req.headers['content-type']?.startsWith('application/json'))throw new ShopError('JSON content type required.',415);try{return JSON.parse((await body(req)).toString());}catch(e){if(e instanceof ShopError)throw e;throw new ShopError('Invalid request.');}}
 return createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  try{
   const path=new URL(req.url,'http://localhost').pathname;
   if(req.method==='GET'&&path==='/health')return send(200,{ok:true,mode:'test',checkoutEnabled:config.checkoutEnabled});
   if(req.method==='GET'&&files[path]){const [file,type]=files[path];res.writeHead(200,{'Content-Type':type});res.end(await readFile(new URL('./admin/'+file,import.meta.url)));return;}
   if(path==='/api/checkout'||path==='/api/paypal/capture'){
    if(req.headers.origin!==config.storeOrigin)throw new ShopError('Origin not allowed.',403);
    res.setHeader('Access-Control-Allow-Origin',config.storeOrigin);res.setHeader('Vary','Origin');
    if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','POST');res.setHeader('Access-Control-Allow-Headers','Content-Type,Idempotency-Key');res.writeHead(204);res.end();return;}
    if(req.method!=='POST')throw new ShopError('Method not allowed.',405);
    if(!config.checkoutEnabled)throw new ShopError('Checkout is not open yet.',503);
    limited(req,'checkout',20);if(path==='/api/paypal/capture'){if(config.paymentProvider!=='paypal')throw new ShopError('PayPal is not configured.',404);return send(200,await capturePayPalCheckout(deps,await jsonBody(req)));}const key=req.headers['idempotency-key'];if(!isUUID(key))throw new ShopError('A valid checkout request ID is required.');
    return send(200,await (config.paymentProvider==='paypal'?createPayPalCheckout:createCheckout)(deps,await jsonBody(req),key));
   }
   if(path==='/api/paypal/webhook'&&req.method==='POST'){
    if(config.paymentProvider!=='paypal'||!deps.paypal)throw new ShopError('PayPal is not configured.',404);
    const raw=await body(req);if(!await deps.paypal.verify(raw,req.headers))throw new ShopError('Invalid webhook signature.',400);
    let event;try{event=JSON.parse(raw.toString('utf8'));}catch{throw new ShopError('Invalid webhook.',400);}
    await processPayPalWebhook(deps,event);return send(200,{received:true});
   }
   if(path==='/api/stripe/webhook'&&req.method==='POST'){
    if(config.paymentProvider==='paypal')throw new ShopError('Stripe is not configured.',404);
    const raw=await body(req);let event;try{event=stripe.webhooks.constructEvent(raw,req.headers['stripe-signature'],webhookSecret);}catch{throw new ShopError('Invalid webhook signature.',400);}
    await processStripeEvent(deps,event);return send(200,{received:true});
   }
   if(path.startsWith('/api/admin/')){
    admin(req);
    if(req.method==='GET'&&path==='/api/admin/orders'){
     const rows=(await db.query('SELECT id,status,region,quantity,total_cents,refunded_cents,tracking,version,created_at FROM orders ORDER BY created_at DESC LIMIT 100')).rows;
     const stock=(await db.query('SELECT available FROM inventory WHERE sku=$1',['iwb-journal'])).rows[0];
     const pending=(await db.query("SELECT count(*)::int AS count FROM notification_outbox WHERE state='pending'")).rows[0];return send(200,{orders:rows,available:stock.available,pendingNotifications:pending.count});
    }
    const match=path.match(/^\/api\/admin\/orders\/([0-9a-f-]+)$/i);
    if(match&&isUUID(match[1])){
     if(req.method==='GET'){const row=(await db.query('SELECT * FROM orders WHERE id=$1',[match[1]])).rows[0];if(!row)throw new ShopError('Order not found.',404);const audit=(await db.query('SELECT action,actor,details,created_at FROM order_audit WHERE order_id=$1 ORDER BY id',[row.id])).rows;return send(200,{order:row,audit});}
     if(req.method==='PATCH'){const input=await jsonBody(req),version=Number(req.headers['if-match']);if(!Number.isInteger(version)||req.headers['if-match']===undefined)throw new ShopError('An order version is required.',428);return send(200,{order:await updateFulfilment(db,match[1],input,version)});}
    }
    if(path==='/api/admin/inventory'&&req.method==='POST'){
     const input=await jsonBody(req),key=req.headers['idempotency-key'];if(!isUUID(key))throw new ShopError('A stock request ID is required.');if(!Number.isInteger(input?.adjustment)||Math.abs(input.adjustment)>10000||input.adjustment===0||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>500)throw new ShopError('Enter a stock adjustment and reason.');
     const available=await transaction(db,async c=>{const claimed=await c.query('INSERT INTO inventory_audit(request_key,adjustment,reason) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id',[key,input.adjustment,input.reason.trim()]);if(!claimed.rows.length){const prior=(await c.query('SELECT adjustment,reason FROM inventory_audit WHERE request_key=$1',[key])).rows[0];if(prior.adjustment!==input.adjustment||prior.reason!==input.reason.trim())throw new ShopError('Stock request changed.',409);return (await c.query('SELECT available FROM inventory WHERE sku=$1',['iwb-journal'])).rows[0].available;}const row=(await c.query('UPDATE inventory SET available=available+$1 WHERE sku=$2 AND available+$1>=0 RETURNING available',[input.adjustment,'iwb-journal'])).rows[0];if(!row)throw new ShopError('Stock cannot be negative.',409);return row.available;});return send(200,{available});
    }
   }
   throw new ShopError('Not found.',404);
  }catch(e){if(!(e instanceof ShopError))console.error('Shop request failed:',e.code||e.constructor.name);send(e instanceof ShopError?e.status:500,{error:e instanceof ShopError?e.message:'We could not complete that request. Please try again.'});}
 });
}
