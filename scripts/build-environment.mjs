import {defaultSiteOrigin} from '../shared/seo.mjs';

export function buildEnvironment(input=process.env){
  const env={...input};
  if(env.WORKERS_CI==='1'&&env.WORKERS_CI_BRANCH){
    if(env.WORKERS_CI_BRANCH!=='main')env.SITE_URL='';
    else if(!env.SITE_URL)env.SITE_URL=defaultSiteOrigin;
  }
  return env;
}
