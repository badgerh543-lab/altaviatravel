import {validateContent} from '../server/content-validation.mjs';
import {readFile,access} from 'node:fs/promises';
const languages=['uz','en','ru','ky','tg'];const errors=[];
const data={};for(const name of ['translations','tours','destinations','faqs','service-notes','articles','policies','gallery','media','company','hotels','places']){try{data[name]=JSON.parse(await readFile(`src/data/${name}.json`,'utf8'));}catch(e){errors.push(`${name}: ${e.message}`);}}
function check(condition,message){if(!condition)errors.push(message);}
function localized(value,path){if(!value||typeof value!=='object')return;if(languages.some(l=>l in value)){for(const l of languages){check(typeof value[l]==='string'&&value[l].trim().length>0,`${path}.${l}: translation required`);if(typeof value[l]==='string')check(!/\?{3,}|\uFFFD/.test(value[l]),`${path}.${l}: damaged text encoding`);}}for(const [k,v] of Object.entries(value))localized(v,`${path}.${k}`);}
errors.push(...validateContent(data));
for(const [name,value] of Object.entries(data))localized(value,name);
const unique=(rows,key,name)=>{const seen=new Set();for(const row of rows||[]){check(typeof row[key]==='string'&&/^[a-z0-9-]+$/.test(row[key]),`${name}: invalid ${key}`);check(!seen.has(row[key]),`${name}: duplicate ${row[key]}`);seen.add(row[key]);}};
for(const n of ['tours','destinations','articles'])unique(data[n],'slug',n);unique(data.media,'id','media');
for(const name of ['hotels','places'])unique(data[name],'id',name);
if(data.company?.instagram)check(/^https:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.]+\/?$/.test(data.company.instagram),'company.instagram: expected an Instagram profile URL');
for(const hotel of data.hotels||[])check(/^https:\/\//.test(hotel.url),`${hotel.id}: unsafe hotel URL`);
for(const place of data.places||[])check(/^https:\/\//.test(place.sourceUrl),`${place.id}: unsafe source URL`);
for(const tour of data.tours||[]){
  check(Array.isArray(tour.hotels)&&(tour.details||tour.hotels.length>0),`${tour.slug}: hotel examples required`);
  check(Array.isArray(tour.attractions)&&(tour.details||tour.attractions.length>0),`${tour.slug}: attractions required`);
  for(const id of tour.hotels||[])check(data.hotels?.some(h=>h.id===id),`${tour.slug}: missing hotel ${id}`);
  for(const id of tour.attractions||[])check(data.places?.some(p=>p.id===id),`${tour.slug}: missing attraction ${id}`);
  check(Array.isArray(tour.searchAliases)&&tour.searchAliases.every(s=>typeof s==='string'),`${tour.slug}: search aliases must be strings`);
}
const destinationIds=new Set(data.destinations?.map(d=>d.slug));const mediaIds=new Set(data.media?.map(m=>m.id));
for(const n of ['tours','destinations','articles','gallery'])for(const item of data[n]||[])check(mediaIds.has(item.image),`${n}: image ${item.image} is missing`);
for(const tour of data.tours||[]){check(Number.isInteger(tour.days)&&tour.days>0,`${tour.slug}: invalid days`);check(tour.itinerary.length===tour.days,`${tour.slug}: itinerary count must equal days`);check(['inbound','outbound','domestic'].includes(tour.type),`${tour.slug}: invalid type`);check(['culture','beach','adventure','city'].includes(tour.style),`${tour.slug}: invalid style`);check(tour.seasons.length&&tour.seasons.every(s=>['spring','summer','autumn','winter'].includes(s)),`${tour.slug}: invalid season`);for(const slug of tour.destinations)check(destinationIds.has(slug),`${tour.slug}: destination ${slug} missing`);tour.itinerary.forEach((day,i)=>{check(day.day===i+1,`${tour.slug}: day numbering`);check(tour.destinations.includes(day.destination),`${tour.slug}: day destination outside route`);});check(tour.price===null?tour.priceStatus==='on-request':Number.isFinite(tour.price)&&tour.price>0&&['verified-from','market-estimate'].includes(tour.priceStatus)&&tour.currency==='USD',`${tour.slug}: prices must be null/on-request or positive verified-from USD`);}
for(const m of data.media||[]){for(const k of ['author','license','sourceUrl','licenseUrl'])check(typeof m[k]==='string'&&m[k].length,`${m.id}: ${k} missing`);for(const k of ['sourceUrl','licenseUrl'])check(/^https:\/\//.test(m[k])||/^\/api\/media\/[a-f0-9-]+\/credit$/.test(m[k]),`${m.id}: unsafe credit URL`);for(const w of (m.uploaded?[]:[480,960,1600]))try{await access(`public/images/travel/${m.id}-${w}.webp`);}catch{errors.push(`${m.id}: missing ${w}px variant`);}}
const c=data.company;if(c){for(const k of ['email','privacyContact'])if(c[k])check(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c[k]),`company.${k}: email required`);for(const k of ['phone','whatsapp'])if(c[k])check(/^\+[0-9 ()-]{7,25}$/.test(c[k]),`company.${k}: international phone required`);if(c.telegram)check(/^https:\/\/t\.me\/[a-zA-Z0-9_]+$/.test(c.telegram),'company.telegram: expected https://t.me/username');if(process.env.BUSINESS_READY==='true'){for(const k of ['legalName','email','privacyContact','address'])check(Boolean(c[k]),`company.${k} required before public launch`);check(c.policiesApproved===true,'company.policiesApproved must be true before public launch');}}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log(`Content valid: ${data.tours.length} tours, ${data.destinations.length} destinations, ${data.articles.length} articles, ${data.media.length} photographs; all five languages complete.`);
