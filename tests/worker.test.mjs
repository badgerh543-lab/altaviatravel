import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import worker,{AltaviaBackend} from '../workers/app.mjs';
import {openLocalDatabase} from '../server/database.mjs';
import {passwordHash} from '../server/admin-crypto.mjs';
import {createSession} from '../server/admin-auth.mjs';
import {handleAdmin} from '../server/admin.mjs';

const origin='https://travel.example.test';
async function fixture(t){
  const dir=await mkdtemp(join(tmpdir(),'altavia-worker-'));
  const local=openLocalDatabase(dir);
  t.after(async()=>{local.sqlite.close();await rm(dir,{recursive:true,force:true});});
  return {...local,env:{DB:local.DB,SITE_URL:origin,ADMIN_ENABLED:'true',BUSINESS_READY:'false',INQUIRY_ENCRYPTION_KEY:local.keys.encryption,RATE_LIMIT_SECRET:local.keys.rate,ASSETS:{fetch(){throw new Error('API must not fall through to assets.');}}}};
}
const request=(path,init={})=>new Request(origin+path,init);

test('Worker forwards APIs to the compute object with the original URL while static pages bypass it',async()=>{
  let forwarded=0;const env={ASSETS:{fetch:async()=>new Response('Public page')}};
  env.BACKEND={idFromName(name){assert.equal(name,'altavia-backend');return 'fixture-object';},get(id){assert.equal(id,'fixture-object');return {fetch:async req=>{assert.equal(new URL(req.url).origin,origin);forwarded++;return new AltaviaBackend({},env).fetch(req);}};}};
  assert.equal((await(await worker.fetch(request('/api/status'),env)).json()).ready,false);
  assert.deepEqual(await(await worker.fetch(request('/api/appearance'),env)).json(),{season:'autumn'});
  assert.equal(await(await worker.fetch(request('/uz/'),env)).text(),'Public page');assert.equal(forwarded,2);
});

test('Worker dispatches public status and appearance APIs instead of returning static 404 bodies',async()=>{
  for(const path of ['/api/status','/api/status/']){
    const response=await worker.fetch(request(path),{});
    assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/application\/json/);
    assert.deepEqual(await response.json(),{ready:false,mode:'production',siteKey:null});
  }
  assert.deepEqual(await(await worker.fetch(request('/api/appearance/'),{})).json(),{season:'autumn'});
  const method=await worker.fetch(request('/api/status',{method:'POST'}),{});
  assert.equal(method.status,405);assert.equal(method.headers.get('allow'),'GET');
});

test('Worker APIs fail closed with valid JSON when configuration or authorization is missing',async()=>{
  for(const path of ['/api/admin/login/','/api/admin/session/']){
    const response=await worker.fetch(request(path),{});
    assert.equal(response.status,503);assert.match((await response.json()).error,/not configured/);
  }
  const content=await worker.fetch(request('/api/cms/export/'),{CMS_BUILD_TOKEN:'t'.repeat(48)});
  assert.equal(content.status,401);assert.deepEqual(await content.json(),{error:'Unauthorized.'});
  const media=await worker.fetch(request('/api/media/missing/960',{method:'POST'}),{});
  assert.equal(media.status,405);assert.match(media.headers.get('content-type'),/application\/json/);
  const missingMediaDatabase=await worker.fetch(request('/api/media/00000000-0000-4000-8000-000000000001/960'),{});
  assert.equal(missingMediaDatabase.status,503);assert.deepEqual(await missingMediaDatabase.json(),{error:'The service is temporarily unavailable.'});
  const unknown=await worker.fetch(request('/api/does-not-exist/'),{});
  assert.equal(unknown.status,404);assert.deepEqual(await unknown.json(),{error:'API route not found.'});
  const inquiries=await worker.fetch(request('/api/inquiries/',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:'{}'}),{SITE_URL:origin});
  assert.equal(inquiries.status,503);assert.deepEqual(await inquiries.json(),{error:'unavailable'});
});

test('Worker serves static pages through ASSETS and hides binding failures',async()=>{
  const html='<h1>Website</h1>';
  const response=await worker.fetch(request('/uz/'),{ASSETS:{fetch:async r=>{assert.equal(new URL(r.url).pathname,'/uz/');return new Response(html);}}});
  assert.equal(await response.text(),html);
  const failed=await worker.fetch(request('/uz/'),{ASSETS:{fetch(){throw new Error('secret binding details');}}});
  assert.equal(failed.status,503);assert(!JSON.stringify(await failed.json()).includes('secret'));
});

