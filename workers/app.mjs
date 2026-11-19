import {onRequestGet as status} from '../functions/api/status.js';
import {onRequest as appearance} from '../functions/api/appearance.js';
import {onRequest as inquiries} from '../functions/api/inquiries.js';
import {onRequest as admin} from '../functions/api/admin/[[path]].js';
import {onRequest as contentExport} from '../functions/api/cms/export.js';
import {onRequestGet as media} from '../functions/api/media/[[path]].js';
import retention from './retention.js';

const json=(error,status,extra={})=>Response.json({error},{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow',...extra}});
const methodNotAllowed=allow=>json('Method not allowed.',405,{Allow:allow});

async function dispatch(request,env,ctx){
    const path=new URL(request.url).pathname.replace(/\/$/,'');
    try{
      const context={request,env,waitUntil:work=>ctx?.waitUntil(work)};
      if(path==='/api/status')return request.method==='GET'?await status(context):methodNotAllowed('GET');
      if(path==='/api/appearance')return await appearance(context);
      if(path==='/api/inquiries')return await inquiries(context);
      if(path==='/api/admin'||path.startsWith('/api/admin/'))return await admin(context);
      if(path==='/api/cms/export')return await contentExport(context);
      if(path.startsWith('/api/media/'))return request.method==='GET'?await media(context):methodNotAllowed('GET');
      // Never let unknown API paths fall through to HTML or a static 404 body.
      if(path==='/api'||path.startsWith('/api/'))return json('API route not found.',404);
      return await env.ASSETS.fetch(request);
    }catch{
      // Do not expose database errors, configuration values or stack traces.
      return json('The service is temporarily unavailable.',503);
    }
}

// SQLite-backed Durable Objects have a separate CPU allowance on the Free plan.
// This object supplies compute only: all accounts and records remain in D1.
export class AltaviaBackend {
  #ctx;#env;
  constructor(ctx,env){this.#ctx=ctx;this.#env=env;}
  async fetch(request){return dispatch(request,this.#env,this.#ctx);}
}

export default {
  async fetch(request,env,ctx){
    const path=new URL(request.url).pathname;
    if((path==='/api'||path.startsWith('/api/'))&&env.BACKEND){
      try{return await env.BACKEND.get(env.BACKEND.idFromName('altavia-backend')).fetch(request);}
      catch{return json('The service is temporarily unavailable.',503);}
    }
    return dispatch(request,env,ctx);
  },
  async scheduled(event,env,ctx){
    if(env.DB)await retention.scheduled(event,env,ctx);
  }
};
