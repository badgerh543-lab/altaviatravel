import {writeFile,mkdir} from 'node:fs/promises';
import {collectionNames,validateContent} from '../server/content-validation.mjs';
if(process.env.CMS_SOURCE_URL){
  if(!/^https:\/\//.test(process.env.CMS_SOURCE_URL)||!process.env.CMS_BUILD_TOKEN)throw new Error('CMS build export requires HTTPS and a private build token.');
  const source=new URL('/api/cms/export/',process.env.CMS_SOURCE_URL);
  const response=await fetch(source,{headers:{Authorization:'Bearer '+process.env.CMS_BUILD_TOKEN},signal:AbortSignal.timeout(30000),redirect:'error'});
  if(!response.ok)throw new Error('CMS export failed. Build stopped to avoid publishing stale content.');
  const data=await response.json();const errors=validateContent(data.content);if(errors.length)throw new Error('CMS export failed validation: '+errors.join('; '));
  for(const name of collectionNames)await writeFile(`src/data/${name}.json`,JSON.stringify(data.content[name],null,2)+'\n');
  console.log(`Loaded published CMS revision ${data.revision}.`);
}else console.log('Using repository content (no CMS export configured).');
