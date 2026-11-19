type Season='autumn'|'spring'|'summer'|'winter';
const allowed:Season[]=['autumn','spring','summer','winter'];
const motion=matchMedia('(prefers-reduced-motion: reduce)');
const labels:Record<string,[string,string]>={en:['Pause snowfall','Resume snowfall'],uz:['Qorni to‘xtatish','Qorni davom ettirish'],ru:['Остановить снег','Продолжить снег'],ky:['Карды токтотуу','Карды улантуу'],tg:['Боздоштани барф','Идомаи барф']};
let snow:HTMLDivElement|null=null,toggle:HTMLButtonElement|null=null,paused=false;
function updateSnow(){
  snow?.remove();toggle?.remove();snow=null;toggle=null;
  if(document.documentElement.dataset.season!=='winter'||motion.matches)return;
  snow=document.createElement('div');snow.className='season-snow';snow.setAttribute('aria-hidden','true');
  const count=innerWidth<650?24:44;
  for(let i=0;i<count;i++){const flake=document.createElement('i');flake.className='season-flake';flake.style.cssText=`--left:${(i*37.31)%100}%;--size:${2+(i%5)}px;--opacity:${.3+(i%6)*.1};--duration:${12+(i%13)}s;--delay:-${i%24}s;--drift:${(i%2?1:-1)*(15+i%55)}px`;snow.append(flake);}
  toggle=document.createElement('button');toggle.type='button';toggle.className='season-snow-toggle';toggle.addEventListener('click',()=>{paused=!paused;refreshPause();});
  document.body.append(snow,toggle);refreshPause();
}
function refreshPause(){if(snow)snow.dataset.paused=String(paused||document.hidden);if(toggle){toggle.textContent=(labels[document.documentElement.lang]||labels.en)[paused?1:0];toggle.setAttribute('aria-pressed',String(paused));}}
function apply(season:Season){if(document.documentElement.dataset.season===season)return;document.documentElement.dataset.season=season;const color={autumn:'#ff681f',spring:'#edb9d2',summer:'#ffd54a',winter:'#acdfff'}[season];document.querySelector('meta[name=theme-color]')?.setAttribute('content',color);updateSnow();}
motion.addEventListener('change',updateSnow);document.addEventListener('visibilitychange',refreshPause);
apply('autumn');
void fetch('/api/appearance/',{cache:'no-store',headers:{Accept:'application/json'},signal:AbortSignal.timeout(5000)}).then(async response=>{if(!response.ok)return;const data=await response.json();if(allowed.includes(data.season))apply(data.season);}).catch(()=>{});
