import type {Localized} from './i18n';
import data from './articles.json';
export interface Article {slug:string;title:Localized;intro:Localized;image:string;minutes:number;sections:{title:Localized;body:Localized}[];}
export const articles:Article[]=data;
