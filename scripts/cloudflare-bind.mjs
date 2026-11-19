import {readFile,writeFile} from 'node:fs/promises';

// D1 identifiers are public deployment configuration; no credentials are written.
const id=process.argv[2];
if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||'')){
  console.error('Usage: npm run cloud:bind -- DATABASE_ID\nCopy the database_id returned by: npx wrangler d1 create altavia-inquiries');
  process.exitCode=1;
}else{
  const file=new URL('../wrangler.jsonc',import.meta.url),config=JSON.parse(await readFile(file,'utf8'));
  const current=config.d1_databases?.find(binding=>binding.binding==='DB');
  if(current&&current.database_id!==id)throw new Error('DB already points to another database. Review wrangler.jsonc before changing an existing production database.');
  config.d1_databases=[...(config.d1_databases||[]).filter(binding=>binding.binding!=='DB'),{binding:'DB',database_name:current?.database_name||'altavia-inquiries',database_id:id,migrations_dir:'migrations'}];
  await writeFile(file,JSON.stringify(config,null,2)+'\n');
  console.log('Saved the DB binding in wrangler.jsonc. Apply all migrations with: npx wrangler d1 migrations apply DB --remote --config wrangler.jsonc');
}
