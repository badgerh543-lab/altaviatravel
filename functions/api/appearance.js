import {handleAppearance} from '../../server/appearance.mjs';
export const onRequest=({request,env})=>handleAppearance(request,env);
