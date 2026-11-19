import {encryptPayload,decryptPayload} from './inquiries.mjs';
import {randomToken,sha256,constantEqual,passwordHash,passwordValid,strongPassword,newTotpSecret,totpStep} from './admin-crypto.mjs';
export class AdminError extends Error{constructor(status,message){super(message);this.status=status;}}
export const fail=(status,message)=>{throw new AdminError(status,message);};
export const query=(env,sql,...values)=>env.DB.prepare(sql).bind(...values);
export const rows=async(env,sql,...values)=>(await query(env,sql,...values).all()).results;
export const changed=result=>Number(result?.meta?.changes??result?.changes??0);
export const isFull=user=>['owner','developer'].includes(user.role);
export const audit=(env,user,action,entity)=>query(env,'INSERT INTO admin_audit(id,actor_id,action,entity,created_at) VALUES(?,?,?,?,?)',crypto.randomUUID(),user?.id||null,action,String(entity).slice(0,150),new Date().toISOString()).run();
export async function limit(env,key,max=8,window=900000){
  const bucket=Math.floor(Date.now()/window);const fingerprint=await sha256(env.RATE_LIMIT_SECRET+':'+key);
  const record=await query(env,'INSERT INTO admin_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',fingerprint+':'+bucket,Date.now()+window).first();
  if(!record||record.count>max)fail(429,'Too many attempts. Try again later.');
}
const sessionLife=local=>local?7*86400000:28800000;
const idleLife=local=>local?7*86400000:1800000;
function cookieName(local){return local?'altavia_admin':'__Host-altavia_admin';}
export function sessionCookie(token,local,remove=false){return `${cookieName(local)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${remove?0:sessionLife(local)/1000}${local?'':'; Secure'}`;}
const csrfFor=(token,env)=>sha256('csrf:'+token+':'+env.RATE_LIMIT_SECRET);
export async function createSession(env,user,local){
  const now=Date.now(),token=randomToken(),csrf=await csrfFor(token,env);
  await env.DB.batch([
    query(env,'DELETE FROM admin_sessions WHERE expires_at<? OR last_seen<?',now,now-idleLife(local)),
    query(env,'INSERT INTO admin_sessions(token_hash,user_id,csrf_hash,created_at,last_seen,expires_at,auth_at) VALUES(?,?,?,?,?,?,?)',await sha256(token),user.id,await sha256(csrf),now,now,now+sessionLife(local),now)
  ]);
  return {csrf,cookie:sessionCookie(token,local)};
}
export async function sessionFor(request,env,local){
  const cookies=request.headers.get('cookie')||'';const token=cookies.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName(local)+'='))?.slice(cookieName(local).length+1);
  if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
  const session=await query(env,'SELECT s.*,u.username,u.role,u.password_hash,u.must_change,u.enabled,u.totp_secret,u.totp_pending,u.totp_last_step,u.id FROM admin_sessions s JOIN admin_users u ON u.id=s.user_id WHERE s.token_hash=?',await sha256(token)).first();
  if(!session||!session.enabled||session.expires_at<Date.now()||session.last_seen<Date.now()-idleLife(local))return null;
  if(session.last_seen<Date.now()-60000)await query(env,'UPDATE admin_sessions SET last_seen=? WHERE token_hash=?',Date.now(),session.token_hash).run();
  return {...session,csrf:await csrfFor(token,env)};
}
export function safeUser(user,local=false){return {id:user.id,username:user.username,role:user.role,mustChangePassword:!local&&Boolean(user.must_change),mfaEnabled:Boolean(user.totp_secret),mfaRequired:!local,passwordMinLength:local?8:12,localLogin:local};}
export function ready(user,local=false){if(!local&&(user.must_change||!user.totp_secret))fail(428,'Complete password and two-factor setup first.');}
export async function verifyFactor(env,user,code){
  if(!user.totp_secret)return false;
  if(/^\d{6}$/.test(String(code))){
    const {secret}=await decryptPayload(user.totp_secret,env.INQUIRY_ENCRYPTION_KEY);
    const step=await totpStep(secret,String(code),user.totp_last_step);
    if(step===null)return false;
    return changed(await query(env,'UPDATE admin_users SET totp_last_step=? WHERE id=? AND totp_last_step<?',step,user.id,step).run())===1;
  }
  const normalized=typeof code==='string'?code.replaceAll('-','').toLowerCase():'';
  if(!/^[a-f0-9]{20}$/.test(normalized))return false;
  return changed(await query(env,'DELETE FROM admin_recovery WHERE user_id=? AND code_hash=?',user.id,await sha256(user.id+':'+normalized)).run())===1;
}
export async function reauthenticate(env,user,body,local=false){
  await limit(env,'reauth:'+user.id,5,300000);
  if(!await passwordValid(body.currentPassword,user.password_hash)||(!local&&!await verifyFactor(env,user,body.code)))fail(403,local?'Current password is incorrect.':'Current password and a fresh authenticator/recovery code are required.');
}
export async function handleAuth(path,method,body,ctx){
  const {env,user,local,ip}=ctx;
  if(path==='login'&&method==='GET')return {body:{localLogin:local,passwordMinLength:local?8:12,mfaRequired:!local}};
  if(path==='login'&&method==='POST'){
    await limit(env,'login-ip:'+ip,15);const username=String(body.username||'').trim().toLowerCase();await limit(env,'login-user:'+username,8);
    const account=await query(env,'SELECT * FROM admin_users WHERE username=?',username).first();
    const dummy='pbkdf2-sha256$600000$11111111111111111111111111111111$'+'0'.repeat(64);
    const valid=await passwordValid(body.password,account?.password_hash||dummy);
    if(!account||!valid||!account.enabled)fail(401,local?'Incorrect username or password.':'Sign-in failed. Check your credentials and code.');
    if(!local&&account.totp_secret&&!await verifyFactor(env,account,body.code))fail(401,'Sign-in failed. Check your credentials and code.');
    const session=await createSession(env,account,local);await audit(env,account,'login','session');
    return {body:{user:safeUser(account,local),csrf:session.csrf},cookie:session.cookie};
  }
  if(!user)fail(401,'Sign in to continue.');
  if(path==='session'&&method==='GET')return {body:{user:safeUser(user,local),csrf:user.csrf}};
  if(path==='logout'&&method==='POST'){await query(env,'DELETE FROM admin_sessions WHERE token_hash=?',user.token_hash).run();return {body:{ok:true},cookie:sessionCookie('',local,true)};}
  if(path==='password'&&method==='POST'){
    await limit(env,'password:'+user.id,5,300000);
    if(!await passwordValid(body.currentPassword,user.password_hash))fail(403,'Current password is incorrect.');
    if(!local&&user.totp_secret&&!await verifyFactor(env,user,body.code))fail(403,'A fresh authenticator or recovery code is required.');
    if(!strongPassword(body.password,local?8:12)||await passwordValid(body.password,user.password_hash))fail(422,`Choose a different password of ${local?8:12}–128 characters.`);
    const updatedPassword=await query(env,'UPDATE admin_users SET password_hash=?,must_change=0,updated_at=? WHERE id=? AND password_hash=? RETURNING id',await passwordHash(body.password),new Date().toISOString(),user.id,user.password_hash).first();
    if(!updatedPassword)fail(409,'Credentials changed. Sign in again.');
    await query(env,'DELETE FROM admin_sessions WHERE user_id=?',user.id).run();
    const updated={...user,must_change:0};const session=await createSession(env,updated,local);await audit(env,user,'password_changed','account');return {body:{ok:true,user:safeUser(updated,local),csrf:session.csrf},cookie:session.cookie};
  }
  if(path==='mfa/start'&&method==='POST'){
    if(!local&&user.must_change)fail(428,'Change your initial password first.');if(user.totp_secret)fail(409,'Two-factor authentication is already enabled.');
    await limit(env,'mfa-start:'+user.id,5,300000);const secret=newTotpSecret();await query(env,'UPDATE admin_users SET totp_pending=? WHERE id=?',await encryptPayload({secret},env.INQUIRY_ENCRYPTION_KEY),user.id).run();
    return {body:{secret,uri:`otpauth://totp/Altavia:${encodeURIComponent(user.username)}?secret=${secret}&issuer=Altavia&algorithm=SHA1&digits=6&period=30`}};
  }
  if(path==='mfa/confirm'&&method==='POST'){
    if((!local&&user.must_change)||user.totp_secret||!user.totp_pending)fail(409,'Start two-factor setup first.');await limit(env,'mfa-confirm:'+user.id,5,300000);
    const {secret}=await decryptPayload(user.totp_pending,env.INQUIRY_ENCRYPTION_KEY);const step=await totpStep(secret,String(body.code));if(step===null)fail(403,'Authenticator code is invalid.');
    const codes=Array.from({length:10},()=>randomToken(10));const statements=[];
    for(const code of codes)statements.push(query(env,'INSERT INTO admin_recovery(user_id,code_hash) VALUES(?,?)',user.id,await sha256(user.id+':'+code)));
    const enrolled=await query(env,'UPDATE admin_users SET totp_secret=totp_pending,totp_pending=NULL,totp_last_step=?,updated_at=? WHERE id=? AND totp_secret IS NULL AND totp_pending=? RETURNING id',step,new Date().toISOString(),user.id,user.totp_pending).first();
    if(!enrolled)fail(409,'Authenticator setup changed. Sign in again.');
    await env.DB.batch([query(env,'DELETE FROM admin_recovery WHERE user_id=?',user.id),...statements,query(env,'DELETE FROM admin_sessions WHERE user_id=?',user.id)]);
    const updated={...user,totp_secret:user.totp_pending};const session=await createSession(env,updated,local);await audit(env,user,'mfa_enabled','account');return {body:{user:safeUser(updated,local),csrf:session.csrf,recoveryCodes:codes.map(c=>c.toUpperCase().match(/.{1,5}/g).join('-'))},cookie:session.cookie};
  }
  return null;
}
