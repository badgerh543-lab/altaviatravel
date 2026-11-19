import {readFile} from 'node:fs/promises';
import {decryptPayload} from '../server/inquiries.mjs';
if(!process.env.INQUIRY_ENCRYPTION_KEY||!process.argv[2]){console.error('Usage: node --env-file=.env.production.local scripts/decrypt-export.mjs .local/export.json');process.exit(1);}
const input=JSON.parse((await readFile(process.argv[2],'utf8')).replace(/^\uFEFF/,''));
const rows=Array.isArray(input)?input.flatMap(x=>x.results||x):input.results||[input];
for(const row of rows){if(!row.payload)continue;const payload=await decryptPayload(row.payload,process.env.INQUIRY_ENCRYPTION_KEY);console.log(JSON.stringify({reference:row.id,createdAt:row.created_at,expiresAt:row.expires_at,...payload},null,2));}
