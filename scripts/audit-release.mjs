import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,join,extname} from 'node:path';
import {seedContent} from '../server/content-seed.mjs';
import {publicRoutes,defaultSiteOrigin} from '../shared/seo.mjs';
const root=resolve(process.argv[2]||'dist'),production=process.argv.includes('--production'),errors=[];
const xml=await readFile(join(root,'sitemap.xml'),'utf8');
const urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>match[1]);
const expected=publicRoutes(seedContent);const domain=new URL(urls[0]).origin;
if(production&&domain!==defaultSiteOrigin)errors.push('Sitemap does not use the configured launch domain.');
if(urls.length!==expected.length||new Set(urls).size!==expected.length)errors.push('Sitemap public page count is incorrect.');
for(const path of expected)if(!urls.includes(domain+path))errors.push('Sitemap page missing: '+path);
for(const value of urls){
  const url=new URL(value),path=url.pathname;
  if(url.origin!==domain||!/^\/(uz|en|ru|ky|tg)\/(?:[a-z0-9-]+\/)*$/.test(path)){errors.push('Unexpected sitemap URL.');continue;}
  const html=await readFile(join(root,'.'+path,'index.html'),'utf8');
  if(!html.includes(`rel="canonical" href="${value}"`))errors.push(path+': canonical URL mismatch');
  const robots=html.match(/<meta name="robots" content="([^"]+)"/)?.[1];
  if(robots!==(production?'index, follow':'noindex, nofollow'))errors.push(path+': unexpected indexing directive');
  if((html.match(/rel="alternate" hreflang=/g)||[]).length!==6)errors.push(path+': missing language alternatives');
}
const robots=await readFile(join(root,'robots.txt'),'utf8'),headers=await readFile(join(root,'_headers'),'utf8');
if(production&&!robots.includes('Sitemap: '+domain+'/sitemap.xml'))errors.push('Production robots.txt has no sitemap.');
if(!production&&!robots.includes('Disallow: /'))errors.push('Preview robots.txt permits indexing.');
if(production&&!headers.includes('Strict-Transport-Security: max-age=31536000'))errors.push('Production HSTS header missing.');
const secrets=/Rust2021|FAKE-QA-PROVIDER-KEY|QA-MERCHANT-ONLY|BROWSER-QA-RECEIPT|editor-qa-|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i;
let scanned=0;
async function scan(dir){for(const file of await readdir(dir,{withFileTypes:true})){const path=join(dir,file.name);if(file.isDirectory())await scan(path);else if(['.html','.js','.json','.xml','.txt','.map','.css'].includes(extname(path))){scanned++;if(secrets.test(await readFile(path,'utf8')))errors.push('Private/test material found in '+path.slice(root.length));}}}
await scan(root);
let localizedGroups=0,translatedValues=0;
function translations(value,path){
  if(Array.isArray(value))value.forEach((item,index)=>translations(item,path+'.'+index));
  else if(value&&typeof value==='object'){
    const langs=['uz','en','ru','ky','tg'];if(langs.every(lang=>typeof value[lang]==='string')){localizedGroups++;for(const lang of langs){translatedValues++;if(!value[lang].trim()||/\uFFFD|\?{4}/.test(value[lang]))errors.push(path+'.'+lang+': empty or damaged translation');}}
    else for(const [key,item] of Object.entries(value))translations(item,path+'.'+key);
  }
}
for(const [name,collection] of Object.entries(seedContent))translations(collection,name);
const result={mode:production?'production build':'local compiled preview',domain,publicPages:urls.length,localizedGroups,translatedValues,scannedPublicTextFiles:scanned,errors};
await writeFile(production?'docs/production-build-audit.json':'docs/release-audit.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));if(errors.length)process.exitCode=1;
