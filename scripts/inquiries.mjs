import { openLocalDatabase } from '../server/database.mjs';
import { decryptPayload } from '../server/inquiries.mjs';
const {sqlite,keys}=openLocalDatabase();
const [command,id]=process.argv.slice(2);
if(command==='list')console.table(sqlite.prepare('SELECT id,created_at,expires_at FROM inquiries ORDER BY created_at DESC').all());
else if(command==='read'&&id){const row=sqlite.prepare('SELECT payload FROM inquiries WHERE id=?').get(id);if(!row){console.error('Reference not found');process.exitCode=1;}else console.log(JSON.stringify(await decryptPayload(row.payload,keys.encryption),null,2));}
else if(command==='delete'&&id){sqlite.exec('BEGIN IMMEDIATE');try{const a=sqlite.prepare('DELETE FROM inquiries WHERE id=?').run(id),b=sqlite.prepare('DELETE FROM bookings WHERE id=?').run(id);sqlite.exec('COMMIT');console.log(`Deleted ${a.changes+b.changes} personal record(s).`);}catch(error){sqlite.exec('ROLLBACK');throw error;}}
else if(command==='purge'){const now=new Date().toISOString();const a=sqlite.prepare('DELETE FROM inquiries WHERE expires_at<?').run(now),b=sqlite.prepare('DELETE FROM bookings WHERE expires_at<?').run(now);console.log(`Purged ${a.changes+b.changes} expired personal record(s).`);}
else {console.log('Usage: npm run inquiries -- list | read <reference> | delete <reference> | purge');}
sqlite.close();
