import { request } from 'node:http';
export function proxyAPI(req,res,next){
 if(!req.url?.startsWith('/api/'))return next();
 const upstream=request({hostname:'127.0.0.1',port:Number(process.env.API_PORT||8788),path:req.url.replace(/\/$/,''),method:req.method,headers:req.headers},response=>{res.writeHead(response.statusCode||503,response.headers);response.pipe(res)});
 upstream.on('error',()=>{if(!res.headersSent)res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":"unavailable"}')});req.pipe(upstream);
}
