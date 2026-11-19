import {readdir,readFile,writeFile} from 'node:fs/promises';import {join,relative} from 'node:path';import {createHash} from 'node:crypto';
import {buildSitemap,buildRobots,indexingEnabled,siteOrigin} from '../shared/seo.mjs';
const output=process.env.BUILD_OUTPUT||'dist';
const langs=['uz','en','ru','ky','tg'];const files=[];async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())await walk(p);else if(p.endsWith('.html'))files.push(p);}}await walk(output);
const scriptHashes=new Set();const routes=[];
for(const file of files){const html=await readFile(file,'utf8');for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){if(!m[1].includes('src=')&&!m[1].includes('application/ld+json')&&m[2].trim())scriptHashes.add(`'sha256-${createHash('sha256').update(m[2]).digest('base64')}'`);}if(file.endsWith('index.html'))routes.push('/'+relative(output,file).replaceAll('\\','/').replace(/index.html$/,''));}
const configured=indexingEnabled(process.env.SITE_URL);
const base=siteOrigin(process.env.SITE_URL);
await writeFile(join(output,'sitemap.xml'),buildSitemap(routes,base));
await writeFile(join(output,'robots.txt'),buildRobots(base,configured));
const csp=`default-src 'self'; script-src 'self' https://challenges.cloudflare.com ${[...scriptHashes].join(' ')}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`;
await writeFile(join(output,'_headers'),`/*\n  Content-Security-Policy: ${csp}\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n${configured?'  Strict-Transport-Security: max-age=31536000\n':''}\n/_astro/*\n  Cache-Control: public, max-age=31536000, immutable\n\n/images/travel/*\n  Cache-Control: public, max-age=604800\n\n/edit\n  Cache-Control: private, no-store\n  X-Robots-Tag: noindex, nofollow, noarchive\n  Referrer-Policy: no-referrer\n\n/edit/*\n  Cache-Control: private, no-store\n  X-Robots-Tag: noindex, nofollow, noarchive\n  Referrer-Policy: no-referrer\n\n/fonts/*\n  Cache-Control: public, max-age=31536000, immutable\n`);
console.log(`SEO: ${routes.length} routes; ${scriptHashes.size} inline executable script hashes; indexing ${configured?'enabled':'disabled until SITE_URL is set'}.`);
