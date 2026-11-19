const LIMIT=16384;
const json=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
export const schemaSQL=`CREATE TABLE IF NOT EXISTS inquiries (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, payload TEXT NOT NULL, fingerprint TEXT NOT NULL, intent TEXT NOT NULL DEFAULT 'interested' CHECK(intent IN ('interested','ready-to-pay','needs-info')));
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS inquiry_expiry ON inquiries(expires_at);`;
export function validateInquiry(raw,now=new Date()) {
  const errors={}; const value={};
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return {errors:{form:'invalid'}};
  const text=(key,max,required=false)=>{const v=raw[key];if(v===undefined||v===null||v===''){if(required)errors[key]='required';value[key]='';return;}if(typeof v!=='string'||v.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v)){errors[key]='invalid';return;}value[key]=v.trim();if(required&&!value[key])errors[key]='required';};
  text('name',100,true);text('email',254,true);text('phone',40);text('departure',100);text('requirements',3000);text('tour',100);text('date',10);text('plan',4000);
  if(value.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))errors.email='invalid';
  if(value.phone&&!/^[+0-9()\s.-]{5,40}$/.test(value.phone))errors.phone='invalid';
  if(value.date){const d=new Date(value.date+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(value.date)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value.date||value.date<now.toISOString().slice(0,10))errors.date='invalid';}
  for(const [key,min,max] of [['adults',1,50],['children',0,30]]){const n=raw[key];if(typeof n!=='number'||!Number.isInteger(n)||n<min||n>max)errors[key]='invalid';else value[key]=n;}
  if(raw.budget!==''&&raw.budget!==null&&raw.budget!==undefined){if(typeof raw.budget!=='number'||!Number.isFinite(raw.budget)||raw.budget<0||raw.budget>1000000)errors.budget='invalid';else value.budget=raw.budget;}else value.budget=null;
  if(!['uz','en','ru','ky','tg'].includes(raw.language))errors.language='invalid';else value.language=raw.language;
  if(!['email','phone','whatsapp','telegram'].includes(raw.messaging))errors.messaging='invalid';else value.messaging=raw.messaging;
  if(['phone','whatsapp'].includes(raw.messaging)&&!value.phone)errors.phone='required';
  text('messagingHandle',100);if(raw.messaging==='telegram'&&!value.messagingHandle)errors.messagingHandle='required';
  if(raw.consent!==true)errors.consent='required';else value.consent=true;
  if(typeof raw.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw.requestId))errors.requestId='invalid';else value.requestId=raw.requestId;
  const intent=raw.intent??'interested';if(!['interested','ready-to-pay','needs-info'].includes(intent))errors.intent='invalid';else value.intent=intent;
  value.privacyVersion='2026-11-18';
  return {value,errors};
}
const enc=new TextEncoder();
const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export async function encryptPayload(payload,keyText){const key=await crypto.subtle.importKey('raw',unb64(keyText),'AES-GCM',false,['encrypt']);const iv=crypto.getRandomValues(new Uint8Array(12));const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(JSON.stringify(payload)));return b64(iv)+'.'+b64(data);}
export async function decryptPayload(payload,keyText){const [iv,data]=payload.split('.');const key=await crypto.subtle.importKey('raw',unb64(keyText),'AES-GCM',false,['decrypt']);return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv)},key,unb64(data))));}
async function digest(s){return b64(await crypto.subtle.digest('SHA-256',enc.encode(s)));}
async function hashIP(ip,secret){const k=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64(await crypto.subtle.sign('HMAC',k,enc.encode(ip)));}
export function configured(env,local=false){try{return Boolean(env.DB&&unb64(env.INQUIRY_ENCRYPTION_KEY||'').length===32&&env.RATE_LIMIT_SECRET?.length>=32&&(local||(env.TURNSTILE_SECRET_KEY&&env.TURNSTILE_SITE_KEY&&env.SITE_URL&&new URL(env.SITE_URL).protocol==='https:'&&env.BUSINESS_READY==='true')));}catch{return false;}}
export async function handleInquiry(request,env,options={}){
  const local=options.local===true;
  if(request.method!=='POST')return json({error:'method'},405,{'Allow':'POST'});
  let expected;try{expected=new URL(env.SITE_URL).origin;}catch{return json({error:'unavailable'},503);}
  if(request.headers.get('origin')!==expected||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'origin'},403);
  if(!local&&new URL(request.url).protocol!=='https:')return json({error:'https'},403);
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return json({error:'content-type'},415);
  if(Number(request.headers.get('content-length'))>LIMIT)return json({error:'size'},413);
  if(!configured(env,local))return json({error:'unavailable'},503);
  let raw;
  try{const reader=request.body?.getReader();if(!reader)return json({error:'invalid'},400);let size=0,parts=[];while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>LIMIT){await reader.cancel();return json({error:'size'},413);}parts.push(value);}const bytes=new Uint8Array(size);let n=0;for(const p of parts){bytes.set(p,n);n+=p.length;}raw=JSON.parse(new TextDecoder().decode(bytes));}catch{return json({error:'invalid'},400);}
  if(raw?.website)return json({error:'invalid'},400);
  const {value,errors}=validateInquiry(raw);
  if(Object.keys(errors).length)return json({error:'validation',fields:errors},422);
  try{
    const now=Date.now();const bucket=Math.floor(now/900000);const key=await hashIP(options.ip||request.headers.get('cf-connecting-ip')||'unknown',env.RATE_LIMIT_SECRET)+':'+bucket;
    const rate=await env.DB.prepare('INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,now+900000).first();
    if(!rate||rate.count>5)return json({error:'rate'},429,{'Retry-After':'900'});
    if(!local){
      if(typeof raw.turnstileToken!=='string'||raw.turnstileToken.length>2048)return json({error:'challenge'},403);
      const response=await (options.fetch||fetch)('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env.TURNSTILE_SECRET_KEY,response:raw.turnstileToken}),signal:AbortSignal.timeout(8000)});
      const check=await response.json();
      if(!check.success||check.hostname!==new URL(env.SITE_URL).hostname||check.action!=='inquiry')return json({error:'challenge'},403);
    }
    const fingerprint=await digest(JSON.stringify(value));
    const existing=await env.DB.prepare('SELECT fingerprint FROM inquiries WHERE id=?').bind(value.requestId).first();
    if(existing){if(existing.fingerprint!==fingerprint)return json({error:'conflict'},409);return json({saved:true,reference:value.requestId,mode:local?'local':'production'});}
    const created=new Date(now).toISOString(); const expires=new Date(now+90*86400000).toISOString();
    const payload=await encryptPayload(value,env.INQUIRY_ENCRYPTION_KEY);
    // D1 batch is transactional. An error never produces a success receipt.
    await env.DB.batch([
      env.DB.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(now),
      env.DB.prepare('DELETE FROM inquiries WHERE expires_at < ?').bind(created),
      env.DB.prepare('INSERT INTO inquiries (id,created_at,expires_at,payload,fingerprint,intent) VALUES (?,?,?,?,?,?)').bind(value.requestId,created,expires,payload,fingerprint,value.intent)
    ]);
    return json({saved:true,reference:value.requestId,mode:local?'local':'production'},201);
  }catch{return json({error:'unavailable'},503);}
}
