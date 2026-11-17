import pg from 'pg';
import {readFile} from 'node:fs/promises';
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required.');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const c=await pool.connect();try{await c.query('BEGIN');await c.query(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));await c.query('COMMIT');console.log('Commerce schema ready; initial stock is zero.');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await pool.end();}
