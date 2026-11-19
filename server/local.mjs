import {handleAppearance} from './appearance.mjs';
import { createServer } from 'node:http';
import { handleInquiry,configured } from './inquiries.mjs';
import { openLocalDatabase } from './database.mjs';
import {handleAdmin,handleContentExport} from './admin.mjs';
import {serveImage} from './admin-media.mjs';
import {publishLocalContent} from './local-content.mjs';
const port=Number(process.env.API_PORT||8788);
const {DB,keys,sqlite}=openLocalDatabase(process.env.INQUIRY_DATA_DIR);
const env={DB,INQUIRY_ENCRYPTION_KEY:keys.encryption,RATE_LIMIT_SECRET:keys.rate,SITE_URL:process.env.SITE_URL||'http://localhost:4321'};
export const server=createServer(async(req,res)=>{
  const origin=new URL(env.SITE_URL).origin;
  const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);
  try{
    let result;
    if(req.url==='/api/status'&&req.method==='GET')result=Response.json({ready:configured(env,true),mode:'local',siteKey:null},{headers:{'Cache-Control':'no-store'}});
    else if(req.url?.startsWith('/api/')){
      let abandoned=false;
      const stream=new ReadableStream({start(controller){req.on('data',chunk=>{if(abandoned)return;controller.enqueue(new Uint8Array(chunk));if(controller.desiredSize<=0)req.pause();});req.on('end',()=>{if(!abandoned){abandoned=true;controller.close();}});req.on('error',e=>{if(!abandoned){abandoned=true;controller.error(e);}});},pull(){req.resume();},cancel(){abandoned=true;req.resume();}});
      const request=new Request(origin+req.url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:stream,duplex:'half'}:{})});
      if(req.url==='/api/appearance')result=await handleAppearance(request,env);
      else if(req.url==='/api/inquiries')result=await handleInquiry(request,env,{local:true,ip:req.socket.remoteAddress});
      else if(req.url.startsWith('/api/admin/'))result=await handleAdmin(request,env,{local:true,ip:req.socket.remoteAddress,onPublish:publishLocalContent});
      else if(req.url==='/api/cms/export')result=await handleContentExport(request,{...env,CMS_BUILD_TOKEN:process.env.CMS_BUILD_TOKEN});
      else if(req.url.startsWith('/api/media/'))result=await serveImage(request,env);
      else result=Response.json({error:'not-found'},{status:404});
      if(request.body&&!request.body.locked)await request.body.cancel();
    }else result=Response.json({error:'not-found'},{status:404});
    res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
  }catch{res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":"unavailable"}');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Local inquiry API: http://127.0.0.1:${port} (encrypted storage; no staff delivery)`));
for(const event of ['SIGTERM','SIGINT'])process.on(event,()=>{server.close(()=>{sqlite.close();process.exit(0);});});
