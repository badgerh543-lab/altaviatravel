import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openLocalDatabase} from '../server/database.mjs';
import {handleAdmin,handleContentExport} from '../server/admin.mjs';
import {passwordHash,passwordValid,passwordBits,newTotpSecret,totpCode,sha256} from '../server/admin-crypto.mjs';
import {createSession} from '../server/admin-auth.mjs';
import {encryptPayload,decryptPayload,handleInquiry} from '../server/inquiries.mjs';
import {handleAppearance} from '../server/appearance.mjs';
import {createTourDetails} from '../shared/tour-details.mjs';
import {seedContent} from '../server/content-seed.mjs';
import {validateContent} from '../server/content-validation.mjs';
import {serveImage} from '../server/admin-media.mjs';
import retention from '../workers/retention.js';
import sharp from 'sharp';
import {DatabaseSync} from 'node:sqlite';
import {spawn} from 'node:child_process';
const origin='http://localhost:4322',password='Test-only-long-passphrase!';
async function fixture(t,local=true){
  const siteOrigin=local?origin:"https://travel.test";
  const directory=await mkdtemp(join(tmpdir(),'altavia-admin-'));
  const {DB,keys,sqlite}=openLocalDatabase(directory);
  t.after(async()=>{sqlite.close();await rm(directory,{recursive:true,force:true});});
  const env={DB,INQUIRY_ENCRYPTION_KEY:keys.encryption,RATE_LIMIT_SECRET:keys.rate,SITE_URL:siteOrigin,...(!local?{ADMIN_ENABLED:"true"}:{})};
  const auth={};const calls=[];
  async function user(role,setup=false){const id=crypto.randomUUID(),secret=newTotpSecret(),now=new Date().toISOString();const hash=await passwordHash(password);sqlite.prepare('INSERT INTO admin_users(id,username,role,password_hash,must_change,totp_secret,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').run(id,role,role,hash,setup?1:0,setup?null:await encryptPayload({secret},keys.encryption),now,now);const u=sqlite.prepare('SELECT * FROM admin_users WHERE id=?').get(id);const session=await createSession(env,u,local);auth[role]={id,secret,cookie:session.cookie.split(';')[0],csrf:session.csrf};return auth[role];}
  async function request(path,body,role='developer',extra={}){const a=auth[role]||{};const headers={...(a.cookie?{cookie:a.cookie}:{}),...(body===undefined?{}:{origin:siteOrigin,'Content-Type':'application/json','X-CSRF-Token':a.csrf||''}),...extra};return handleAdmin(new Request(siteOrigin+'/api/admin/'+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)}),env,{local,ip:'test',onPublish:async(data,revision)=>calls.push({data,revision})});}
  return {env,DB,sqlite,auth,user,request,calls,keys,directory};
}
test('password hashing and standard TOTP vectors',async()=>{
  const hash=await passwordHash(password);assert(!hash.includes(password));assert(await passwordValid(password,hash));assert(!await passwordValid('wrong',hash));
  assert.equal(await totpCode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',1),'287082');
});

test('local sign-in skips forced setup and existing TOTP, accepts eight characters and returns after browser reopening',async t=>{
  const f=await fixture(t);const account=await f.user('developer',true);
  assert.equal((await f.request('dashboard')).status,200);
  let response=await f.request('password',{currentPassword:password,password:'Local123'});assert.equal(response.status,200);
  const data=await response.json();assert.equal(data.user.passwordMinLength,8);assert.equal(data.user.mustChangePassword,false);assert.equal(data.user.mfaRequired,false);
  const secret=newTotpSecret();f.sqlite.prepare('UPDATE admin_users SET totp_secret=?,must_change=1 WHERE id=?').run(await encryptPayload({secret},f.keys.encryption),account.id);
  response=await f.request('login',{username:'developer',password:'Local123'},'none');assert.equal(response.status,200);
  assert(response.headers.get('set-cookie').includes('Max-Age=604800'));
  const login=await response.json();Object.assign(f.auth.developer,{cookie:response.headers.get('set-cookie').split(';')[0],csrf:login.csrf});
  f.sqlite.prepare('UPDATE admin_sessions SET last_seen=?').run(Date.now()-2*86400000);
  assert.equal((await f.request('dashboard')).status,200);
  assert.equal((await f.request('login',{username:'developer',password:'wrong'},'none')).status,401);
  assert.equal((await f.request('logout',{})).status,200);assert.equal((await f.request('session')).status,401);
});

test('production still requires MFA and stronger passwords and ignores client attempts to enable local mode',async t=>{
  const f=await fixture(t,false);const account=await f.user('developer');
  assert.deepEqual(await(await f.request('login',undefined,'none')).json(),{localLogin:false,passwordMinLength:12,mfaRequired:true});
  assert.equal((await f.request('login',{username:'developer',password,local:true,localLogin:true},'none')).status,401);
  const response=await f.request('login',{username:'developer',password,code:await totpCode(account.secret)},'none');assert.equal(response.status,200);
  const data=await response.json();assert.equal(data.user.mfaRequired,true);assert.equal(data.user.localLogin,false);assert(response.headers.get('set-cookie').includes('Max-Age=28800'));
  f.sqlite.prepare('UPDATE admin_users SET totp_last_step=-1 WHERE id=?').run(account.id);
  assert.equal((await f.request('password',{currentPassword:password,password:'Local123',code:await totpCode(account.secret)})).status,422);
  f.sqlite.prepare('UPDATE admin_sessions SET last_seen=?').run(Date.now()-31*60000);
  assert.equal((await f.request('dashboard')).status,401);
});

test('local recovery accepts eight characters, clears stale login limits and allows immediate sign-in without setup',async t=>{
  const f=await fixture(t);await f.user('developer');
  for(const key of ['login-user:developer','login-ip:127.0.0.1'])f.sqlite.prepare('INSERT INTO admin_limits(key,count,expires_at) VALUES(?,100,?)').run(await sha256(f.keys.rate+':'+key)+':'+Math.floor(Date.now()/900000),Date.now()+900000);
  const output=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['scripts/admin.mjs','recover','--username','developer','--stdin-json'],{env:{...process.env,INQUIRY_DATA_DIR:f.directory},stdio:['pipe','pipe','pipe']});let text='';child.stdout.on('data',chunk=>text+=chunk);child.stderr.on('data',chunk=>text+=chunk);child.on('error',reject);child.on('close',code=>code===0?resolve(text):reject(new Error(text)));child.stdin.end(JSON.stringify({password:'Local123'}));});
  assert(!String(output).includes('Local123'));assert.equal(f.sqlite.prepare('SELECT count(*) n FROM admin_sessions').get().n,0);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM admin_limits').get().n,0);
  assert.equal((await f.request('login',{username:'developer',password:'Local123'},'none')).status,200);
  assert.equal(f.sqlite.prepare('SELECT totp_secret FROM admin_users').get().totp_secret,null);
});
test('portable PBKDF2 preserves the 600,000-iteration result when Workers native hashing is capped',async()=>{
  const native=await passwordBits(password,'0123456789abcdef0123456789abcdef');
  const capped={importKey:crypto.subtle.importKey.bind(crypto.subtle),deriveBits:async()=>{throw new DOMException('Platform cap','NotSupportedError');}};
  const portable=await passwordBits(password,'0123456789abcdef0123456789abcdef',capped);assert.deepEqual(portable,native);
});
test('no default production account; HTTPS and explicit enable flag are required',async t=>{
  const f=await fixture(t);assert.equal((await handleAdmin(new Request('https://travel.test/api/admin/session'),f.env)).status,503);
  assert.equal((await f.request('session',undefined,'none')).status,401);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM admin_users').get().n,0);
});
test('cookie, same-origin, CSRF, method and setup boundaries',async t=>{
  const f=await fixture(t,false);await f.user('developer',true);
  assert.equal((await f.request('dashboard')).status,428);
  assert.equal((await f.request('logout',{},'developer',{'X-CSRF-Token':'wrong'})).status,403);
  assert.equal((await f.request('logout',{},'developer',{origin:'https://evil.test'})).status,403);
  assert.equal((await f.request('session',undefined,'developer',{'Sec-Fetch-Site':'cross-site'})).status,403);
  const cookie=(await createSession(f.env,{id:f.auth.developer.id},false)).cookie;assert(cookie.includes('__Host-altavia_admin='));assert(cookie.includes('HttpOnly'));assert(cookie.includes('SameSite=Strict'));assert(cookie.includes('Secure'));
  assert.equal((await handleAdmin(new Request(origin+'/api/admin/session',{method:'DELETE'}),f.env,{local:true})).status,405);
});
test('first login requires password rotation and TOTP; recovery works once and logout revokes',async t=>{
  const f=await fixture(t,false);await f.user('developer',true);const old=f.auth.developer.cookie;
  const changed=await f.request('password',{currentPassword:password,password:'Replacement-test-passphrase!'});assert.equal(changed.status,200);let data=await changed.json();Object.assign(f.auth.developer,{csrf:data.csrf,cookie:changed.headers.get('set-cookie').split(';')[0]});
  const start=await f.request('mfa/start',{});const {secret}=await start.json();const confirmed=await f.request('mfa/confirm',{code:await totpCode(secret)});assert.equal(confirmed.status,200);data=await confirmed.json();assert.equal(data.recoveryCodes.length,10);Object.assign(f.auth.developer,{csrf:data.csrf,cookie:confirmed.headers.get('set-cookie').split(';')[0]});
  assert.equal((await f.request('dashboard')).status,200);assert.equal((await f.request('session',undefined,'developer',{cookie:old})).status,401);
  const login={username:'developer',password:'Replacement-test-passphrase!',code:data.recoveryCodes[0]};assert.equal((await f.request('login',login,'none')).status,200);assert.equal((await f.request('login',login,'none')).status,401);
  assert.equal((await f.request('logout',{})).status,200);assert.equal((await f.request('dashboard')).status,401);
});
test('admin cannot reach owner content, users, payment credentials or audit',async t=>{
  const f=await fixture(t);await f.user('admin');for(const path of ['users','payments','audit'])assert.equal((await f.request(path,undefined,'admin')).status,403);
  assert.equal((await f.request('content/company',{action:'replace',item:{},revision:1},'admin')).status,403);
  const data=await (await f.request('content',undefined,'admin')).json();assert.deepEqual(data.allowedCollections,['tours']);assert(!data.collections.company);assert(!JSON.stringify(data).includes('password_hash'));
});
test('tour editing requires price/image, revision protection and catalog review before publishing',async t=>{
  const f=await fixture(t);await f.user('admin');let content=await(await f.request('content',undefined,'admin')).json();const tour=structuredClone(content.collections.tours[0]);
  assert.equal((await f.request('content/tours',{action:'upsert',item:{...tour,price:null},originalId:tour.slug,revision:1},'admin')).status,422);
  assert.equal((await f.request('content/tours',{action:'upsert',item:{...tour,image:''},originalId:tour.slug,revision:1},'admin')).status,422);
  tour.visible=false;assert.equal((await f.request('content/tours',{action:'upsert',item:tour,originalId:tour.slug,revision:1},'admin')).status,200);
  assert.equal((await f.request('content/tours',{action:'delete',originalId:tour.slug,revision:1},'admin')).status,409);
  assert.equal((await f.request('publish',{revision:2,visibleTours:[],reviewed:false},'admin')).status,422);
  const visible=content.collections.tours.slice(1).filter(t=>t.visible!==false).map(t=>t.slug);assert.equal((await f.request('publish',{revision:2,visibleTours:visible,reviewed:true},'admin')).status,200);assert.equal(f.calls.length,1);assert.equal(f.calls[0].data.tours[0].visible,false);
});
test('admin cannot publish pending owner changes',async t=>{
  const f=await fixture(t);await f.user('developer');await f.user('admin');const c=await(await f.request('content')).json();const company={...c.collections.company,name:'Owner change'};
  assert.equal((await f.request('content/company',{action:'replace',item:company,revision:c.revision})).status,200);
  assert.equal((await f.request('publish',{revision:2,reviewed:true,visibleTours:c.collections.tours.filter(t=>t.visible!==false).map(t=>t.slug)},'admin')).status,403);assert.equal(f.calls.length,0);
});
test('booking approval, verified sale, encrypted payment reference and locked totals',async t=>{
  const f=await fixture(t);await f.user('admin');const payload={name:'Test customer',email:'customer@example.test',date:'2026-01-01',adults:2,children:0,language:'en',messaging:'email',consent:true,tour:'dubai-escape'};
  let response=await f.request('bookings',{payload,status:'reserved',amount:1000,currency:'USD'},'admin');assert.equal(response.status,200);const {id}=await response.json();
  assert.equal((await f.request('bookings/'+id,{version:1,status:'sold',amount:1000,manualPaymentConfirmed:true,paymentReference:'TEST-1'},'admin')).status,409);
  assert.equal((await f.request('bookings/'+id,{version:1,status:'approved',amount:1000},'admin')).status,200);
  assert.equal((await f.request('bookings/'+id,{version:2,status:'sold',amount:1000},'admin')).status,422);
  assert.equal((await f.request('bookings/'+id,{version:2,status:'sold',amount:1000,manualPaymentConfirmed:true,paymentReference:'TEST-PAID-123'},'admin')).status,200);
  assert.equal((await f.request('bookings/'+id,{version:3,status:'sold',amount:1100},'admin')).status,409);
  assert.equal((await f.request('bookings/'+id,{version:3,payload,status:'sold',amount:1000,staffNote:'verified'},'admin')).status,200);
  const row=f.sqlite.prepare('SELECT * FROM bookings WHERE id=?').get(id);assert(!row.payload.includes('TEST-PAID'));assert.equal((await decryptPayload(row.payload,f.keys.encryption)).paymentReference,'TEST-PAID-123');
  const dashboard=await(await f.request('dashboard',undefined,'admin')).json();assert.equal(dashboard.revenue[0].amount_minor,100000);
});
test('payment preparation requires fresh authentication and never returns saved keys',async t=>{
  const f=await fixture(t,false);const a=await f.user('developer');const settings={mode:'sandbox',merchantId:'merchant-test',apiKey:'secret-test-provider-key'};
  assert.equal((await f.request('payments/payme',{settings})).status,403);
  assert.equal((await f.request('payments/payme',{settings,currentPassword:password,code:await totpCode(a.secret)})).status,200);
  const response=await f.request('payments');const text=await response.text();assert(!text.includes(settings.apiKey));assert(text.includes('merchant-test'));assert(text.includes('"liveEnabled":false'));
  assert(!f.sqlite.prepare('SELECT payload FROM merchant_settings').get().payload.includes(settings.apiKey));
});
test('public CMS export requires private bearer token and contains no staff data',async t=>{
  const f=await fixture(t);const env={...f.env,CMS_BUILD_TOKEN:'x'.repeat(48)};const url=origin+'/api/cms/export';assert.equal((await handleContentExport(new Request(url),env)).status,401);
  const response=await handleContentExport(new Request(url,{headers:{authorization:'Bearer '+env.CMS_BUILD_TOKEN}}),env);assert.equal(response.status,200);const data=await response.json();assert.equal(data.content.tours.length,13);assert(!JSON.stringify(data).includes('password_hash'));
});
test('invalid media, unsafe links and broken CMS structures are rejected',async t=>{
  const f=await fixture(t);await f.user('admin');await f.request('content',undefined,'admin');
  assert.equal((await f.request('upload',{revision:1,title:'Test',author:'Test',rightsConfirmed:true,images:[{size:480,data:btoa('<svg/>')}]},'admin')).status,422);
  assert.equal((await serveImage(new Request(origin+'/api/media/'+crypto.randomUUID()+'/960'),f.env)).status,404);
  for(const mutate of [d=>delete d.translations.home,d=>d.tours[0].image='missing',d=>d.hotels[0].url='javascript:alert(1)',d=>delete d.articles[0].sections[0].body]){const data=structuredClone(seedContent);mutate(data);assert(validateContent(data).length>0);}
});
test('expired sessions and personal records are removed by retention',async t=>{
  const f=await fixture(t);const a=await f.user('developer');f.sqlite.prepare('UPDATE admin_sessions SET expires_at=0').run();assert.equal((await f.request('dashboard')).status,401);
  await retention.scheduled({},f.env);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM admin_sessions').get().n,0);assert(a.id);
});

