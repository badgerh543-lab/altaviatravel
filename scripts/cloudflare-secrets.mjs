import {mkdir,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';

const directory=new URL('../.local/',import.meta.url),file=new URL('cloudflare-secrets.json',directory);
await mkdir(directory,{recursive:true,mode:0o700});
try{
  await writeFile(file,JSON.stringify({INQUIRY_ENCRYPTION_KEY:randomBytes(32).toString('base64'),RATE_LIMIT_SECRET:randomBytes(48).toString('base64'),CMS_BUILD_TOKEN:randomBytes(48).toString('base64')},null,2)+'\n',{flag:'wx',mode:0o600});
  console.log('Created private .local/cloudflare-secrets.json without displaying its values. Back it up securely. Upload it only when configuring a new production database; retain any existing database encryption key.');
}catch(error){
  if(error.code!=='EEXIST')throw error;
  console.log('The private secrets file already exists. It was not changed. Reuse the existing keys for the same database.');
}
