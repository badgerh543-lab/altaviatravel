import type {Workspace} from './app';
import {h,button,card,notice} from './ui';
const presets=[
  {id:'autumn',title:'Autumn',subtitle:'The original Altavia look',description:'Bright orange, golden yellow and deep teal. This stays the default.',colors:['#ff681f','#ffdb58','#007d72']},
  {id:'spring',title:'Spring',subtitle:'Fresh starts & blossom',description:'Soft blossom pink, fresh green and warm white.',colors:['#edb9d2','#d9efb1','#346a4a']},
  {id:'summer',title:'Summer',subtitle:'Sunshine & open water',description:'Sunshine yellow, turquoise and ocean blue.',colors:['#ffd54a','#8be1dc','#006775']},
  {id:'winter',title:'Winter',subtitle:'A little winter magic',description:'Icy blue, crisp white and deep blue, with continuous snowfall. Visitors can pause it; reduced-motion preferences are respected.',colors:['#acdfff','#d9eafa','#175880']}
];
export async function renderThemes(w:Workspace){
  const current=await w.api('theme');let selected=current.season;const grid=h('div',{class:'edit-theme-grid'});const status=h('p',{class:'edit-theme-status','aria-live':'polite'},['Live theme: '+current.season]);const feedback=h('div',{'aria-live':'polite'});
  const save=button('Apply theme to website',()=>{void w.run(async()=>{save.disabled=true;try{await w.api('theme',{season:selected});await w.go('Theme');w.message('Theme applied. Open or refresh the website to see it in every language.');}finally{save.disabled=false;}});},'button');
  function draw(){grid.replaceChildren(...presets.map(preset=>{const input=h('input',{type:'radio',name:'season',value:preset.id,checked:selected===preset.id,onchange:()=>{selected=preset.id;draw();}});return h('label',{class:'edit-theme-option'+(selected===preset.id?' selected':'')},[input,h('div',{class:'edit-season-preview','data-season':preset.id},[h('span',{},['ALTAVIA / '+preset.title.toUpperCase()]),h('strong',{},[preset.subtitle]),h('div',{class:'edit-theme-sun','aria-hidden':'true'},[preset.id==='winter'?'❄':'✳']),h('span',{class:'edit-theme-mini-button'},['Explore the world ↗'])]),h('div',{class:'edit-theme-description'},[h('strong',{},[preset.title+(preset.id===current.season?' · Live':'')]),h('p',{},[preset.description]),h('div',{class:'edit-theme-swatches','aria-hidden':'true'},preset.colors.map(color=>h('i',{style:'background:'+color})))])]);}));}
  draw();w.host.append(card('Choose a season',[notice('Theme changes apply immediately on the next website load. Your tours, prices, images and customer records stay intact.'),status,grid,feedback,h('div',{class:'edit-actions'},[save,h('a',{class:'text-link',href:'/en/',target:'_blank',rel:'noopener noreferrer'},['Open website ↗'])])]));
}
