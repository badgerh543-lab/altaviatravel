import { DatabaseSync } from 'node:sqlite';
import { mkdirSync,existsSync,readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { schemaSQL } from './inquiries.mjs';
import { adminSchema } from './admin-schema.mjs';
export function openLocalDatabase(directory=resolve('.local')){
  mkdirSync(directory,{recursive:true,mode:0o700});const keyPath=resolve(directory,'keys.json');
  if(!existsSync(keyPath))writeFileSync(keyPath,JSON.stringify({encryption:randomBytes(32).toString('base64'),rate:randomBytes(48).toString('base64')}),{mode:0o600,flag:'wx'});
  const keys=JSON.parse(readFileSync(keyPath,'utf8'));const sqlite=new DatabaseSync(resolve(directory,'inquiries.sqlite'));sqlite.exec(schemaSQL);sqlite.exec(adminSchema);if(!sqlite.prepare('PRAGMA table_info(cms_state)').all().some(c=>c.name==='publishing_until'))sqlite.exec('ALTER TABLE cms_state ADD COLUMN publishing_until INTEGER NOT NULL DEFAULT 0');for(const table of ['inquiries','bookings'])if(!sqlite.prepare('PRAGMA table_info('+table+')').all().some(c=>c.name==='intent'))sqlite.exec("ALTER TABLE "+table+" ADD COLUMN intent TEXT NOT NULL DEFAULT 'interested' CHECK(intent IN ('interested','ready-to-pay','needs-info'))");sqlite.exec("CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL)");sqlite.exec('PRAGMA journal_mode=WAL;');sqlite.exec('PRAGMA foreign_keys=ON;');
  const prepared=(sql,args=[])=>({bind:(...values)=>prepared(sql,values),first:async()=>sqlite.prepare(sql).get(...args)||null,all:async()=>({results:sqlite.prepare(sql).all(...args)}),run:async()=>{const r=sqlite.prepare(sql).run(...args);return {...r,meta:{changes:r.changes}};},_sql:sql,_args:args});
  const DB={prepare:sql=>prepared(sql),async batch(statements){sqlite.exec('BEGIN IMMEDIATE');try{const r=statements.map(s=>{const result=sqlite.prepare(s._sql).run(...s._args);return {...result,meta:{changes:result.changes}};});sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
  return {DB,keys,sqlite};
}