test('Worker uses production login checks and Secure sessions; it never enables local login',async t=>{
  const f=await fixture(t),password='Worker-test-password-only!';
  const now=new Date().toISOString();
  f.sqlite.prepare('INSERT INTO admin_users(id,username,role,password_hash,must_change,created_at,updated_at) VALUES(?,?,?,?,1,?,?)').run('test-user','developer','developer',await passwordHash(password),now,now);
  const options=await worker.fetch(request('/api/admin/login/'),f.env);
  assert.deepEqual(await options.json(),{localLogin:false,passwordMinLength:12,mfaRequired:true});
  const response=await worker.fetch(request('/api/admin/login/',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({username:'developer',password,local:true,localLogin:true})}),f.env);
  assert.equal(response.status,200);
  const result=await response.json();assert.equal(result.user.localLogin,false);assert.equal(result.user.mustChangePassword,true);assert.equal(result.user.mfaRequired,true);
  const cookie=response.headers.get('set-cookie');assert.match(cookie,/__Host-altavia_admin=/);assert.match(cookie,/; Secure/);assert.match(cookie,/HttpOnly/);
  const dashboard=await worker.fetch(request('/api/admin/dashboard/',{headers:{cookie:cookie.split(';')[0]}}),f.env);
  assert.equal(dashboard.status,428);
  const crossOrigin=await worker.fetch(request('/api/admin/login/',{method:'POST',headers:{origin:'https://attacker.example','Content-Type':'application/json'},body:'{}'}),f.env);
  assert.equal(crossOrigin.status,403);
  const alias='https://altavia-worker.example.workers.dev';
  f.env.ADMIN_ORIGIN=alias;
  const aliasLogin=await worker.fetch(new Request(alias+'/api/admin/login/',{method:'POST',headers:{origin:alias,'Content-Type':'application/json'},body:JSON.stringify({username:'developer',password})}),f.env);
  assert.equal(aliasLogin.status,200);assert.match(aliasLogin.headers.get('set-cookie'),/__Host-altavia_admin=/);
  const mixedHost=await worker.fetch(new Request(alias+'/api/admin/login/',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:'{}'}),f.env);
  assert.equal(mixedHost.status,403);
  const unknownHost=await worker.fetch(new Request('https://attacker.example/api/admin/login/'),f.env);
  assert.equal(unknownHost.status,403);
});

test('CMS accepts only official Pages or Workers build hooks and keeps private tokens out of the request',async t=>{
  const f=await fixture(t),now=new Date().toISOString();
  f.sqlite.prepare('INSERT INTO admin_users(id,username,role,password_hash,must_change,totp_secret,created_at,updated_at) VALUES(?,?,?,?,0,?,?,?)').run('publisher','developer','developer','unused-hash','already-enrolled-fixture',now,now);
  const user=f.sqlite.prepare('SELECT * FROM admin_users WHERE id=?').get('publisher'),session=await createSession(f.env,user,false);
  const headers={origin,cookie:session.cookie.split(';')[0],'Content-Type':'application/json','X-CSRF-Token':session.csrf};
  const content=await(await handleAdmin(request('/api/admin/content/',{headers}),f.env)).json();
  const body=JSON.stringify({revision:content.revision,visibleTours:content.collections.tours.filter(tour=>tour.visible!==false).map(tour=>tour.slug),reviewed:true});
  const submit=()=>request('/api/admin/publish/',{method:'POST',headers,body});
  for(const hook of ['https://attacker.example/client/v4/workers/builds/deploy_hooks/test','https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/test?redirect=bad']){
    const response=await handleAdmin(submit(),{...f.env,CMS_DEPLOY_HOOK:hook});assert.equal(response.status,503);
  }
  for(const kind of ['pages/webhooks','workers/builds']){
    const hook=`https://api.cloudflare.com/client/v4/${kind}/deploy_hooks/fixture-hook`;
    const response=await handleAdmin(submit(),{...f.env,CMS_DEPLOY_HOOK:hook},{fetch:async(url,init)=>{assert.equal(url,hook);assert.equal(init.method,'POST');assert.equal(init.headers,undefined);return Response.json({success:true});}});
    assert.equal(response.status,200);assert.equal((await response.json()).status,'build_requested');
  }
});
