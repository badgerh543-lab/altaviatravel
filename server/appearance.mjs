import {query,fail,audit} from './admin-auth.mjs';
export const seasons=['autumn','spring','summer','winter'];
export async function getAppearance(env){
  try{const row=await env.DB.prepare("SELECT value FROM site_settings WHERE key='appearance'").first();const data=row?JSON.parse(row.value):{};return {season:seasons.includes(data.season)?data.season:'autumn'};}catch{return {season:'autumn'};}
}
export async function handleAppearance(request,env){
  if(request.method!=='GET')return Response.json({error:'Method not allowed'},{status:405,headers:{Allow:'GET'}});
  return Response.json(await getAppearance(env),{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
export async function handleTheme(path,method,body,{env,user}){
  if(path!=='theme')return null;
  if(!['developer','owner','admin'].includes(user.role))fail(403,'Staff access required.');
  if(method==='GET')return {body:await getAppearance(env)};
  if(method==='POST'){
    if(!seasons.includes(body.season)||Object.keys(body).some(k=>k!=='season'))fail(422,'Choose one of the four seasonal presets.');
    await query(env,"INSERT INTO site_settings(key,value,updated_at) VALUES('appearance',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",JSON.stringify({season:body.season}),new Date().toISOString()).run();
    await audit(env,user,'theme_changed',body.season);return {body:{ok:true,season:body.season}};
  }
  return null;
}
