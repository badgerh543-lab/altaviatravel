import {openUpload} from './media-upload';
import type {Workspace} from './app';
import {h,button,field,selectField,check,card,notice,money,openDialog,type JsonRecord} from './ui';
const languages=['uz','en','ru','ky','tg'];
const isLocalized=(value:any)=>value&&typeof value==='object'&&!Array.isArray(value)&&languages.every(lang=>Object.hasOwn(value,lang));
const label=(value:JsonRecord,index=0)=>typeof value.name==='string'?value.name:value.title?.en||value.name?.en||value.caption?.en||value.q?.en||value.slug||value.id||'Record '+(index+1);
const preview=(image:JsonRecord)=>image.uploaded?image.src.replace('/api/media/','/api/admin/media/'):image.src;
function tabs(w:Workspace,render:()=>void){return h('div',{class:'edit-locale-tabs',role:'group','aria-label':'Content language'},languages.map(lang=>h('button',{type:'button','aria-pressed':w.locale===lang?'true':'false',onclick:()=>{w.locale=lang;render();}},[lang.toUpperCase()])));}
function clone(value:any){return structuredClone(value);}
function copyMissing(value:any,lang:string){if(isLocalized(value)){const source=value[lang]||languages.map(l=>value[l]).find(Boolean)||'';for(const l of languages)if(!value[l])value[l]=source;}else if(Array.isArray(value))value.forEach(item=>copyMissing(item,lang));else if(value&&typeof value==='object')Object.values(value).forEach(item=>copyMissing(item,lang));}
export {renderTours} from './tours';
export function renderContent(w:Workspace){
  const names=Object.keys(w.collections).filter(name=>!['tours','media'].includes(name));const container=h('div');let selected=names[0];
  const selection=selectField('Collection',selected,names.map(value=>({value,label:value})),value=>{selected=value;render();});w.host.append(card('Website content',[selection], 'Owners and developers can add, change or remove records. Save a draft, then review the public catalog before publishing.'),container);
  function render(){container.replaceChildren();const collection=w.collections[selected];if(selected==='translations'){const keys=Object.keys(collection);let key=keys[0];const editor=h('div');const renderTranslation=()=>{editor.replaceChildren();renderGeneric(w,editor,selected,clone(collection),key);};container.append(card('Choose interface text',[selectField('Text key',key,keys.map(value=>({value,label:value})),v=>{key=v;renderTranslation();})]),editor);renderTranslation();return;}
    if(!Array.isArray(collection)){renderGeneric(w,container,selected,clone(collection));return;}
    let index=collection.length?0:-1;const editor=h('div');const select=selectField('Record',String(index),collection.map((item:JsonRecord,i:number)=>({value:String(i),label:label(item,i)})),value=>{index=Number(value);renderItem();});
    container.append(card('Records',[select,button('Add record',()=>{index=-1;renderItem();})]),editor);
    function renderItem(){editor.replaceChildren();const data=index>=0?clone(collection[index]):blankRecord(collection[0]||w.templates[selected]||{});renderGeneric(w,editor,selected,data,undefined,index);}
    renderItem();
  }render();
}
function blankRecord(source:any):any{
  if(Array.isArray(source))return source.length?[blankRecord(source[0])]:[];
  if(source&&typeof source==='object')return Object.fromEntries(Object.entries(source).map(([key,value])=>[key,['id','slug'].includes(key)?'':blankRecord(value)]));
  if(typeof source==='number')return 1;if(typeof source==='boolean')return false;return '';
}
function renderGeneric(w:Workspace,host:HTMLElement,name:string,data:any,translationKey?:string,index?:number){
  const form=h('form',{class:'edit-form'}),fields=h('div',{class:'edit-form'}),feedback=h('div',{'aria-live':'polite'});const submit=h('button',{class:'button',type:'submit'},['Save draft']);
  const render=()=>{fields.replaceChildren(tabs(w,render));const value=translationKey?data[translationKey]:data;renderValue(fields,value,'',changed=>{if(translationKey)data[translationKey]=changed;else data=changed;},w,translationKey?w.templates[name]?.[translationKey]:w.templates[name]);fields.append(button('Copy draft text into empty languages',()=>{copyMissing(value,w.locale);render();}));};render();
  form.append(feedback,fields,h('div',{class:'edit-actions'},[submit,index!==undefined&&index>=0?button('Remove record',()=>{const {dialog,body}=openDialog('Remove record?');body.append(notice('The change will be checked for references before saving. It affects public pages after publishing.'),button('Remove',()=>w.run(async()=>{const original=w.collections[name][index];await w.api('content/'+name,{revision:w.revision,action:'delete',index,originalId:original.slug||original.id});dialog.close();await w.go(name==='media'?'Images':'Content');w.message('Record removed from draft.');}),'button edit-danger'));},'edit-small-button edit-danger'):null]));
  host.append(card(name+(index===-1?' · new record':''),[form]));
  form.addEventListener('submit',event=>{event.preventDefault();submit.disabled=true;void(async()=>{try{const collection=w.collections[name];const item=translationKey?data:data;await w.api('content/'+name,{revision:w.revision,action:Array.isArray(collection)?'upsert':'replace',index,originalId:index!==undefined&&index>=0?(collection[index]?.slug||collection[index]?.id):undefined,item});await w.go(name==='media'?'Images':'Content');w.message('Content draft saved.');}catch(error){feedback.className='edit-error';feedback.textContent=(error as Error).message;feedback.scrollIntoView({block:'nearest'});}finally{submit.disabled=false;}})();});
}
function renderValue(host:HTMLElement,value:any,name:string,set:(value:any)=>void,w:Workspace,template?:any){
  if(isLocalized(value)){host.append(field((name||'Text')+' · '+w.locale.toUpperCase(),value[w.locale],text=>value[w.locale]=text,{multiline:!/name|title|^$/i.test(name),maxlength:12000}));return;}
  if(Array.isArray(value)){const itemTemplate=value.length?clone(value[0]):Array.isArray(template)?template[0]:'';const section=h('div');host.append(h('p',{class:'edit-label'},[name||'Items']),section);const redraw=()=>{section.replaceChildren();value.forEach((item:any,index:number)=>{const inside=h('div',{class:'edit-form'});const detail=h('details',{class:'edit-array-item',open:value.length<4},[h('summary',{},[name+' '+(index+1)]),inside]);renderValue(inside,item,'Value',changed=>value[index]=changed,w,itemTemplate);inside.append(button('Remove item',()=>{value.splice(index,1);redraw();},'edit-small-button edit-danger'));section.append(detail);});section.append(button('Add item',()=>{value.push(blankRecord(itemTemplate));redraw();}));};redraw();return;}
  if(value&&typeof value==='object'){for(const [key,entry] of Object.entries(value))renderValue(host,entry,key,changed=>value[key]=changed,w,template?.[key]);return;}
  if(typeof value==='boolean'){host.append(check(name,value,set));return;}
  if(name==='image'){host.append(selectField(name,value||'',[{value:'',label:'Choose image'},...w.collections.media.map((image:JsonRecord)=>({value:image.id,label:image.title}))],set));return;}
  host.append(field(name||'Value',value??'',text=>set(typeof value==='number'?Number(text):text),{type:typeof value==='number'?'number':'text',step:typeof value==='number'?'any':undefined,multiline:typeof value==='string'&&value.length>180,maxlength:12000}));
}
export function renderMedia(w:Workspace){
  const editor=h('div');
  const list=h('div',{class:'edit-image-picker'},w.collections.media.map((image:JsonRecord,index:number)=>h('div',{class:'edit-image-choice'},[h('img',{src:preview(image),alt:'',width:120,height:80,loading:'lazy'}),h('span',{},[image.title]),button('Edit / remove',()=>{editor.replaceChildren();renderGeneric(w,editor,'media',clone(image),undefined,index);editor.scrollIntoView({block:'start'});})])));
  w.host.append(card('Image library',[notice('Only upload images you own or have permission to use. SVG, animated files and arbitrary remote image fetches are not accepted.'),button('Upload image',()=>openUpload(w,()=>{void w.go('Images');}),'button'),list]));
  w.host.append(editor);
}
export async function reviewPublish(w:Workspace){
  await w.refreshContent();const visible=w.collections.tours.filter((tour:JsonRecord)=>tour.visible!==false);const {dialog,body}=openDialog('Review the public catalog');let reviewed=false;const feedback=h('div',{'aria-live':'polite'});const submit=button('Publish this revision',()=>{void(async()=>{submit.disabled=true;try{if(!reviewed)throw new Error('Confirm that you reviewed the visible tours.');submit.textContent='Publishing…';const result=await w.api('publish',{revision:w.revision,visibleTours:visible.map((tour:JsonRecord)=>tour.slug),reviewed:true});dialog.close();await w.go('Overview');w.message(result.status==='deployed'?'Published. The local website has been rebuilt.':'Build requested. The public website updates after a successful hosting deployment.');}catch(error){feedback.className='edit-error';feedback.textContent=(error as Error).message;}finally{submit.disabled=false;submit.textContent='Publish this revision';}})();},'button');submit.disabled=true;
  body.append(feedback,notice('Review which tours will be showing, their prices and their images. Saving a draft does not change the public website. Publishing rebuilds the pages; it can take a little time.'),h('div',{class:'edit-publish-list'},visible.map((tour:JsonRecord)=>{const image=w.collections.media.find((m:JsonRecord)=>m.id===tour.image);return h('div',{class:'edit-publish-row'},[image?h('img',{src:preview(image),alt:'',width:65,height:48}):null,h('div',{},[h('strong',{},[tour.title.en]),h('small',{},[(tour.price?money(tour.price*100,tour.currency):'No price')+' · '+tour.days+' days · '+tour.priceStatus])])]);})),check('I reviewed the currently visible tours, prices and images',false,value=>{reviewed=value;submit.disabled=!value;}),h('div',{class:'edit-actions'},[submit,button('Keep draft',()=>dialog.close())]));
}
