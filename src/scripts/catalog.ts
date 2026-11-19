import {normalizeSearch} from './search';

const form=document.querySelector<HTMLFormElement>('#filter-form');
if(form){
  const grid=document.querySelector<HTMLElement>('.catalog-grid')!;
  const cards=Array.from(grid.querySelectorAll<HTMLElement>('[data-tour-card]'));
  const searchText=new Map(cards.map(card=>[card,normalizeSearch(card.dataset.search||'').split(' ')]));
  const count=document.querySelector('#result-count')!;
  const empty=document.querySelector<HTMLElement>('#catalog-empty')!;
  const controls=Array.from(form.elements).filter((e):e is HTMLInputElement|HTMLSelectElement=>e instanceof HTMLInputElement||e instanceof HTMLSelectElement);
  function restore(){
    const params=new URLSearchParams(location.search);
    for(const control of controls)control.value=params.get(control.name)||(control.name==='sort'?'recommended':'');
    const details=form!.querySelector<HTMLDetailsElement>('[data-refinements]');
    if(details)details.open=controls.some(c=>!['q','sort'].includes(c.name)&&c.value!=='');
  }
  function update(write=true){
    const data=Object.fromEntries(new FormData(form!));
    const words=normalizeSearch(String(data.q||'')).split(' ').filter(Boolean);
    const matches=cards.filter(card=>{
      const d=card.dataset,days=Number(d.days);
      return words.every(word=>searchText.get(card)!.some(name=>name.startsWith(word)))
        &&(!data.budget||!d.price||Number(d.price)<=Number(data.budget))
        &&(!data.destination||d.destinations?.split(',').includes(String(data.destination)))
        &&(!data.country||d.country===data.country)&&(!data.type||d.type===data.type)
        &&(!data.style||d.style===data.style)&&(!data.season||d.seasons?.split(',').includes(String(data.season)))
        &&(!data.duration||(data.duration==='short'&&days<=3)||(data.duration==='medium'&&days>=4&&days<=6)||(data.duration==='long'&&days>=7));
    });
    if(data.sort==='shortest')matches.sort((a,b)=>Number(a.dataset.days)-Number(b.dataset.days));
    else if(data.sort==='longest')matches.sort((a,b)=>Number(b.dataset.days)-Number(a.dataset.days));
    cards.forEach(card=>{card.hidden=true;});
    matches.forEach(card=>{card.hidden=false;grid.append(card);});
    count.textContent=String(matches.length);empty.hidden=matches.length>0;
    if(write){const params=new URLSearchParams();for(const [key,value] of Object.entries(data))if(value&&!(key==='sort'&&value==='recommended'))params.set(key,String(value).trim());history.replaceState(null,'',location.pathname+(params.size?'?'+params:''));}
  }
  form.addEventListener('submit',event=>{event.preventDefault();update();});
  form.addEventListener('input',()=>update());
  form.addEventListener('change',()=>update());
  document.querySelector('#sort')?.addEventListener('change',()=>update());
  form.addEventListener('reset',()=>setTimeout(()=>update(),0));
  window.addEventListener('popstate',()=>{restore();update(false);});
  restore();update(false);
}
