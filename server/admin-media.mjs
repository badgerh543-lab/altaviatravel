import {query,changed,fail,isFull,audit,limit} from './admin-auth.mjs';
import {ensureContent} from './admin-store.mjs';
import {validateContent} from './content-validation.mjs';
const uuid=value=>/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
function webpInfo(data){
  const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));const word=(i,n)=>String.fromCharCode(...bytes.slice(i,i+n));
  if(bytes.length<30||bytes.length>260000||word(0,4)!=='RIFF'||word(8,4)!=='WEBP')fail(422,'Use a compressed WebP image under 250 KB per size.');
  let width,height;
  if(word(12,4)==='VP8X'){if(bytes[20]&2)fail(422,'Animated images are not accepted.');width=1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16);height=1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16);}
  else if(word(12,4)==='VP8L'&&bytes[20]===47){width=1+bytes[21]+((bytes[22]&63)<<8);height=1+(bytes[22]>>6)+(bytes[23]<<2)+((bytes[24]&15)<<10);}
  else if(word(12,4)==='VP8 '&&bytes[23]===157&&bytes[24]===1&&bytes[25]===42){width=(bytes[26]|bytes[27]<<8)&16383;height=(bytes[28]|bytes[29]<<8)&16383;}
  if(!width||!height||width>1600||height>2400)fail(422,'Image dimensions are invalid or too large.');return {bytes,width,height};
}
export async function handleUpload(body,ctx){
  const {env,user}=ctx;if(!isFull(user)&&user.role!=='admin')fail(403,'Not allowed.');await limit(env,'upload:'+user.id,15,3600000);
  if(body.rightsConfirmed!==true||typeof body.author!=='string'||!body.author.trim()||body.author.length>150||typeof body.title!=='string'||!body.title.trim()||body.title.length>200)fail(422,'Confirm image rights and enter its title and author.');
  const state=await ensureContent(env);if(Number(body.revision)!==state.revision)fail(409,'Reload the latest image library before uploading.');
  if(!Array.isArray(body.images)||body.images.length!==3)fail(422,'Three responsive image sizes are required.');const sizes=new Set();const images=body.images.map(image=>{if(![480,960,1600].includes(image.size)||sizes.has(image.size)||typeof image.data!=='string'||image.data.length>350000||!/^[A-Za-z0-9+/]*={0,2}$/.test(image.data))fail(422,'Invalid image data.');sizes.add(image.size);return {...image,...webpInfo(image.data)};});
  for(const image of images)if(image.width>image.size)fail(422,'Image exceeds its responsive size.');
  const id=crypto.randomUUID(),now=new Date().toISOString();const largest=images.find(i=>i.size===1600);
  const record={id:'upload-'+id,title:body.title.trim(),description:body.title.trim(),author:body.author.trim(),license:'Owned / used with permission',sourceUrl:`/api/media/${id}/credit`,licenseUrl:`/api/media/${id}/credit`,originalUrl:`/api/media/${id}/1600`,width:largest.width,height:largest.height,src:`/api/media/${id}/960`,variants:images.map(i=>({src:`/api/media/${id}/${i.size}`,width:i.width})),uploaded:true};
  const data=JSON.parse(state.draft);data.media.push(record);const errors=validateContent(data);if(errors.length)return {status:422,body:{error:'Invalid image metadata.',fields:errors}};
  // Insert immutable assets first. A stale content write can leave an unreferenced private
  // upload, but cannot overwrite another editor's draft or expose it publicly.
  await env.DB.batch(images.map(image=>query(env,'INSERT INTO cms_assets(id,width,mime,data,created_at) VALUES(?,?,?,?,?)',id,image.size,'image/webp',image.data,now)));
  const result=await query(env,'UPDATE cms_state SET draft=?,revision=revision+1,updated_at=? WHERE id=1 AND revision=?',JSON.stringify(data),now,state.revision).run();if(changed(result)!==1)fail(409,'Content changed during upload. Reload and try again.');
  await audit(env,user,'image_uploaded',record.id);return {body:{ok:true,image:record,revision:state.revision+1}};
}
export async function serveImage(request,env,{privateAccess=false}={}){
  const pieces=new URL(request.url).pathname.replace(/\/$/,'').split('/');const size=pieces.pop(),id=pieces.pop();
  if(!uuid(id)||!['480','960','1600','credit'].includes(size))return new Response('Not found',{status:404});
  const state=await ensureContent(env);const content=JSON.parse(privateAccess?state.draft:state.published);const media=content.media.find(m=>m.id==='upload-'+id);if(!media)return new Response('Not found',{status:404});
  const headers={'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",'Cache-Control':privateAccess?'private, no-store':'public, max-age=86400','X-Robots-Tag':'noindex'};
  if(size==='credit')return Response.json({title:media.title,author:media.author,license:media.license,changes:'Resized and converted to WebP; cropped in page layouts.'},{headers});
  const row=await query(env,'SELECT data,mime FROM cms_assets WHERE id=? AND width=?',id,Number(size)).first();if(!row)return new Response('Not found',{status:404});
  return new Response(Uint8Array.from(atob(row.data),c=>c.charCodeAt(0)),{headers:{...headers,'Content-Type':'image/webp','Content-Disposition':'inline'}});
}
