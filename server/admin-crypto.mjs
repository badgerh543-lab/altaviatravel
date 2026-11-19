import {pbkdf2Async} from '@noble/hashes/pbkdf2.js';
import {sha256 as sha256Hash} from '@noble/hashes/sha2.js';
const enc=new TextEncoder();
export async function passwordBits(password,salt,subtle=crypto.subtle){
  try{const key=await subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);return new Uint8Array(await subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:enc.encode(salt),iterations:600000},key,256));}
  catch(error){
    // Some hosted Workers cap native PBKDF2. Preserve the full work factor using
    // the independently audited portable implementation; never lower iterations.
    if(error.name!=='NotSupportedError')throw error;
    return pbkdf2Async(sha256Hash,enc.encode(password),enc.encode(salt),{c:600000,dkLen:32,asyncTick:10});
  }
}
export const randomToken=(size=32)=>Array.from(crypto.getRandomValues(new Uint8Array(size)),b=>b.toString(16).padStart(2,'0')).join('');
export const sha256=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
export function constantEqual(a,b){const x=enc.encode(String(a)),y=enc.encode(String(b));let different=x.length^y.length;for(let i=0;i<Math.max(x.length,y.length);i++)different|=(x[i]||0)^(y[i]||0);return different===0;}
export async function passwordHash(password){
  const salt=randomToken(16),iterations=600000;
  const bits=await passwordBits(password,salt);
  return `pbkdf2-sha256$${iterations}$${salt}$${Array.from(new Uint8Array(bits),b=>b.toString(16).padStart(2,'0')).join('')}`;
}
export async function passwordValid(password,hash){
  if(typeof password!=='string'||password.length>128)return false;
  const [algorithm,count,salt,expected]=String(hash||'').split('$');
  if(algorithm!=='pbkdf2-sha256'||Number(count)!==600000||!/^[a-f0-9]{32}$/.test(salt)||!/^[a-f0-9]{64}$/.test(expected))return false;
  const bits=await passwordBits(password,salt);
  return constantEqual(Array.from(new Uint8Array(bits),b=>b.toString(16).padStart(2,'0')).join(''),expected);
}
export const strongPassword=(p,minLength=12)=>typeof p==='string'&&p.length>=minLength&&p.length<=128&&!/^(.)\1+$/.test(p)&&!['password123456','rust2021rust2021','altaviatravel'].includes(p.toLowerCase());
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(bytes){let bits=0,value=0,out='';for(const byte of bytes){value=(value<<8)|byte;bits+=8;while(bits>=5){out+=alphabet[(value>>>(bits-5))&31];bits-=5;}}if(bits)out+=alphabet[(value<<(5-bits))&31];return out;}
function unbase32(text){let bits=0,value=0,out=[];for(const c of text){const index=alphabet.indexOf(c);if(index<0)throw new Error('Invalid TOTP key');value=(value<<5)|index;bits+=5;if(bits>=8){out.push((value>>>(bits-8))&255);bits-=8;}}return new Uint8Array(out);}
export const newTotpSecret=()=>base32(crypto.getRandomValues(new Uint8Array(20)));
export async function totpCode(secret,step=Math.floor(Date.now()/30000)){
  const key=await crypto.subtle.importKey('raw',unbase32(secret),{name:'HMAC',hash:'SHA-1'},false,['sign']);
  const bytes=new Uint8Array(8);new DataView(bytes.buffer).setBigUint64(0,BigInt(step));
  const hash=new Uint8Array(await crypto.subtle.sign('HMAC',key,bytes));const offset=hash[hash.length-1]&15;
  const number=((hash[offset]&127)<<24)|(hash[offset+1]<<16)|(hash[offset+2]<<8)|hash[offset+3];
  return String(number%1000000).padStart(6,'0');
}
export async function totpStep(secret,code,lastStep=-1,now=Date.now()){
  if(!/^\d{6}$/.test(String(code)))return null;const current=Math.floor(now/30000);
  for(const step of [current,current-1,current+1])if(step>lastStep&&constantEqual(await totpCode(secret,step),code))return step;
  return null;
}
