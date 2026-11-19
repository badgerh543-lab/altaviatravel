import sharp from 'sharp';
import { readFile,writeFile,mkdir,copyFile } from 'node:fs/promises';
const records=JSON.parse(await readFile('src/data/media.json','utf8'));
for(const r of records){
 if(r.uploaded)continue;
 const source=`public/images/travel/${r.id}.jpg`;
 const metadata=await sharp(source).metadata();r.width=metadata.width;r.height=metadata.height;
 for(const w of [480,960,1600])await sharp(source).rotate().resize({width:w,withoutEnlargement:true}).webp({quality:80,effort:5}).toFile(`public/images/travel/${r.id}-${w}.webp`);
 r.variants=[480,960,1600].map(w=>({src:`/images/travel/${r.id}-${w}.webp`,width:Math.min(w,r.width)}));
}
await writeFile('src/data/media.json',JSON.stringify(records,null,2));
await mkdir('public/fonts',{recursive:true});
for(const font of ['manrope','unbounded'])for(const subset of ['latin','latin-ext','cyrillic','cyrillic-ext'])await copyFile(`node_modules/@fontsource-variable/${font}/files/${font}-${subset}-wght-normal.woff2`,`public/fonts/${font}-${subset}.woff2`);
for(const font of ['manrope','unbounded'])await copyFile(`node_modules/@fontsource-variable/${font}/LICENSE`,`public/fonts/OFL-${font}.txt`);
for(const width of [480,768,960])await sharp('public/images/travel/thailand.jpg').rotate().resize({width,height:Math.round(width*1.6),fit:'cover',position:'centre'}).webp({quality:70,effort:6}).toFile(`public/images/travel/thailand-mobile-${width}.webp`);
console.log(`Optimized ${records.length} photographs, mobile hero crops and local fonts.`);
