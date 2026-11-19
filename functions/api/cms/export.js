import {handleContentExport} from '../../../server/admin.mjs';
export const onRequest=({request,env})=>handleContentExport(request,env);
