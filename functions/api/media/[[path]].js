import {serveImage} from '../../../server/admin-media.mjs';
export const onRequestGet=({request,env})=>serveImage(request,env);
