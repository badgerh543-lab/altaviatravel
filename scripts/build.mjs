import {spawnSync} from 'node:child_process';
import {buildEnvironment} from './build-environment.mjs';

const env=buildEnvironment();
for(const args of [['scripts/sync-content.mjs'],['scripts/validate-content.mjs'],['node_modules/astro/bin/astro.mjs','build'],['scripts/postbuild.mjs']]){
  const result=spawnSync(process.execPath,args,{env,stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status||1);
}
