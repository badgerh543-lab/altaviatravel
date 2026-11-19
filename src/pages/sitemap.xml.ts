import {buildSitemap,publicRoutes,siteOrigin} from '../../shared/seo.mjs';
import {tours,destinations} from '../data/travel';
import {articles} from '../data/articles';
export function GET(){
  return new Response(buildSitemap(publicRoutes({tours,destinations,articles}),siteOrigin(import.meta.env.SITE_URL)),{headers:{'Content-Type':'application/xml; charset=utf-8'}});
}
