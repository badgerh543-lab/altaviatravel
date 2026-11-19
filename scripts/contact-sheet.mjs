import sharp from 'sharp';import fs from 'node:fs/promises';
const m=JSON.parse(await fs.readFile('src/data/media.json','utf8'));await fs.mkdir('.local',{recursive:true});const c=[];
for(let i=0;i<m.length;i++){c.push({input:await sharp('public'+m[i].src).resize(300,190,{fit:'cover'}).toBuffer(),left:i%4*300,top:Math.floor(i/4)*220});c.push({input:Buffer.from(`<svg width="300" height="30"><rect width="300" height="30" fill="white"/><text x="8" y="20" font-size="16">${m[i].id}</text></svg>`),left:i%4*300,top:Math.floor(i/4)*220+190});}
await sharp({create:{width:1200,height:Math.ceil(m.length/4)*220,channels:3,background:'#ffffff'}}).composite(c).png().toFile('.local/contact-sheet.png');
