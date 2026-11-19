export type JsonRecord=Record<string,any>;
export function h<K extends keyof HTMLElementTagNameMap>(tag:K,attrs:JsonRecord={},children:(Node|string|number|null|undefined|false)[]=[]):HTMLElementTagNameMap[K]{
  const node=document.createElement(tag);for(const [key,value] of Object.entries(attrs)){
    if(value===undefined||value===null||value===false)continue;
    if(key==='class')node.className=String(value);
    else if(key.startsWith('on')&&typeof value==='function')node.addEventListener(key.slice(2).toLowerCase(),value);
    else if(key==='text')node.textContent=String(value);
    else if(key==='value'&&(node instanceof HTMLInputElement||node instanceof HTMLSelectElement||node instanceof HTMLTextAreaElement))node.value=String(value);
    else if(key==='checked'&&node instanceof HTMLInputElement)node.checked=Boolean(value);
    else if(key==='disabled'&&(node instanceof HTMLButtonElement||node instanceof HTMLInputElement))node.disabled=Boolean(value);
    else node.setAttribute(key,value===true?'':String(value));
  }
  for(const child of children)if(child!==null&&child!==undefined&&child!==false)node.append(child instanceof Node?child:document.createTextNode(String(child)));
  return node;
}
export const button=(label:string,action:()=>unknown,kind='edit-small-button')=>h('button',{type:'button',class:kind,onclick:action},[label]);
export const money=(minor:number,currency='USD')=>new Intl.NumberFormat('en',{style:'currency',currency}).format(Number(minor||0)/100);
export function field(label:string,value:any,onChange:(value:string)=>void,options:JsonRecord={}){
  const tag=options.multiline?'textarea':'input';const node=h(tag,{...options,value:value??'',oninput:(event:Event)=>onChange((event.target as HTMLInputElement).value)});if(tag==='input'&&!options.type)(node as HTMLInputElement).type='text';return h('label',{},[label,node]);
}
export function selectField(label:string,value:string,items:{value:string;label:string}[],change:(value:string)=>void){const select=h('select',{onchange:(e:Event)=>change((e.target as HTMLSelectElement).value)},items.map(item=>h('option',{value:item.value},[item.label])));select.value=value;return h('label',{},[label,select]);}
export function check(label:string,value:boolean,change:(checked:boolean)=>void){return h('label',{class:'edit-check'},[h('input',{type:'checkbox',checked:value,onchange:(event:Event)=>change((event.target as HTMLInputElement).checked)}),label]);}
export function notice(text:string){return h('div',{class:'edit-notice'},[text]);}
export function card(title:string,children:Node[],description=''){return h('section',{class:'edit-card'},[h('div',{class:'edit-card-heading'},[h('div',{},[h('h2',{},[title]),description?h('p',{},[description]):null])]),...children]);}
export function openDialog(title:string){const dialog=h('dialog',{class:'edit-dialog','aria-label':title});const body=h('div');dialog.append(h('div',{class:'edit-dialog-top'},[h('h2',{},[title]),button('×',()=>dialog.close())]),body);dialog.querySelector('button')!.setAttribute('aria-label','Close dialog');dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();return {dialog,body};}
export function download(name:string,text:string){const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const anchor=h('a',{href:url,download:name});anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function compressImage(file:File){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10000000)throw new Error('Choose a JPEG, PNG or WebP image up to 10 MB.');
  const bitmap=await createImageBitmap(file);if(bitmap.width<320||bitmap.height<200||bitmap.width>16000||bitmap.height>16000){bitmap.close();throw new Error('Choose an image at least 320 × 200 and at most 16000 × 16000.');}
  const images=[];
  for(const size of [480,960,1600]){const scale=Math.min(1,size/bitmap.width,2400/bitmap.height);const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);let data='';for(const quality of [.8,.68,.54,.4]){data=canvas.toDataURL('image/webp',quality).split(',')[1];if(data.length<330000)break;}if(data.length>330000){bitmap.close();throw new Error('This image is too detailed. Resize it before uploading.');}images.push({size,data});}
  bitmap.close();return images;
}
