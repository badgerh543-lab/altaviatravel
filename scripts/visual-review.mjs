import {chromium} from '@playwright/test';import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
async function loadPhotos(){await page.evaluate(async()=>{document.querySelectorAll('[data-defer]').forEach(el=>el.style.contentVisibility='visible');document.querySelectorAll('img').forEach(i=>i.loading='eager');await Promise.all(Array.from(document.images).map(i=>i.decode().catch(()=>{})));await document.fonts.ready;});}
await page.goto('http://localhost:4321/en/',{waitUntil:'networkidle'});await loadPhotos();await fs.mkdir('docs/screenshots',{recursive:true});await page.screenshot({path:'docs/screenshots/home-desktop.png',fullPage:true});await page.screenshot({path:'docs/screenshots/home-desktop-top.png'});
await page.setViewportSize({width:390,height:844});await page.goto('http://localhost:4321/uz/',{waitUntil:'networkidle'});await loadPhotos();await page.screenshot({path:'docs/screenshots/home-mobile.png',fullPage:true});await page.screenshot({path:'docs/screenshots/home-mobile-top.png'});
console.log({errors});await browser.close();
