import {createTourDetails} from '../../shared/tour-details.mjs';
import hotelData from './hotels.json';
import placeData from './places.json';
import type {Localized} from './i18n';
import tourData from './tours.json';
import destinationData from './destinations.json';
import faqData from './faqs.json';
import notes from './service-notes.json';
export interface Destination {slug:string;name:Localized;country:Localized;countryId:string;image:string;summary:Localized;highlights:Localized[];region:'uzbekistan'|'international';}
export interface TourDetails {highlights:Localized[];included:Localized[];excluded:Localized[];accommodation:Localized;transport:Localized;suitable:Localized;practical:Localized;faqs:{q:Localized;a:Localized}[];hotels:{name:string;area:Localized;description:Localized;url:string}[];attractions:{name:Localized;description:Localized;sourceUrl:string;optional:boolean}[];}
export interface Tour {details?:TourDetails;slug:string;title:Localized;destinations:string[];countryId:string;type:string;style:string;days:number;seasons:string[];image:string;price:number|null;currency:string;priceStatus:string;summary:Localized;itinerary:{day:number;destination:string;title:Localized;description:Localized}[];attractions:string[];hotels:string[];searchAliases:string[];travelNotes:Localized[];}
export const allTours:Tour[]=tourData;
export const tours:Tour[]=allTours.filter(tour=>(tour as Tour & {visible?:boolean}).visible!==false);
export const destinations:Destination[]=destinationData as Destination[];
export const getDestination=(slug:string)=>destinations.find(d=>d.slug===slug)!;
export const faqs=faqData;
export const serviceNotes=notes;

export const getTourDetails=(tour:Tour):TourDetails=>createTourDetails(tour,{destinations:destinationData,hotels:hotelData,places:placeData,faqs:faqData,'service-notes':notes}) as TourDetails;
