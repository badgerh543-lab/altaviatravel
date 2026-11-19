import { spawn } from 'node:child_process';
const children=[];
const run=(file,args)=>{const c=spawn(process.execPath,[...(file==='server/local.mjs'?['--watch-path=server','--watch-path=shared']:[]),file,...args],{stdio:'inherit',env:process.env});children.push(c);c.on('exit',code=>{if(code){for(const x of children)if(x!==c)x.kill();process.exitCode=code;}});return c;};
run('server/local.mjs',[]);
if(process.argv.includes('--preview'))run('server/preview.mjs',[]);else run('node_modules/astro/bin/astro.mjs',['dev','--host','localhost','--port','4321']);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{for(const c of children)c.kill();});
