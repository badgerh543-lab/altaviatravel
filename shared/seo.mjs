export const defaultSiteOrigin='https://altaviatravel.uz';
export const publicLanguages=['uz','en','ru','ky','tg'];
export const publicPages=['tours','destinations','inbound','outbound','domestic','custom','gallery','about','journal','faq','contact','privacy','terms','booking-conditions','credits'];
export function siteOrigin(value){
  if(!value)return defaultSiteOrigin;
  const url=new URL(value);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('SITE_URL must be an HTTP(S) origin without a path, credentials or query.');
  return url.origin;
}
export function indexingEnabled(value){
  if(!value)return false;
  const url=new URL(siteOrigin(value));
  return url.protocol==='https:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&!['.example','.pages.dev','.workers.dev'].some(suffix=>url.hostname.endsWith(suffix));
}
export function publicRoutes({tours,destinations,articles}){
  const paths=['',...publicPages,...tours.filter(t=>t.visible!==false).map(t=>'tours/'+t.slug),...destinations.map(d=>'destinations/'+d.slug),...articles.map(a=>'journal/'+a.slug)];
  return publicLanguages.flatMap(lang=>paths.map(path=>`/${lang}/${path?path+'/':''}`));
}
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll("'",'&apos;');
export function buildSitemap(routes,origin=defaultSiteOrigin){
  const base=siteOrigin(origin),valid=new Set(routes.filter(route=>/^\/(uz|en|ru|ky|tg)\/(?:[a-z0-9-]+\/)*$/.test(route)));
  const entries=[...valid].sort().map(route=>{
    const path=route.replace(/^\/(uz|en|ru|ky|tg)\//,'');
    const alternates=publicLanguages.map(lang=>({lang,route:`/${lang}/${path}`})).filter(link=>valid.has(link.route));
    if(valid.has('/uz/'+path))alternates.push({lang:'x-default',route:'/uz/'+path});
    return `  <url>\n    <loc>${escape(base+route)}</loc>\n${alternates.map(link=>`    <xhtml:link rel="alternate" hreflang="${link.lang}" href="${escape(base+link.route)}"/>`).join('\n')}\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`;
}
export function buildRobots(origin,allowIndexing){
  return allowIndexing?`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /edit\nSitemap: ${siteOrigin(origin)}/sitemap.xml\n`:'User-agent: *\nDisallow: /\n';
}
