import { configured } from '../../server/inquiries.mjs';
export const onRequestGet = ({env}) => new Response(JSON.stringify({ready:configured(env),mode:'production',siteKey:env.TURNSTILE_SITE_KEY||null}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
