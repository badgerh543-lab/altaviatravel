import { handleInquiry } from '../../server/inquiries.mjs';
export const onRequest = ({request,env}) => handleInquiry(request,env);
