import { defineConfig } from 'astro/config';
import { proxyAPI } from './server/proxy.mjs';
import {siteOrigin} from './shared/seo.mjs';
export default defineConfig({output:'static',devToolbar:{enabled:false},site:siteOrigin(process.env.SITE_URL),trailingSlash:'always',build:{inlineStylesheets:'never'},integrations:[{name:'local-inquiry-api',hooks:{'astro:server:setup':({server})=>{server.middlewares.use(proxyAPI);}}}],vite:{server:{strictPort:true},build:{assetsInlineLimit:0}}});
