import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {request} from 'node:http';import {randomUUID} from 'node:crypto';

test('local HTTP server drains rejected streaming bodies and remains able to save inquiries',{timeout:20000},async()=>{
  const dir=await mkdtemp(join(tmpdir(),'altavia-http-test-'));const child=spawn(process.execPath,['server/local.mjs'],{env:{...process.env,API_PORT:'18788',INQUIRY_DATA_DIR:dir,SITE_URL:'http://localhost:4321'},stdio:['ignore','pipe','pipe']});
  const exited=new Promise(resolve=>child.once('exit',resolve));
  try{
    await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',()=>reject(new Error('Local server exited before readiness')));});
    const stream=(origin)=>new Promise((resolve,reject)=>{const req=request('http://127.0.0.1:18788/api/inquiries',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','Transfer-Encoding':'chunked'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);for(let i=0;i<10;i++)req.write('x'.repeat(8192));req.end();});
    assert.equal(await stream('http://localhost:4321'),413);
    assert.equal(await stream('https://other.example'),403);
    const ready=await fetch('http://127.0.0.1:18788/api/status');assert.equal(ready.status,200);
    const saved=await fetch('http://127.0.0.1:18788/api/inquiries',{method:'POST',headers:{Origin:'http://localhost:4321','Content-Type':'application/json'},body:JSON.stringify({requestId:randomUUID(),name:'HTTP test',email:'http-test@example.test',adults:1,children:0,language:'en',messaging:'email',consent:true})});
    assert.equal(saved.status,201);assert.equal((await saved.json()).saved,true);
  }finally{child.kill();await exited;await rm(dir,{recursive:true,force:true});}
});
