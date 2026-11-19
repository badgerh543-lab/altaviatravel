import lighthouse from 'lighthouse';
import {launch} from 'chrome-launcher';
import {writeFile,mkdir} from 'node:fs/promises';
const chrome=await launch({chromePath:process.env.CHROME_PATH||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',chromeFlags:['--headless','--disable-gpu','--no-first-run']});
await mkdir('docs/performance',{recursive:true});
const baseURL=process.env.REVIEW_BASE_URL||'http://localhost:4321';
const preflight=await fetch(new URL('/en/',baseURL));
const html=await preflight.text();
if(!preflight.headers.has('content-security-policy')||html.includes('/@vite/client')){await chrome.kill();throw new Error('Performance review requires the compiled production preview with CSP; stop dev or set REVIEW_BASE_URL.');}
try{const summaries=[];for(const [name,path] of [['home','/en/'],['tour','/en/tours/silk-road-cities/'],['contact','/en/contact/']]){const result=await lighthouse(baseURL+path,{port:chrome.port,output:'json',logLevel:'error',onlyCategories:['performance','accessibility','best-practices','seo']});await writeFile(`docs/performance/${name}.json`,result.report);const summary={page:path,categories:Object.fromEntries(Object.entries(result.lhr.categories).map(([k,v])=>[k,Math.round(v.score*100)])),metrics:Object.fromEntries(['first-contentful-paint','largest-contentful-paint','cumulative-layout-shift','total-blocking-time'].map(k=>[k,result.lhr.audits[k]?.displayValue])),failures:Object.entries(result.lhr.audits).filter(([,a])=>a.score!==null&&a.score<0.9&&a.scoreDisplayMode!=='informative').map(([id,a])=>({id,title:a.title,score:a.score,details:a.details}))};summaries.push(summary);console.log(JSON.stringify({...summary,failures:summary.failures.map(a=>a.id)}));}await writeFile('docs/performance/summary.json',JSON.stringify(summaries,null,2));}finally{await chrome.kill();}
