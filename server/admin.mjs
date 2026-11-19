import {handleTheme} from './appearance.mjs';
import {configured} from './inquiries.mjs';
import {AdminError,fail,sessionFor,safeUser,handleAuth,ready,limit,query} from './admin-auth.mjs';
import {handleStore,ensureContent} from './admin-store.mjs';
import {handleUpload,serveImage} from './admin-media.mjs';
import {sha256,constantEqual} from './admin-crypto.mjs';
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Pragma':'no-cache','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"};
const json=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{...headers,...extra}});
async function readBody(request){
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))fail(415,'JSON requests are required.');
  const max=1800000;if(Number(request.headers.get('content-length'))>max)fail(413,'Request is too large.');
  const reader=request.body?.getReader();if(!reader)return {};let size=0,parts=[];
  while(true){const result=await reader.read();if(result.done)break;size+=result.value.byteLength;if(size>max){await reader.cancel();fail(413,'Request is too large.');}parts.push(result.value);}
  try{const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}const data=JSON.parse(new TextDecoder().decode(bytes));if(!data||typeof data!=='object'||Array.isArray(data))throw new Error();return data;}catch{fail(400,'Invalid JSON object.');}
}
export async function handleAdmin(request,env,options={}){
  try{
    const local=options.local===true;
    if(!env.DB||!configured({...env,DB:env.DB},true)||(!local&&env.ADMIN_ENABLED!=='true'))return json({error:'Administration is not configured.'},503);
    const url=new URL(request.url);const expected=new URL(env.SITE_URL).origin;
    if(!local&&(url.protocol!=='https:'||!expected.startsWith('https://')))fail(403,'HTTPS is required.');
    if(request.headers.get('sec-fetch-site')==='cross-site')fail(403,'Cross-site requests are not allowed.');
    const path=url.pathname.replace(/^\/api\/admin\/?/,'').replace(/\/$/,'');const method=request.method;
    if(!['GET','POST'].includes(method))return json({error:'Method not allowed.'},405,{'Allow':'GET, POST'});
    const user=await sessionFor(request,env,local);
    if(method==='POST'&&request.headers.get('origin')!==expected)fail(403,'Request origin does not match.');
    if(path!=='login'&&!user)fail(401,'Sign in to continue.');
    if(method==='POST'&&path!=='login'){
      const csrf=request.headers.get('x-csrf-token')||'';
      if(!user||!constantEqual(await sha256(csrf),user.csrf_hash))fail(403,'Session verification failed. Reload and try again.');
    }
    const body=method==='POST'?await readBody(request):{};
    const ctx={env,options,user,local,url,ip:options.ip||request.headers.get('cf-connecting-ip')||'unknown'};
    let result=await handleAuth(path,method,body,ctx);
    if(!result){ready(user,local);await limit(env,'admin-requests:'+user.id,180,60000);
      if(path==='upload'&&method==='POST')result=await handleUpload(body,ctx);
      else if(path.startsWith('media/')&&method==='GET')return serveImage(request,env,{privateAccess:true});
      else result=await handleTheme(path,method,body,ctx)||await handleStore(path,method,body,ctx);
    }
    if(!result)return json({error:'Not found.'},404);
    return json(result.body,result.status||200,result.cookie?{'Set-Cookie':result.cookie}:{});
  }catch(error){return json({error:error instanceof AdminError?error.message:'The operation could not be completed. No private details are included.'},error instanceof AdminError?error.status:503);}
}
export async function handleContentExport(request,env){
  try{if(request.method!=='GET')return json({error:'Method not allowed.'},405);
    if(!env.CMS_BUILD_TOKEN||env.CMS_BUILD_TOKEN.length<40)return json({error:'Export is not configured.'},503);
    if(!constantEqual(await sha256(request.headers.get('authorization')||''),await sha256('Bearer '+env.CMS_BUILD_TOKEN)))return json({error:'Unauthorized.'},401);
    const state=await ensureContent(env);return json({revision:state.published_revision,content:JSON.parse(state.published)});
  }catch{return json({error:'Export unavailable.'},503);}
}
