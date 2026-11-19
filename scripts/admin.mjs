import {openLocalDatabase} from '../server/database.mjs';
import {passwordHash,strongPassword,sha256} from '../server/admin-crypto.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {emitKeypressEvents} from 'node:readline';
async function secretPrompt(){
  if(!process.stdin.isTTY)throw new Error('Use an interactive terminal, or --stdin-json for a private automation pipe.');
  process.stdout.write('Password (input hidden): ');emitKeypressEvents(process.stdin);process.stdin.setRawMode(true);process.stdin.resume();
  return new Promise((success,failure)=>{let value='';const listener=(text,key)=>{if(key?.ctrl&&key.name==='c'){cleanup();failure(new Error('Cancelled'));}else if(key?.name==='return'){cleanup();process.stdout.write('\n');success(value);}else if(key?.name==='backspace')value=value.slice(0,-1);else if(text&&!key?.ctrl)value+=text;};const cleanup=()=>{process.stdin.removeListener('keypress',listener);process.stdin.setRawMode(false);process.stdin.pause();};process.stdin.on('keypress',listener);});
}
const args=process.argv.slice(2),command=args[0]||'help';const arg=name=>args[args.indexOf(name)+1];
let input={};if(args.includes('--stdin-json')){let text='';for await(const chunk of process.stdin)text+=chunk;input=JSON.parse(text);}
const username=String(input.username||(args.includes('--username')?arg('--username'):'developer')).toLowerCase();
if(!/^[a-z0-9][a-z0-9_.-]{2,39}$/.test(username))throw new Error('Invalid username.');
if(['bootstrap','recover','bootstrap-sql'].includes(command)){
  const password=input.password||await secretPrompt();const initial=command==='bootstrap'||command==='bootstrap-sql';
  if(typeof password!=='string'||password.length>128||(!initial&&!strongPassword(password,8))||(initial&&password.length<8))throw new Error('Initial passwords need 8+ characters; recovery passwords need 8+.');
  const hash=await passwordHash(password),id=crypto.randomUUID(),now=new Date().toISOString();
  if(command==='bootstrap-sql'){
    await mkdir('.local',{recursive:true});const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
    const sql=`INSERT INTO admin_users(id,username,role,password_hash,must_change,created_at,updated_at) SELECT ${[id,username,'developer',hash,1,now,now].map(quote).join(',')} WHERE NOT EXISTS(SELECT 1 FROM admin_users);\n`;
    await writeFile('.local/admin-bootstrap.sql',sql,{mode:0o600});console.log('Wrote private .local/admin-bootstrap.sql. Apply it only to the intended D1 database after migrations.');
  }else{
    const {sqlite,keys}=openLocalDatabase(process.env.INQUIRY_DATA_DIR);try{
      if(command==='bootstrap'){
        if(sqlite.prepare('SELECT count(*) AS n FROM admin_users').get().n)throw new Error('An account already exists. Bootstrap did not overwrite it.');
        sqlite.prepare('INSERT INTO admin_users(id,username,role,password_hash,must_change,created_at,updated_at) VALUES(?,?,?,?,1,?,?)').run(id,username,'developer',hash,now,now);console.log(`Created ${username} with developer access. Local sign-in uses this password; production requires password change and two-factor setup.`);
      }else{
        const user=sqlite.prepare('SELECT id FROM admin_users WHERE username=?').get(username);if(!user)throw new Error('User not found.');sqlite.exec('BEGIN IMMEDIATE');try{sqlite.prepare('UPDATE admin_users SET password_hash=?,must_change=1,totp_secret=NULL,totp_pending=NULL,totp_last_step=-1,enabled=1,updated_at=? WHERE id=?').run(hash,now,user.id);sqlite.prepare('DELETE FROM admin_sessions WHERE user_id=?').run(user.id);sqlite.prepare('DELETE FROM admin_recovery WHERE user_id=?').run(user.id);for(const key of ['login-user:'+username,...['127.0.0.1','::ffff:127.0.0.1','::1'].map(ip=>'login-ip:'+ip)])sqlite.prepare('DELETE FROM admin_limits WHERE key LIKE ?').run(await sha256(keys.rate+':'+key)+':%');sqlite.exec('COMMIT');}catch(error){sqlite.exec('ROLLBACK');throw error;}console.log('Password reset locally; sign in with this password. All previous sessions revoked.');
      }
    }finally{sqlite.close();}
  }
}else console.log('Commands: npm run admin -- bootstrap | recover --username NAME | bootstrap-sql\nPasswords are prompted privately. Production has no built-in default credentials.');
