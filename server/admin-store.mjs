import {createTourDetails} from '../shared/tour-details.mjs';
import {correctContent} from '../shared/content-corrections.mjs';
import {encryptPayload,decryptPayload,validateInquiry} from './inquiries.mjs';
import {query,rows,changed,fail,isFull,audit,reauthenticate,limit} from './admin-auth.mjs';
import {passwordHash,strongPassword,randomToken} from './admin-crypto.mjs';
import {seedContent} from './content-seed.mjs';
import {collectionNames,validateContent,localeNames} from './content-validation.mjs';
export async function ensureContent(env){
  const now=new Date().toISOString(),json=JSON.stringify(seedContent);
  await query(env,'INSERT OR IGNORE INTO cms_state(id,revision,draft,published,published_revision,updated_at,published_at,deployed_revision) VALUES(1,1,?,?,1,?,?,1)',json,json,now,now).run();
  let state=await query(env,'SELECT * FROM cms_state WHERE id=1').first();
  const upgrade=text=>{const data=correctContent(JSON.parse(text));data.translations={...seedContent.translations,...data.translations};const cookies=seedContent.policies.privacy.at(-1);if(data.policies.privacy.some(p=>p.body.en===seedContent.policies.privacy[1].body.en)&&!data.policies.privacy.some(p=>p.title.en===cookies.title.en))data.policies.privacy.push(cookies);return JSON.stringify(data);};
  const draft=upgrade(state.draft),published=upgrade(state.published);
  if(draft!==state.draft||published!==state.published){const result=await query(env,'UPDATE cms_state SET draft=?,published=? WHERE id=1 AND revision=? AND published_revision=? AND draft=? AND published=?',draft,published,state.revision,state.published_revision,state.draft,state.published).run();if(changed(result)===1){state.draft=draft;state.published=published;}else state=await query(env,'SELECT * FROM cms_state WHERE id=1').first();}
  if(state.deployed_revision!==state.published_revision&&state.published===json){await query(env,'UPDATE cms_state SET deployed_revision=? WHERE id=1 AND published_revision=?',state.published_revision,state.published_revision).run();state.deployed_revision=state.published_revision;}
  return state;
}
const publicUser=u=>({id:u.id,username:u.username,role:u.role,enabled:Boolean(u.enabled),mustChangePassword:Boolean(u.must_change),mfaEnabled:Boolean(u.totp_secret),createdAt:u.created_at});
const toMinor=(amount,currency)=>{if(typeof amount!=='number'||!Number.isFinite(amount)||amount<0||amount>1000000000)fail(422,'A valid agreed amount is required.');const factor=100;const minor=Math.round(amount*factor);if(!Number.isSafeInteger(minor)||Math.abs(minor/factor-amount)>0.000001)fail(422,'Use at most two decimal places.');return minor;};
export async function handleStore(path,method,body,ctx){
  const {env,user,options,url,local}=ctx;const full=isFull(user);
  if(path==='dashboard'&&method==='GET'){
    const statuses=await rows(env,"SELECT COALESCE(b.status,'new') AS status,count(*) AS count FROM (SELECT id FROM inquiries WHERE expires_at>? UNION SELECT id FROM bookings WHERE expires_at>?) x LEFT JOIN bookings b ON b.id=x.id GROUP BY COALESCE(b.status,'new')",new Date().toISOString(),new Date().toISOString());
    const intents=await rows(env,"SELECT COALESCE(b.intent,i.intent,'interested') AS intent,count(*) AS count FROM (SELECT id FROM inquiries WHERE expires_at>? UNION SELECT id FROM bookings WHERE expires_at>?) x LEFT JOIN inquiries i ON i.id=x.id LEFT JOIN bookings b ON b.id=x.id WHERE COALESCE(b.status,'new') NOT IN ('sold','cancelled') GROUP BY COALESCE(b.intent,i.intent,'interested')",new Date().toISOString(),new Date().toISOString());
    const recent=await rows(env,"SELECT x.id,COALESCE(b.status,'new') AS status,COALESCE(b.intent,i.intent,'interested') AS intent,COALESCE(b.created_at,i.created_at) AS created_at,COALESCE(b.payload,i.payload) AS encrypted_payload,COALESCE(b.tour_slug,'') AS tour_slug FROM (SELECT id FROM inquiries WHERE expires_at>? UNION SELECT id FROM bookings WHERE expires_at>?) x LEFT JOIN inquiries i ON i.id=x.id LEFT JOIN bookings b ON b.id=x.id ORDER BY created_at DESC LIMIT 6",new Date().toISOString(),new Date().toISOString());
    for(const item of recent){const payload=await decryptPayload(item.encrypted_payload,env.INQUIRY_ENCRYPTION_KEY);item.name=payload.name;item.tour_slug=item.tour_slug||payload.tour||'custom';delete item.encrypted_payload;}
    const revenue=await rows(env,"SELECT currency,SUM(amount_minor) AS amount_minor FROM bookings WHERE status='sold' AND expires_at>? GROUP BY currency",new Date().toISOString());
    const state=await ensureContent(env);const draft=JSON.parse(state.draft);
    return {body:{statuses,intents,recent,revenue,activeTours:JSON.parse(state.published).tours.filter(t=>t.visible!==false).length,totalTours:draft.tours.length,visibleTours:draft.tours.filter(t=>t.visible!==false).length,publishing:{draft:state.revision,published:state.published_revision,deployed:state.deployed_revision},role:user.role}};
  }
  if(path==='bookings'&&method==='GET'){
    const page=Math.max(0,Math.min(200,Number(url.searchParams.get('page'))||0)),status=url.searchParams.get('status')||'',intent=url.searchParams.get('intent')||'';if(intent&&!['interested','ready-to-pay','needs-info'].includes(intent))fail(422,'Invalid customer interest.');if(status&&!['new','reserved','approved','sold','cancelled','booked'].includes(status))fail(422,'Invalid booking status.');
    const reference=url.searchParams.get('reference')||'';if(reference&&!/^[a-f0-9-]{36}$/.test(reference))fail(422,'Invalid booking reference.');
    const now=new Date().toISOString();const list=await rows(env,"SELECT x.id,COALESCE(b.payload,i.payload) AS payload,COALESCE(b.status,'new') AS status,COALESCE(b.intent,i.intent,'interested') AS intent,COALESCE(b.tour_slug,'') AS tour_slug,COALESCE(b.amount_minor,0) AS amount_minor,COALESCE(b.currency,'USD') AS currency,COALESCE(b.version,0) AS version,COALESCE(b.created_at,i.created_at) AS created_at,COALESCE(b.expires_at,i.expires_at) AS expires_at FROM (SELECT id FROM inquiries WHERE expires_at>? UNION SELECT id FROM bookings WHERE expires_at>?) x LEFT JOIN inquiries i ON i.id=x.id LEFT JOIN bookings b ON b.id=x.id WHERE (?='' OR COALESCE(b.status,'new')=? OR (?='booked' AND COALESCE(b.status,'new') IN ('reserved','approved'))) AND (?='' OR COALESCE(b.intent,i.intent,'interested')=?) AND (?='' OR x.id=?) ORDER BY created_at DESC LIMIT 51 OFFSET ?",now,now,status,status,status,intent,intent,reference,reference,page*50);
    const items=[];for(const row of list.slice(0,50)){const payload=await decryptPayload(row.payload,env.INQUIRY_ENCRYPTION_KEY);items.push({...row,payload,tour_slug:row.tour_slug||payload.tour});}
    return {body:{items,hasMore:list.length>50,page}};
  }
  if((path==='bookings'||path.startsWith('bookings/'))&&method==='POST'){
    await limit(env,'booking-write:'+user.id,60,60000);
    const id=path.split('/')[1]||crypto.randomUUID();if(!/^[a-f0-9-]{36}$/i.test(id))fail(422,'Invalid reference.');
    const existing=await query(env,'SELECT * FROM bookings WHERE id=? AND expires_at>?',id,new Date().toISOString()).first();const inquiry=existing?null:await query(env,'SELECT * FROM inquiries WHERE id=? AND expires_at>?',id,new Date().toISOString()).first();
    if(path!=='bookings'&&!existing&&!inquiry)fail(404,'Booking not found.');
    if(existing&&Number(body.version)!==existing.version)fail(409,'This booking changed. Reload before saving.');
    const current=existing||inquiry;let payload=current?await decryptPayload(current.payload,env.INQUIRY_ENCRYPTION_KEY):null;
    if(body.payload){const validated=validateInquiry({...body.payload,requestId:id},new Date('1970-01-01'));if(Object.keys(validated.errors).length)fail(422,'Check customer name, email, contact method, date, passenger numbers and recorded consent.');const previousPayload=payload;payload=validated.value;for(const key of ['paymentReference','paymentMode','paymentRecordedBy','staffNote'])if(previousPayload?.[key]!==undefined)payload[key]=previousPayload[key];}
    if(!payload)fail(422,'Customer details are required.');
    const intent=body.intent??body.payload?.intent??current?.intent??payload.intent??'interested';if(!['interested','ready-to-pay','needs-info'].includes(intent))fail(422,'Choose a valid customer interest.');payload.intent=intent;
    const status=body.status||'reserved';if(!['new','reserved','approved','sold','cancelled'].includes(status))fail(422,'Invalid booking status.');
    const previous=existing?.status||'new';const transitions={new:['new','reserved','approved','cancelled'],reserved:['reserved','approved','cancelled'],approved:['approved','reserved','sold','cancelled'],sold:['sold','cancelled'],cancelled:['cancelled','reserved']};
    if(!transitions[previous].includes(status))fail(409,'Use the reservation and approval stages before recording a sale.');
    const currency=body.currency||existing?.currency||'USD';if(!['USD','UZS'].includes(currency))fail(422,'Use USD or UZS.');const amount=body.amount===undefined?(existing?.amount_minor||0):toMinor(body.amount,currency);
    if(['approved','sold'].includes(status)&&(!payload.date||!payload.tour||amount<=0))fail(422,'Confirm the travel date, tour and agreed total before approval.');
    if(status==='sold'&&previous!=='sold'){
      if(body.manualPaymentConfirmed!==true||typeof body.paymentReference!=='string'||body.paymentReference.trim().length<3||body.paymentReference.length>150)fail(422,'Record a verified offline payment reference and confirm receipt before marking sold.');
      payload.paymentReference=body.paymentReference.trim();payload.paymentRecordedBy=user.id;payload.paymentMode='manual';
    }
    if(previous==='sold'&&(amount!==existing.amount_minor||currency!==existing.currency))fail(409,'Sold amounts are locked. Record corrections through your accounting process.');
    if(typeof body.staffNote==='string'){if(body.staffNote.length>2000)fail(422,'Staff note is too long.');payload.staffNote=body.staffNote;}
    const now=new Date().toISOString(),expiry=current?.expires_at||new Date(Date.now()+90*86400000).toISOString();const encrypted=await encryptPayload(payload,env.INQUIRY_ENCRYPTION_KEY);
    if(existing){const result=await query(env,'UPDATE bookings SET payload=?,tour_slug=?,status=?,amount_minor=?,currency=?,intent=?,version=version+1,updated_at=? WHERE id=? AND version=?',encrypted,payload.tour||'custom',status,amount,currency,intent,now,id,existing.version).run();if(changed(result)!==1)fail(409,'This booking changed. Reload before saving.');}
    else await query(env,'INSERT INTO bookings(id,payload,tour_slug,status,amount_minor,currency,version,created_at,updated_at,expires_at,intent) VALUES(?,?,?,?,?,?,1,?,?,?,?)',id,encrypted,payload.tour||'custom',status,amount,currency,current?.created_at||now,now,expiry,intent).run();
    await audit(env,user,'booking_'+status,id);return {body:{ok:true,id,status}};
  }
  if(path==='content'&&method==='GET'){
    const state=await ensureContent(env);const all=JSON.parse(state.draft);const collections=full?all:Object.fromEntries(['tours','destinations','media','hotels','places','service-notes','faqs'].map(k=>[k,all[k]]));
    const templates=Object.fromEntries(Object.keys(collections).map(name=>[name,Array.isArray(seedContent[name])?seedContent[name][0]:seedContent[name]]));
    return {body:{collections,templates,revision:state.revision,publishedRevision:state.published_revision,deployedRevision:state.deployed_revision,canPublish:Boolean(options.onPublish||env.CMS_DEPLOY_HOOK),allowedCollections:full?collectionNames:['tours']}};
  }
  if(path.startsWith('content/')&&method==='POST'){
    const name=path.split('/')[1];if(!collectionNames.includes(name)||(!full&&name!=='tours'))fail(403,'Your role can edit tours only.');
    const state=await ensureContent(env);if(Number(body.revision)!==state.revision)fail(409,'Content changed. Reload to avoid overwriting another editor.');
    const data=JSON.parse(state.draft);
    if(name==='tours'&&body.action!=='delete'){
      if(!body.item||typeof body.item.price!=='number'||body.item.price<=0||!body.item.image)fail(422,'Tour price and image are required.');
      if(!body.item.details){if(!data.tours.some(t=>t.slug===body.originalId))fail(422,'Add all public tour-page details before saving a new tour.');body.item.details=createTourDetails(body.item,data);}
    }
    if(Array.isArray(data[name])){
      const key=['tours','destinations','articles'].includes(name)?'slug':['hotels','places','media'].includes(name)?'id':null;
      const index=key?data[name].findIndex(item=>item[key]===body.originalId):Number(body.index);
      if(body.action==='delete'){if(!Number.isInteger(index)||index<0||index>=data[name].length)fail(404,'Record not found.');data[name].splice(index,1);}
      else {if(body.action!=='upsert'||!body.item||typeof body.item!=='object')fail(422,'Choose a valid record.');if(index>=0&&index<data[name].length)data[name][index]=body.item;else data[name].push(body.item);}
    }else {if(body.action!=='replace'||!full)fail(403,'Only the owner or developer can edit this collection.');data[name]=body.item;}
    const errors=validateContent(data);if(errors.length)return {status:422,body:{error:'Content validation failed.',fields:errors}};
    const result=await query(env,'UPDATE cms_state SET draft=?,revision=revision+1,updated_at=? WHERE id=1 AND revision=?',JSON.stringify(data),new Date().toISOString(),state.revision).run();if(changed(result)!==1)fail(409,'Content changed. Reload before saving.');
    await audit(env,user,'content_'+body.action,name);return {body:{ok:true,revision:state.revision+1}};
  }
  if(path==='publish'&&method==='POST'){
    const state=await ensureContent(env);if(Number(body.revision)!==state.revision)fail(409,'Review the latest draft before publishing.');const data=JSON.parse(state.draft);
    const visible=data.tours.filter(t=>t.visible!==false).map(t=>t.slug).sort();
    if(body.reviewed!==true||!Array.isArray(body.visibleTours)||body.visibleTours.slice().sort().join(',')!==visible.join(','))fail(422,'Review the currently visible tours, prices and images before publishing.');
    if(!full){const published=JSON.parse(state.published);for(const name of collectionNames){
      if(name==='tours')continue;
      if(name==='media'){
        const used=new Set(data.tours.map(t=>t.image));
        if(published.media.every(old=>JSON.stringify(data.media.find(m=>m.id===old.id))===JSON.stringify(old))&&data.media.filter(m=>!published.media.some(old=>old.id===m.id)).every(m=>m.uploaded===true&&used.has(m.id)))continue;
      }
      if(JSON.stringify(data[name])!==JSON.stringify(published[name]))fail(403,'Owner content has pending changes. Ask the owner to publish this revision.');
    }}
    const errors=validateContent(data);if(errors.length)return {status:422,body:{error:'Fix the content before publishing.',fields:errors}};
    if(!options.onPublish&&!/^https:\/\/api\.cloudflare\.com\/client\/v4\/(?:pages\/webhooks|workers\/builds)\/deploy_hooks\/[a-zA-Z0-9_-]+$/.test(env.CMS_DEPLOY_HOOK||''))fail(503,'Publishing is not configured. Your draft is safely saved. Configure the Cloudflare build hook first.');
    const result=await query(env,'UPDATE cms_state SET published=draft,published_revision=revision,published_at=?,publishing_until=? WHERE id=1 AND revision=? AND publishing_until<?',new Date().toISOString(),Date.now()+180000,state.revision,Date.now()).run();if(changed(result)!==1)fail(409,'Draft changed during review. Reload.');
    await audit(env,user,'publish_requested',String(state.revision));
    try{
      if(options.onPublish){await options.onPublish(data,state.revision);await query(env,'UPDATE cms_state SET deployed_revision=? WHERE id=1',state.revision).run();return {body:{ok:true,status:'deployed',revision:state.revision}};}
      const response=await (options.fetch||fetch)(env.CMS_DEPLOY_HOOK,{method:'POST',redirect:'error',signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error();return {body:{ok:true,status:'build_requested',revision:state.revision,message:'The host accepted the build request. Public pages update after a successful deployment.'}};
    }catch{await audit(env,user,'publish_failed',String(state.revision));fail(503,'The published snapshot was saved, but the build did not finish. Retry publishing; public pages still show the last successful build.');}finally{await query(env,'UPDATE cms_state SET publishing_until=0 WHERE id=1 AND published_revision=?',state.revision).run();}
  }
  if(path==='users'&&method==='GET'){
    if(!full)fail(403,'Owner or developer access required.');return {body:{users:(await rows(env,'SELECT * FROM admin_users ORDER BY created_at')).map(publicUser)}};
  }
  if(path==='users'&&method==='POST'){
    if(!full)fail(403,'Owner or developer access required.');await reauthenticate(env,user,body,local);
    const username=String(body.username||'').trim().toLowerCase();if(!/^[a-z0-9][a-z0-9_.-]{2,39}$/.test(username)||!['developer','owner','admin'].includes(body.role))fail(422,'Use a valid username and role.');
    const existing=body.id?await query(env,'SELECT * FROM admin_users WHERE id=?',body.id).first():null;
    if(body.id&&!existing)fail(404,'User not found.');if(existing?.id===user.id)fail(422,'Use Account to change your own credentials. Another full-access user can change your role.');
    if(!existing&&!strongPassword(body.password,local?8:12))fail(422,`A password of at least ${local?8:12} characters is required.`);
    if(body.password&&!strongPassword(body.password,local?8:12))fail(422,`Passwords need ${local?8:12}–128 characters.`);
    const duplicate=await query(env,'SELECT id FROM admin_users WHERE username=?',username).first();if(duplicate&&duplicate.id!==existing?.id)fail(409,'That username is already in use.');
    const now=new Date().toISOString();const id=existing?.id||crypto.randomUUID();
    if(existing){
      const fullUsers=await query(env,"SELECT count(*) AS n FROM admin_users WHERE enabled=1 AND role IN ('owner','developer')").first();if(isFull(existing)&&existing.enabled&&(body.enabled===false||body.role==='admin')&&fullUsers.n<=1)fail(409,'Keep at least one active owner or developer.');
      const hash=body.password?await passwordHash(body.password):existing.password_hash;
      const updated=await query(env,"UPDATE admin_users SET username=?,role=?,enabled=?,password_hash=?,must_change=?,totp_secret=?,totp_pending=NULL,totp_last_step=?,updated_at=? WHERE id=? AND updated_at=? AND (NOT(role IN ('owner','developer') AND enabled=1 AND ?=1) OR EXISTS(SELECT 1 FROM admin_users WHERE id<>? AND enabled=1 AND role IN ('owner','developer'))) RETURNING id",username,body.role,body.enabled===false?0:1,hash,body.password?1:existing.must_change,body.resetMfa===true?null:existing.totp_secret,body.resetMfa===true?-1:existing.totp_last_step,now,id,existing.updated_at,(body.enabled===false||body.role==='admin')?1:0,id).first();
      if(!updated)fail(409,'Account changed, or this would disable the last full-access user. Reload.');
      await env.DB.batch([query(env,'DELETE FROM admin_sessions WHERE user_id=?',id),...(body.resetMfa===true?[query(env,'DELETE FROM admin_recovery WHERE user_id=?',id)]:[])]);
    }else await query(env,'INSERT INTO admin_users(id,username,role,password_hash,must_change,created_at,updated_at) VALUES(?,?,?,?,1,?,?)',id,username,body.role,await passwordHash(body.password),now,now).run();
    await audit(env,user,existing?'user_updated':'user_created',id);return {body:{ok:true,id}};
  }
  if(path==='payments'&&method==='GET'){
    if(!full)fail(403,'Owner or developer access required.');const settings=[];for(const row of await rows(env,'SELECT * FROM merchant_settings')){const data=await decryptPayload(row.payload,env.INQUIRY_ENCRYPTION_KEY);const {secrets,...visible}=data;settings.push({...visible,provider:row.provider,hasSecrets:Boolean(secrets&&Object.values(secrets).some(Boolean)),updatedAt:row.updated_at,liveEnabled:false});}return {body:{settings,liveEnabled:false}};
  }
  if(path.startsWith('payments/')&&method==='POST'){
    if(!full)fail(403,'Owner or developer access required.');await reauthenticate(env,user,body,local);const provider=path.split('/')[1];if(!['click','payme','bank'].includes(provider))fail(422,'Choose Click, Payme or your bank.');
    const old=await query(env,'SELECT payload FROM merchant_settings WHERE provider=?',provider).first();const previous=old?await decryptPayload(old.payload,env.INQUIRY_ENCRYPTION_KEY):{};const settings=body.settings||{};
    const data={provider,mode:'disabled',merchantId:'',serviceId:'',terminalId:'',bankName:'',currency:'UZS',secrets:{...(previous.secrets||{})}};
    for(const field of ['merchantId','serviceId','terminalId','bankName']){const value=settings[field]||'';if(typeof value!=='string'||value.length>150||/[\x00-\x1f<>]/.test(value))fail(422,'Invalid merchant field.');data[field]=value.trim();}
    if(settings.mode&&!['disabled','sandbox'].includes(settings.mode))fail(422,'Live activation requires the provider-specific integration and verification.');data.mode=settings.mode||'disabled';
    for(const field of ['apiKey','secretKey','sandboxKey']){if(settings.clearSecrets===true)data.secrets[field]='';if(settings[field]){if(typeof settings[field]!=='string'||settings[field].length>2000)fail(422,'Invalid provider secret.');data.secrets[field]=settings[field];}}
    await query(env,'INSERT INTO merchant_settings(provider,payload,updated_at,updated_by) VALUES(?,?,?,?) ON CONFLICT(provider) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at,updated_by=excluded.updated_by',provider,await encryptPayload(data,env.INQUIRY_ENCRYPTION_KEY),new Date().toISOString(),user.id).run();await audit(env,user,'merchant_settings_updated',provider);return {body:{ok:true,liveEnabled:false}};
  }
  if(path==='audit'&&method==='GET'){
    if(!full)fail(403,'Owner or developer access required.');return {body:{events:await rows(env,'SELECT a.id,a.action,a.entity,a.created_at,u.username FROM admin_audit a LEFT JOIN admin_users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 150')}};
  }
  return null;
}
