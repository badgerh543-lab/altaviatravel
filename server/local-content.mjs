import {readFile,writeFile,mkdir,rename,open} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {collectionNames,validateContent} from './content-validation.mjs';
let publishing=false;
export async function publishLocalContent(content,revision){
  if(publishing)throw new Error('A local build is already running.');const errors=validateContent(content);if(errors.length)throw new Error('Invalid content.');publishing=true;
  const backup=resolve('.local','content-backups',new Date().toISOString().replaceAll(':','-')+'-'+revision);const original=new Map();
  try{
    await mkdir(backup,{recursive:true,mode:0o700});
    for(const name of collectionNames){const path=resolve('src/data',name+'.json');const previous=await readFile(path,'utf8');original.set(path,previous);await writeFile(resolve(backup,name+'.json'),previous,{mode:0o600});}
    for(const name of collectionNames){const path=resolve('src/data',name+'.json');const temporary=path+'.publishing';await writeFile(temporary,JSON.stringify(content[name],null,2)+'\n');await rename(temporary,path);}
    // Vite on Windows can keep watched directories open. node_modules is ignored
    // by the watcher and stays on the same filesystem as dist for promotion.
    const staging=resolve('node_modules','.cache','altavia-publish-'+crypto.randomUUID());
    const run=async(args,extra={})=>{const log=await open(resolve(backup,'build.log'),'a',0o600);try{await new Promise((success,failure)=>{const child=spawn(process.execPath,args,{env:{...process.env,CMS_SOURCE_URL:'',CMS_BUILD_TOKEN:'',...extra},stdio:['ignore',log.fd,log.fd]});const timeout=setTimeout(()=>{child.kill();failure(new Error('Build timeout'));},120000);child.on('error',error=>{clearTimeout(timeout);failure(error);});child.on('exit',code=>{clearTimeout(timeout);code===0?success():failure(new Error('Build failed'));});});}finally{await log.close();}};
    await run(['node_modules/astro/bin/astro.mjs','build','--outDir',staging]);
    await run(['scripts/postbuild.mjs'],{BUILD_OUTPUT:staging});
    // Keep the previous output intact until every page and header has been built.
    let moved=false;try{await rename(resolve('dist'),resolve(backup,'previous-site'));moved=true;}catch(error){if(error.code!=='ENOENT')throw error;}
    try{await rename(staging,resolve('dist'));}catch(error){if(moved)await rename(resolve(backup,'previous-site'),resolve('dist'));throw error;}
  }catch(error){for(const [path,text] of original)await writeFile(path,text);throw error;}
  finally{publishing=false;}
}
