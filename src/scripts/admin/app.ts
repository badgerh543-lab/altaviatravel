import {renderThemes} from './themes';
import QRCode from 'qrcode';
import {h,button,field,check,card,notice,download,openDialog,type JsonRecord} from './ui';
import {renderBookings} from './bookings';
import {renderDashboard} from './dashboard';
import {renderTours,renderContent,renderMedia,reviewPublish} from './content';
import {renderUsers,renderPayments,renderAudit} from './settings';
export interface Workspace {user:JsonRecord|null;csrf:string;collections:JsonRecord;templates:JsonRecord;revision:number;locale:string;api:(path:string,data?:any)=>Promise<any>;run:(work:()=>Promise<unknown>)=>Promise<void>;refreshContent:()=>Promise<JsonRecord>;go:(tab:string)=>Promise<void>;message:(text:string,error?:boolean)=>void;host:HTMLElement;}
const root=document.querySelector<HTMLElement>('#edit-app')!;
const workspace:Workspace={user:null,csrf:'',collections:{},templates:{},revision:0,locale:'en',host:root,api,run,refreshContent,go,message};
let activeTab='Dashboard',messageNode:HTMLElement|null=null;let navigating=0;
let loginOptions={localLogin:false,passwordMinLength:12,mfaRequired:true};
async function api(path:string,data?:any){
  const target=new URL('/api/admin/'+path,location.origin);target.pathname=target.pathname.replace(/\/$/,'')+'/';
  const response=await fetch(target,{method:data===undefined?'GET':'POST',headers:{Accept:'application/json',...(data===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':workspace.csrf})},body:data===undefined?undefined:JSON.stringify(data),credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(path==='publish'?150000:25000)});
  if(!response.headers.get('content-type')?.toLowerCase().includes('application/json'))throw new Error(response.status===404?'The admin API is missing from this deployment. Deploy the backend, then configure its database and secrets.':'The admin service did not return a valid response. Please try again or check the deployment.');
  let result:JsonRecord;try{result=await response.json();}catch{throw new Error('The admin service returned an empty or invalid response. Please check the backend deployment.');}
  if(!result||typeof result!=='object'||Array.isArray(result))throw new Error('The admin service returned an invalid response.');
  if(!response.ok){if(response.status===401&&path!=='login'){workspace.user=null;workspace.collections={};workspace.csrf='';renderLogin();}throw new Error([result.error||'The operation could not be completed.',...(Array.isArray(result.fields)?result.fields:[])].join('\n'));}
  if(result.csrf)workspace.csrf=result.csrf;if(result.user)workspace.user=result.user;return result;
}
function message(text:string,error=false){if(!messageNode){messageNode=h('div',{'aria-live':'polite',tabindex:'-1'});workspace.host.prepend(messageNode);}messageNode.className=error?'edit-error':'edit-success';messageNode.textContent=text;messageNode.focus();}
async function run(work:()=>Promise<unknown>){try{await work();}catch(error){message(error instanceof Error?error.message:'The operation could not be completed.',true);}}
async function refreshContent(){const data=await api('content');workspace.collections=data.collections;workspace.templates=data.templates;workspace.revision=data.revision;return data;}
function renderLogin(){
  messageNode=null;workspace.host=root;root.removeAttribute('aria-busy');
  const data={username:'',password:'',code:''};const form=h('form',{class:'edit-form'});
  const submit=h('button',{class:'button',type:'submit'},['Sign in']);
  form.append(field('Username',data.username,v=>data.username=v,{required:true,autocomplete:'username',maxlength:40}),field('Password',data.password,v=>data.password=v,{type:'password',required:true,autocomplete:'current-password',maxlength:128}),loginOptions.localLogin?document.createTextNode(''):field('Authenticator or recovery code',data.code,v=>data.code=v,{autocomplete:'one-time-code',maxlength:30,placeholder:'Use a fresh code from your authenticator'}),submit);
  if(loginOptions.localLogin)form.append(button('Forgot password?',()=>{const {body}=openDialog('Reset your local password');const username=/^[a-z0-9][a-z0-9_.-]{2,39}$/.test(data.username)?data.username:'developer';body.append(h('p',{},['Run this in your project terminal, choose a password with 8 or more characters, then sign in here.']),h('pre',{class:'edit-code'},['npm run admin -- recover --username '+username]));}));
  const feedback=h('div',{'aria-live':'polite'});form.addEventListener('submit',async event=>{event.preventDefault();submit.disabled=true;submit.textContent='Signing in…';feedback.replaceChildren();try{await api('login',data);activeTab='Dashboard';data.password='';data.code='';await renderShell();}catch(error){feedback.className='edit-error';feedback.textContent=(error as Error).message;form.querySelector<HTMLInputElement>('[type=password]')!.value='';data.password='';}finally{submit.disabled=false;submit.textContent='Sign in';}});
  root.replaceChildren(h('div',{class:'edit-login'},[h('section',{class:'edit-login-story'},[h('img',{src:'/images/brand/altavia-mark.svg',alt:'Altavia travel',width:320,height:111}),h('h1',{},['Good journeys start behind the scenes.']),h('p',{},['Bookings, thoughtful tour details and the people who bring every trip together.']),h('small',{},['Altavia travel · Team workspace'])]),h('main',{id:'edit-main',class:'edit-login-panel'},[h('div',{},[h('span',{class:'eyebrow orange'},['Private workspace']),h('h2',{},['Welcome back.']),h('p',{},[loginOptions.localLogin?'Use your username and password. This computer stays signed in for seven days unless you sign out.':'Sign in with your individual staff account and a fresh authenticator or recovery code.']),feedback,form])])]));
}
async function renderShell(){
  if(!workspace.user)return renderLogin();root.removeAttribute('aria-busy');
  const setup=workspace.user.mustChangePassword||(workspace.user.mfaRequired&&!workspace.user.mfaEnabled);
  const full=['developer','owner'].includes(workspace.user.role);const tabs=setup?['Account']:full?['Dashboard','Bookings','Tours','Theme','Content','Images','Users','Payments','Audit','Account']:['Dashboard','Bookings','Tours','Theme','Account'];
  const nav=h('nav',{class:'edit-nav','aria-label':'Workspace'});const main=h('main',{id:'edit-main',class:'edit-main'});const panel=h('div');messageNode=null;
  const sidebar=h('aside',{class:'edit-sidebar'},[h('div',{class:'edit-sidebar-brand'},[h('img',{src:'/images/brand/altavia-mark-white.svg',alt:'',width:74,height:26}),h('span',{},['altavia.'])]),h('p',{class:'edit-role'},[workspace.user.role+' workspace']),nav,h('div',{class:'edit-sidebar-bottom'},[h('a',{href:'/uz/'},['Open website ↗']),button('Sign out',()=>run(async()=>{await api('logout',{});workspace.user=null;workspace.collections={};workspace.csrf='';renderLogin();}),'')])]);
  const heading=h('h1',{},[setup?'Secure your account':'Dashboard']);const toolbar=h('header',{class:'edit-toolbar'},[h('div',{},[heading,h('p',{},['Altavia travel by Travero Group M.Ch.J.'])]),h('div',{class:'edit-toolbar-actions'},[h('span',{class:'edit-user'},[workspace.user.username+' · '+workspace.user.role]),setup?null:button('Review & publish',()=>run(()=>reviewPublish(workspace)),'button')])]);
  main.append(toolbar,panel);root.replaceChildren(h('div',{class:'edit-shell'},[sidebar,main]));workspace.host=panel;
  for(const tab of tabs)nav.append(button(tab,()=>run(()=>go(tab))));
  workspace.go=go;async function go(tab:string){const request=++navigating;activeTab=tab;heading.textContent=setup?'Secure your account':tab;nav.querySelectorAll('button').forEach(node=>node.setAttribute('aria-current',node.textContent===tab?'page':'false'));panel.replaceChildren(h('p',{class:'edit-progress'},['Loading…']));messageNode=null;workspace.host=panel;
    try{if(tab==='Account'){panel.replaceChildren();await renderAccount(panel);return;}await refreshContent();if(request!==navigating)return;const view=h('div');panel.replaceChildren(view);const screen={...workspace,host:view};Object.defineProperty(screen,'locale',{get:()=>workspace.locale,set:(value:string)=>workspace.locale=value});if(tab==='Dashboard')await renderDashboard(screen);else if(tab==='Bookings')await renderBookings(screen);else if(tab==='Tours')renderTours(screen);else if(tab==='Theme')await renderThemes(screen);else if(tab==='Content')renderContent(screen);else if(tab==='Images')renderMedia(screen);else if(tab==='Users')await renderUsers(screen);else if(tab==='Payments')await renderPayments(screen);else if(tab==='Audit')await renderAudit(screen);}catch(error){if(request===navigating)message((error as Error).message,true);}
  }
  workspace.go=go;await go(setup?'Account':tabs.includes(activeTab)?activeTab:'Dashboard');
}
async function go(tab:string){activeTab=tab;await renderShell();}
async function renderAccount(host:HTMLElement){
  const user=workspace.user!;if(user.mustChangePassword)host.append(notice('Change the initial password before accessing any business data. Choose at least 12 characters; use a unique password or passphrase.'));
  const minimum=user.passwordMinLength||12;
  const data={currentPassword:'',password:'',confirm:'',code:''};const form=h('form',{class:'edit-form'});const submit=h('button',{type:'submit',class:'button'},['Change password']);
  form.append(h('div',{class:'edit-grid'},[field('Current password',data.currentPassword,v=>data.currentPassword=v,{type:'password',required:true,autocomplete:'current-password',maxlength:128}),field(`New password (${minimum}–128 characters)`,data.password,v=>data.password=v,{type:'password',required:true,minlength:minimum,maxlength:128,autocomplete:'new-password'}),field('Confirm new password',data.confirm,v=>data.confirm=v,{type:'password',required:true,minlength:minimum,autocomplete:'new-password'}),user.mfaRequired&&user.mfaEnabled?field('Fresh authenticator or recovery code',data.code,v=>data.code=v,{required:true,autocomplete:'one-time-code',maxlength:30}):null]),h('div',{class:'edit-actions'},[submit]));
  form.addEventListener('submit',event=>{event.preventDefault();void run(async()=>{if(data.password!==data.confirm)throw new Error('The new passwords do not match.');submit.disabled=true;try{await api('password',data);await renderShell();message('Password changed. Other sessions have been signed out.');}finally{submit.disabled=false;}});});
  host.append(card('Password', [form]));
  if(user.localLogin){host.append(notice('Local sign-in uses your username and password, with a minimum of 8 characters. No authenticator or forced password change is needed on this computer. Sign out when using a shared computer.'));return;}
  if(user.mustChangePassword)return;
  if(user.mfaEnabled){host.append(card('Two-factor authentication',[notice('Enabled. Use an authenticator app for sign-in. Each code can be used once; use the next code for sensitive changes. Keep recovery codes somewhere private. An owner/developer can reset a lost authenticator after verifying your identity.') ]));return;}
  const container=h('div');host.append(card('Set up two-factor authentication',[h('p',{class:'edit-muted'},['Use an authenticator app such as Google Authenticator, Microsoft Authenticator or 1Password. The QR code is generated on this page; no setup key is sent to an outside QR service.']),container]));
  container.append(button('Start authenticator setup',()=>run(async()=>{
    const result=await api('mfa/start',{});container.replaceChildren();const canvas=h('canvas',{class:'edit-qr','aria-label':'Authenticator setup QR code',role:'img'});await QRCode.toCanvas(canvas,result.uri,{width:240,margin:2,color:{dark:'#143b37',light:'#ffffff'}});const code={value:''};const confirmation=h('form',{class:'edit-form'});const submit=h('button',{type:'submit',class:'button'},['Verify and enable']);
    confirmation.append(field('Six-digit code from your app',code.value,v=>code.value=v,{required:true,inputmode:'numeric',pattern:'[0-9]{6}',maxlength:6,autocomplete:'one-time-code'}),submit);
    container.append(canvas,h('p',{class:'edit-muted'},['Or enter this setup key manually:']),h('p',{class:'edit-code'},[result.secret]),confirmation);
    confirmation.addEventListener('submit',event=>{event.preventDefault();void run(async()=>{submit.disabled=true;try{const verified=await api('mfa/confirm',{code:code.value});activeTab='Dashboard';await renderShell();const {dialog,body}=openDialog('Save your recovery codes');const saved={value:false};const done=button('I saved the codes',()=>{if(saved.value)dialog.close();},'button');done.disabled=true;body.append(notice('Each recovery code works once. Save these now; they will not be shown again.'),h('ul',{class:'edit-recovery'},verified.recoveryCodes.map((value:string)=>h('li',{},[value]))),button('Download recovery codes',()=>download('altavia-recovery-codes.txt',verified.recoveryCodes.join('\n'))),check('I stored the recovery codes privately',false,value=>{saved.value=value;done.disabled=!value;}),h('div',{class:'edit-actions'},[done]));}finally{submit.disabled=false;}});});
  }),'button'));
}
async function start(){
  try{const options=await api('login');loginOptions={localLogin:options.localLogin===true,passwordMinLength:Number(options.passwordMinLength)||12,mfaRequired:options.mfaRequired!==false};}catch(error){renderLogin();message(error instanceof Error?error.message:'The admin service is unavailable.',true);return;}
  try{await api('session');await renderShell();}catch{renderLogin();}
}
void start();
