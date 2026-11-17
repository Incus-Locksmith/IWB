import Stripe from 'stripe';
import {paypalClient} from './paypal-client.mjs';
import pg from 'pg';
import {loadConfig} from './config.mjs';
import {makeServer} from './http.mjs';
const config=loadConfig();
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required.');
const db=new pg.Pool({connectionString:process.env.DATABASE_URL,max:10});
await db.query('SELECT 1');
const stripe=config.paymentProvider==='stripe'?new Stripe(process.env.STRIPE_SECRET_KEY,{maxNetworkRetries:2,timeout:20000}):null;
const paypal=config.paymentProvider==='paypal'?paypalClient({clientId:process.env.PAYPAL_CLIENT_ID,secret:process.env.PAYPAL_CLIENT_SECRET,webhookId:process.env.PAYPAL_WEBHOOK_ID}):null;
const server=makeServer({db,stripe,paypal,config,webhookSecret:process.env.STRIPE_WEBHOOK_SECRET});
server.requestTimeout=30000;server.headersTimeout=15000;
server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('I Will Bloom test commerce service ready.'));
async function stop(){server.close(async()=>{await db.end();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
