import {seedContent} from './content-seed.mjs';
export const collectionNames=['tours','destinations','articles','gallery','media','faqs','service-notes','translations','policies','company','hotels','places'];
export const localeNames=['uz','en','ru','ky','tg'];
export const safeUrl=value=>typeof value==='string'&&(/^https:\/\/[^\s<>"']+$/.test(value)||/^\/api\/media\/[a-f0-9-]+\/credit$/.test(value));
const slug=s=>typeof s==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)&&s.length<=100;
const localImage=s=>typeof s==='string'&&/^\/(images\/travel\/[a-z0-9-]+\.(webp|jpg|png)|api\/media\/[a-f0-9-]+\/(480|960|1600))$/.test(s);
export function validateContent(content){
  const errors=[];let nodes=0;
  const check=(ok,message)=>{if(!ok&&errors.length<60)errors.push(message);};
  const localized=(value,path)=>{check(value&&typeof value==='object'&&!Array.isArray(value),`${path}: all five translations required`);if(value&&typeof value==='object')for(const lang of localeNames)check(typeof value[lang]==='string'&&value[lang].trim().length>0,`${path}.${lang}: required`);};
  function tree(value,path){nodes++;if(nodes>80000)throw new Error('Content too complex');if(typeof value==='string'){check(value.length<=12000&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]|\uFFFD|\?{4}/.test(value),`${path}: invalid text`);}else if(Array.isArray(value)){check(value.length<=500,`${path}: too many entries`);value.forEach((x,i)=>tree(x,`${path}.${i}`));}else if(value&&typeof value==='object'){for(const [key,v] of Object.entries(value)){check(!['__proto__','prototype','constructor'].includes(key),`${path}: reserved field`);tree(v,`${path}.${key}`);}if(localeNames.some(l=>Object.hasOwn(value,l)))localized(value,path);}else check(value===null||typeof value==='boolean'||(typeof value==='number'&&Number.isFinite(value)),`${path}: invalid value`);}
  try{
    check(content&&typeof content==='object'&&!Array.isArray(content),'A content object is required');if(!content)return errors;
    check(Object.keys(content).sort().join(',')===collectionNames.slice().sort().join(','),'Unexpected or missing content collection');tree(content,'content');
    for(const name of ['tours','destinations','articles','gallery','media','faqs','hotels','places'])check(Array.isArray(content[name]),`${name}: list required`);
    if(errors.length)return errors;
    function shape(value,template,path){
      if(template===null)return;
      if(Array.isArray(template)){check(Array.isArray(value),`${path}: list required`);if(Array.isArray(value)&&template.length)for(const item of value)shape(item,template[0],path+'[]');return;}
      if(template&&typeof template==='object'){check(value&&typeof value==='object'&&!Array.isArray(value),`${path}: object required`);if(!value||typeof value!=='object')return;for(const [key,item] of Object.entries(template)){if(['details','price','visible','priceSource','priceCheckedOn','priceBasis'].includes(key))continue;check(Object.hasOwn(value,key),`${path}.${key}: field required`);if(Object.hasOwn(value,key))shape(value[key],item,path+'.'+key);}return;}
      check(typeof value===typeof template,`${path}: expected ${typeof template}`);
    }
    for(const name of collectionNames)shape(content[name],seedContent[name],name);
    // These photographs are referenced directly by the home and section layouts.
    for(const id of ['samarkand','khiva','cappadocia','fergana','thailand','bukhara','mountains','malaysia','tashkent','dubai'])check(content.media.some(m=>m.id===id),`${id}: photograph is still used by a page layout`);
    for(const name of ['tours','destinations','articles','media','hotels','places']){const ids=new Set();const key=['tours','destinations','articles'].includes(name)?'slug':'id';for(const row of content[name]){check(row&&typeof row==='object'&&!Array.isArray(row),`${name}: invalid record`);if(!row)continue;check(slug(row[key])&&!ids.has(row[key]),`${name}: unique valid ${key} required`);ids.add(row[key]);}}
    const ids=name=>new Set(content[name].map(row=>row.slug||row.id));const destinationIds=ids('destinations'),imageIds=ids('media'),hotelIds=ids('hotels'),placeIds=ids('places');
    for(const tour of content.tours){
      localized(tour.title,`${tour.slug}.title`);localized(tour.summary,`${tour.slug}.summary`);
      check(Number.isInteger(tour.days)&&tour.days>=1&&tour.days<=90,`${tour.slug}: duration 1–90 days required`);
      check(Array.isArray(tour.itinerary)&&tour.itinerary.length===tour.days,`${tour.slug}: one itinerary entry per day required`);
      check(Array.isArray(tour.destinations)&&tour.destinations.length>0&&tour.destinations.every(id=>destinationIds.has(id)),`${tour.slug}: valid destinations required`);
      check(imageIds.has(tour.image),`${tour.slug}: choose an image`);
      check(tour.price===null?tour.priceStatus==='on-request':Number.isFinite(tour.price)&&tour.price>0&&tour.price<=1000000&&['market-estimate','verified-from'].includes(tour.priceStatus),`${tour.slug}: valid price and price status required`);
      if(tour.priceSource)check(safeUrl(tour.priceSource),`${tour.slug}: price source must be HTTPS`);
      check(tour.currency==='USD',`${tour.slug}: catalog prices use USD per person`);
      check(['inbound','outbound','domestic'].includes(tour.type),`${tour.slug}: invalid tour type`);check(['culture','beach','adventure','city'].includes(tour.style),`${tour.slug}: invalid style`);
      check(Array.isArray(tour.seasons)&&tour.seasons.length>0&&tour.seasons.every(x=>['spring','summer','autumn','winter'].includes(x)),`${tour.slug}: select seasons`);
      check(typeof tour.countryId==='string'&&content.destinations.some(d=>d.countryId===tour.countryId),`${tour.slug}: invalid country`);
      check(Array.isArray(tour.hotels)&&(tour.details||tour.hotels.length>0)&&tour.hotels.every(id=>hotelIds.has(id)),`${tour.slug}: choose hotel examples`);
      check(Array.isArray(tour.attractions)&&(tour.details||tour.attractions.length>0)&&tour.attractions.every(id=>placeIds.has(id)),`${tour.slug}: choose attractions`);
      if(tour.details){
        const detail=tour.details;
        for(const key of ['highlights','included','excluded']){check(Array.isArray(detail[key])&&detail[key].length>0,`${tour.slug}: add ${key}`);for(const [i,item] of (detail[key]||[]).entries())localized(item,`${tour.slug}.${key}.${i+1}`);}
        for(const key of ['accommodation','transport','suitable','practical'])localized(detail[key],`${tour.slug}.${key}`);
        for(const key of ['hotels','attractions','faqs'])check(Array.isArray(detail[key])&&detail[key].length>0,`${tour.slug}: add ${key}`);
        for(const [i,hotel] of (detail.hotels||[]).entries()){check(typeof hotel.name==='string'&&hotel.name.trim().length>0,`${tour.slug}: hotel ${i+1} name required`);check(safeUrl(hotel.url),`${tour.slug}: hotel ${i+1} website must use HTTPS`);localized(hotel.area,`${tour.slug}.hotel${i+1}.area`);localized(hotel.description,`${tour.slug}.hotel${i+1}.description`);}
        for(const [i,place] of (detail.attractions||[]).entries()){localized(place.name,`${tour.slug}.attraction${i+1}.name`);localized(place.description,`${tour.slug}.attraction${i+1}.description`);check(safeUrl(place.sourceUrl)&&typeof place.optional==='boolean',`${tour.slug}: attraction ${i+1} source and optional flag required`);}
        for(const [i,faq] of (detail.faqs||[]).entries()){localized(faq.q,`${tour.slug}.faq${i+1}.question`);localized(faq.a,`${tour.slug}.faq${i+1}.answer`);}
      }
      check(Array.isArray(tour.searchAliases)&&tour.searchAliases.every(x=>typeof x==='string'),`${tour.slug}: invalid aliases`);
      check(Array.isArray(tour.travelNotes),`${tour.slug}: travel notes required`);
      if(tour.visible!==undefined)check(typeof tour.visible==='boolean',`${tour.slug}: visible must be a checkbox`);
      for(const [i,day] of (tour.itinerary||[]).entries()){check(day.day===i+1&&tour.destinations?.includes(day.destination),`${tour.slug}: invalid day ${i+1}`);localized(day.title,`${tour.slug}.day${i+1}.title`);localized(day.description,`${tour.slug}.day${i+1}.description`);}
    }
    for(const destination of content.destinations){localized(destination.name,'destination.name');localized(destination.country,'destination.country');localized(destination.summary,'destination.summary');check(Array.isArray(destination.highlights)&&destination.highlights.length>0,'Destination highlights required');check(['uzbekistan','international'].includes(destination.region),'Invalid destination region');}
    for(const name of ['tours','destinations','articles','gallery'])for(const row of content[name])check(imageIds.has(row.image),`${name}: image is missing or still in use`);
    for(const article of content.articles){localized(article.title,'article.title');localized(article.intro,'article.intro');check(Number.isInteger(article.minutes)&&article.minutes>0,'Article reading time required');check(Array.isArray(article.sections)&&article.sections.length>0,'Article sections required');}
    for(const record of content.media){check(record.width>0&&record.height>0,`${record.id}: image dimensions required`);check(localImage(record.src),`${record.id}: images must be local approved assets`);check(Array.isArray(record.variants)&&record.variants.length>0&&record.variants.every(v=>localImage(v.src)&&Number.isInteger(v.width)&&v.width>0),`${record.id}: invalid image variants`);check(safeUrl(record.sourceUrl)&&safeUrl(record.licenseUrl),`${record.id}: safe credit URLs required`);check(typeof record.author==='string'&&record.author.length>0&&typeof record.license==='string'&&record.license.length>0,`${record.id}: author/license required`);}
    for(const record of content.media){
      if(record.uploaded){const id=record.src?.match(/^\/api\/media\/([a-f0-9-]+)\/(480|960|1600)$/)?.[1];check(Boolean(id)&&record.id==='upload-'+id&&record.variants.every(v=>v.src.startsWith('/api/media/'+id+'/')),`${record.id}: preserve uploaded image identity`);}
      else check(record.variants.every(v=>v.src===`/images/travel/${record.id}-${v.width}.webp`)&&record.variants.some(v=>v.src===record.src),`${record.id}: preserve local image paths; use Upload for a new image`);
    }
    for(const record of content.gallery){localized(record.caption,'gallery.caption');check(Array.isArray(record.categories)&&record.categories.every(c=>['uzbekistan','international','groups','culture','adventure','hotels','customers'].includes(c)),'Invalid gallery category');}
    for(const record of content.hotels){localized(record.area,'hotel.area');localized(record.description,'hotel.description');check(typeof record.name==='string'&&record.name.length>0&&safeUrl(record.url),'Invalid hotel name or website');}
    for(const record of content.places){localized(record.name,'place.name');localized(record.description,'place.description');check(safeUrl(record.sourceUrl),'Invalid attraction source URL');}
    for(const faq of content.faqs){localized(faq.q,'faq.question');localized(faq.a,'faq.answer');}
    const c=content.company;check(c&&typeof c.name==='string'&&typeof c.brandLine==='string','Company name and brand line required');
    if(c){for(const key of ['email','privacyContact'])if(c[key])check(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c[key]),`company.${key}: invalid email`);for(const key of ['phone','whatsapp'])if(c[key])check(/^\+[0-9 ()-]{7,25}$/.test(c[key]),`company.${key}: invalid phone`);if(c.instagram)check(/^https:\/\/(www\.)?instagram\.com\/[\w.]+\/?$/.test(c.instagram),'Invalid Instagram profile');if(c.telegram)check(/^https:\/\/t\.me\/\w+$/.test(c.telegram),'Invalid Telegram profile');}
  }catch{errors.push('Content has an invalid structure or is too complex');}
  return errors;
}