test('expired bookings cannot be opened for updates before scheduled retention cleanup',async t=>{
  const f=await fixture(t);await f.user('admin');const payload={name:'Expired fixture',email:'expired@example.test',date:'2027-06-20',adults:1,children:0,language:'en',messaging:'email',consent:true,tour:'dubai-escape'};
  const created=await f.request('bookings',{payload,status:'reserved'},'admin');assert.equal(created.status,200);const {id}=await created.json();
  f.sqlite.prepare('UPDATE bookings SET expires_at=? WHERE id=?').run('2000-01-01T00:00:00.000Z',id);
  assert.equal((await f.request('bookings/'+id,{version:1,status:'reserved',staffNote:'Should not be saved'},'admin')).status,404);
  assert.equal((await(await f.request('bookings',undefined,'admin')).json()).items.length,0);
});
test('responsive image upload is private until publishing and preserves exact WebP bytes',async t=>{
  const f=await fixture(t);await f.user('admin');const c=await(await f.request('content',undefined,'admin')).json();const images=[];
  for(const size of [480,960,1600])images.push({size,data:(await sharp({create:{width:600,height:400,channels:3,background:'#ff681f'}}).resize({width:size,withoutEnlargement:true}).webp().toBuffer()).toString('base64')});
  const uploaded=await f.request('upload',{revision:c.revision,title:'Synthetic test image',author:'Test fixture',rightsConfirmed:true,images},'admin');assert.equal(uploaded.status,200);const result=await uploaded.json();
  const url=origin+result.image.src;assert.equal((await serveImage(new Request(url),f.env)).status,404);
  const privateImage=await f.request(result.image.src.replace('/api/media/','media/'),undefined,'admin');assert.equal(privateImage.status,200);assert.deepEqual(Buffer.from(await privateImage.arrayBuffer()),Buffer.from(images[1].data,'base64'));
  const tour={...c.collections.tours[0],image:result.image.id};assert.equal((await f.request('content/tours',{revision:result.revision,action:'upsert',originalId:tour.slug,item:tour},'admin')).status,200);
  assert.equal((await f.request('publish',{revision:result.revision+1,visibleTours:c.collections.tours.filter(t=>t.visible!==false).map(t=>t.slug),reviewed:true},'admin')).status,200);
  const publicImage=await serveImage(new Request(url),f.env);assert.equal(publicImage.status,200);assert.equal(publicImage.headers.get('content-type'),'image/webp');assert.deepEqual(Buffer.from(await publicImage.arrayBuffer()),Buffer.from(images[1].data,'base64'));
});
test('full-access account management creates individual users and revokes disabled sessions',async t=>{
  const f=await fixture(t,false);const a=await f.user('developer');const target=await f.user('admin');const settings={username:'staff-person',role:'admin',password:'Temporary-staff-passphrase!',currentPassword:password,code:await totpCode(a.secret)};
  const created=await f.request('users',settings);assert.equal(created.status,200);const {id}=await created.json();const user=f.sqlite.prepare('SELECT * FROM admin_users WHERE id=?').get(id);assert.equal(user.must_change,1);assert.equal(user.totp_secret,null);assert(!user.password_hash.includes(settings.password));
  f.sqlite.prepare('UPDATE admin_users SET totp_last_step=-1 WHERE id=?').run(a.id);
  assert.equal((await f.request('users',{id:target.id,username:'admin',role:'admin',enabled:false,currentPassword:password,code:await totpCode(a.secret)})).status,200);assert.equal((await f.request('dashboard',undefined,'admin')).status,401);
});
test('concurrent publishing is rejected while one build holds the lease',async t=>{
  const f=await fixture(t);await f.user('developer');const c=await(await f.request('content')).json();const body={revision:c.revision,visibleTours:c.collections.tours.filter(t=>t.visible!==false).map(t=>t.slug),reviewed:true};let release,started;const building=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>started=resolve);
  const request=new Request(origin+'/api/admin/publish',{method:'POST',headers:{origin,cookie:f.auth.developer.cookie,'Content-Type':'application/json','X-CSRF-Token':f.auth.developer.csrf},body:JSON.stringify(body)});
  const first=handleAdmin(request,f.env,{local:true,onPublish:async()=>{started();await building;}});await ready;assert.equal((await f.request('publish',body)).status,409);release();assert.equal((await first).status,200);
});
test('all staff roles can apply safe seasonal presets without publishing content',async t=>{
  const f=await fixture(t);await f.user('admin');assert.deepEqual(await(await handleAppearance(new Request(origin+'/api/appearance'),f.env)).json(),{season:'autumn'});
  for(const season of ['spring','summer','winter','autumn']){const response=await f.request('theme',{season},'admin');assert.equal(response.status,200);assert.deepEqual(await(await handleAppearance(new Request(origin+'/api/appearance'),f.env)).json(),{season});}
  assert.equal((await f.request('theme',{season:'winter',css:'url(https://evil.test)'},'admin')).status,422);
  assert.equal((await f.request('theme',{season:'evil'},'admin')).status,422);
  assert.equal((await f.request('theme',{season:'winter'},'admin',{'X-CSRF-Token':'wrong'})).status,403);
  assert.equal((await f.request('theme',{season:'winter'},'none')).status,401);
  assert.equal((await handleAppearance(new Request(origin+'/api/appearance',{method:'POST'}),f.env)).status,405);
});
test('dashboard counts genuine customer intents separately from booking status and filters the matching records',async t=>{
  const f=await fixture(t);await f.user('admin');const references=[];
  for(const intent of ['interested','ready-to-pay','needs-info']){const id=crypto.randomUUID();references.push(id);const payload={requestId:id,name:'Intent test',email:'intent@example.test',tour:'dubai-escape',date:'2027-06-20',adults:2,children:0,language:'en',messaging:'email',consent:true,intent};const saved=await handleInquiry(new Request(origin+'/api/inquiries',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(payload)}),f.env,{local:true,ip:'intent-fixture'});assert.equal(saved.status,201);}
  assert.equal((await f.request('bookings/'+references[0],{status:'reserved',amount:1000},'admin')).status,200);
  const dashboard=await(await f.request('dashboard',undefined,'admin')).json();assert.equal(dashboard.activeTours,13);assert.equal(dashboard.recent.length,3);assert.equal(dashboard.statuses.find(r=>r.status==='reserved').count,1);assert.deepEqual(Object.fromEntries(dashboard.intents.map(r=>[r.intent,r.count])),{'interested':1,'ready-to-pay':1,'needs-info':1});assert(dashboard.recent.every(item=>!item.encrypted_payload&&item.name==='Intent test'));
  const paying=await(await f.request('bookings?intent=ready-to-pay',undefined,'admin')).json();assert.equal(paying.items.length,1);assert.equal(paying.items[0].id,references[1]);
  const booked=await(await f.request('bookings?status=booked',undefined,'admin')).json();assert.equal(booked.items.length,1);assert.equal(booked.items[0].id,references[0]);
  const detail=await(await f.request('bookings?reference='+references[2],undefined,'admin')).json();assert.equal(detail.items[0].intent,'needs-info');assert.equal(detail.items.length,1);
});
test('tour-only staff can create complete custom public pages and cannot save missing or unsafe details',async t=>{
  const f=await fixture(t);await f.user('admin');const c=await(await f.request('content',undefined,'admin')).json();
  const tour={...structuredClone(c.collections.tours[0]),slug:'custom-complete-tour',hotels:[],attractions:[],details:createTourDetails(c.collections.tours[0],seedContent)};
  tour.details.hotels[0].name='A custom hotel';tour.details.attractions[0].name.en='A custom attraction';
  let response=await f.request('content/tours',{action:'upsert',revision:c.revision,item:tour},'admin');assert.equal(response.status,200);let result=await response.json();
  const broken=structuredClone(tour);broken.details.faqs[0].a.ru='';response=await f.request('content/tours',{action:'upsert',originalId:tour.slug,revision:result.revision,item:broken},'admin');assert.equal(response.status,422);
  broken.details.faqs[0].a.ru=tour.details.faqs[0].a.ru;broken.details.hotels[0].url='javascript:alert(1)';assert.equal((await f.request('content/tours',{action:'upsert',originalId:tour.slug,revision:result.revision,item:broken},'admin')).status,422);
  const saved=await(await f.request('content',undefined,'admin')).json();assert.equal(saved.collections.tours.at(-1).details.hotels[0].name,'A custom hotel');assert.equal(saved.collections.tours.at(-1).details.attractions[0].name.en,'A custom attraction');
});
test('legacy CMS labels upgrade without overwriting staff content or changing revisions',async t=>{
  const f=await fixture(t);await f.user('admin');const c=await(await f.request('content',undefined,'admin')).json();const state=f.sqlite.prepare('SELECT * FROM cms_state').get();const draft=JSON.parse(state.draft);delete draft.translations.intentLabel;draft.tours[4].summary.en='Preserve this staff change';f.sqlite.prepare('UPDATE cms_state SET draft=?').run(JSON.stringify(draft));
  const updated=await(await f.request('content',undefined,'admin')).json();assert.equal(updated.revision,c.revision);assert.equal(updated.collections.tours[4].summary.en,'Preserve this staff change');const stored=JSON.parse(f.sqlite.prepare('SELECT draft FROM cms_state').get().draft);assert(stored.translations.intentLabel.en);
});
test('the third production migration preserves existing inquiry and booking records',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'altavia-migration-'));const sqlite=new DatabaseSync(join(directory,'legacy.sqlite'));t.after(async()=>{sqlite.close();await rm(directory,{recursive:true,force:true});});
  sqlite.exec(await readFile('migrations/0001_inquiries.sql','utf8'));sqlite.exec(await readFile('migrations/0002_admin.sql','utf8'));
  const id=crypto.randomUUID();sqlite.prepare('INSERT INTO inquiries(id,created_at,expires_at,payload,fingerprint) VALUES(?,?,?,?,?)').run(id,'2026-11-01','2027-02-01','encrypted-inquiry-fixture','fingerprint');
  sqlite.prepare('INSERT INTO bookings(id,payload,tour_slug,status,currency,created_at,updated_at,expires_at) VALUES(?,?,?,?,?,?,?,?)').run(id,'encrypted-booking-fixture','dubai-escape','reserved','USD','2026-11-01','2026-11-01','2027-02-01');
  sqlite.exec(await readFile('migrations/0003_dashboard_theme.sql','utf8'));
  assert.equal(sqlite.prepare('SELECT intent FROM inquiries WHERE id=?').get(id).intent,'interested');const booking=sqlite.prepare('SELECT * FROM bookings WHERE id=?').get(id);assert.equal(booking.intent,'interested');assert.equal(booking.payload,'encrypted-booking-fixture');assert.equal(booking.status,'reserved');assert.equal(sqlite.prepare('SELECT count(*) n FROM site_settings').get().n,0);
});
