import rows from './translations.json';
import {formatDuration} from '../../shared/formatting.mjs';
export const languages=['uz','en','ru','ky','tg'] as const;
export type Lang=typeof languages[number];
export type Localized=Record<Lang,string>;
export const languageNames:Record<Lang,string>={uz:'O‘zbekcha',en:'English',ru:'Русский',ky:'Кыргызча',tg:'Тоҷикӣ'};
export function loc(en:string,uz:string,ru:string,ky:string,tg:string):Localized{return {en,uz,ru,ky,tg};}
export const dictionary:Record<string,Localized>=rows;
export const t=(lang:Lang,key:string):string=>{if(!dictionary[key])throw new Error('Missing translation: '+key);return dictionary[key][lang];};
export const duration=(lang:Lang,count:number):string=>formatDuration(lang,count,dictionary);
