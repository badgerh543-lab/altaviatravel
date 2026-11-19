import {buildRobots,indexingEnabled,siteOrigin} from '../../shared/seo.mjs';
export function GET(){
  return new Response(buildRobots(siteOrigin(import.meta.env.SITE_URL),import.meta.env.PROD&&indexingEnabled(import.meta.env.SITE_URL)),{headers:{'Content-Type':'text/plain; charset=utf-8'}});
}
