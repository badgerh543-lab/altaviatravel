// One-time catalog preparation. Existing prices are preserved.
import {readFile,writeFile} from 'node:fs/promises';
const tours=JSON.parse(await readFile('src/data/tours.json','utf8'));
const classic='https://www.advantour.com/uzbekistan/tours.htm',sem='https://semtravel.uz/ru/tours';
const prices={
  'silk-road-cities':[1240,classic,'Eight-day Uzbekistan group comparison; international flights excluded.'],
  'samarkand-weekend':[465,classic,'Planning allowance: 3 days × USD 155, derived from an eight-day USD 1,240 Uzbekistan comparison; flights excluded.'],
  'bukhara-slowly':[465,classic,'Planning allowance: 3 days × USD 155; route-specific supplier quote required; flights excluded.'],
  'khiva-discovery':[620,classic,'Planning allowance: 4 days × USD 155; route-specific supplier quote required; flights excluded.'],
  'fergana-valley':[620,classic,'Planning allowance: 4 days × USD 155; this is a regional budget proxy, not a quoted Fergana package; flights excluded.'],
  'mountain-reset':[425,'https://www.advantour.com/uzbekistan/tours/gulkam-small-chimgan-tour.htm','Two-day mountain comparison at two-person group size; walking route and hotel differ; flights excluded.'],
  'tashkent-city':[310,classic,'Planning allowance: 2 days × USD 155; city program requires its own supplier quote; flights excluded.'],
  'istanbul-escape':[620,sem,'Five-day Istanbul flight/hotel market comparison. Altavia inclusions and sightseeing require a separate quote.'],
  'cappadocia-skies':[1160,'https://www.sojournturkeytours.com/tours/cappadocia-77992','Four-day Silver comparison at six or more travelers; international flights and balloon ride excluded; smaller groups cost more.'],
  'dubai-escape':[580,sem,'Dubai package comparison has a different duration; indicative budget only. Flights/hotel in comparator, final Altavia services quoted separately.'],
  'thailand-islands':[1190,sem,'Phuket package comparison has a different duration; indicative budget only. Flights/hotel in comparator, island trips quoted separately.'],
  'kuala-lumpur':[1050,'https://1travel.uz/malajziya/','Malaysia flight/hotel package comparison; duration, room and Kuala Lumpur route require confirmation.'],
  'egypt-history':[1400,sem,'Provisional planning allowance: USD 832 Egypt resort comparison + USD 568 for a different Cairo/Luxor route and transport. This is an inferred budget, not a like-for-like supplier offer.']
};
for(const tour of tours)if(tour.price===null&&prices[tour.slug]){const [price,priceSource,priceBasis]=prices[tour.slug];Object.assign(tour,{price,priceStatus:'market-estimate',priceSource,priceBasis,priceCheckedOn:'2026-11-18',visible:true});}
await writeFile('src/data/tours.json',JSON.stringify(tours,null,2)+'\n');
const file='src/data/translations.json',text=JSON.parse(await readFile(file,'utf8'));
text.estimatedFrom={en:'Estimated from',uz:'Taxminan',ru:'Ориентировочно от',ky:'Болжол менен',tg:'Тахминан аз'};
text.perPerson={en:'per person',uz:'bir kishi uchun',ru:'за человека',ky:'бир адамга',tg:'барои як нафар'};
text.estimateNote={en:'Planning estimate, not a confirmed Altavia offer. Based on market comparisons checked 18 November 2026; dates, group size and inclusions differ. Flights and the hotels shown are included only if stated in your final written quote.',uz:'Rejalashtirish uchun taxminiy narx, tasdiqlangan Altavia taklifi emas. 2026-yil 18-noyabrda tekshirilgan bozor misollariga asoslangan; sana, guruh va xizmatlar farq qiladi. Aviachipta va ko‘rsatilgan mehmonxonalar faqat yakuniy yozma taklifda qayd etilsa kiradi.',ru:'Оценка бюджета, не подтверждённое предложение Altavia. Основана на рыночных примерах от 18 ноября 2026 года; даты, группы и услуги различаются. Перелёт и показанные отели включены только при указании в итоговом письменном предложении.',ky:'Пландоо үчүн болжолдуу баа, ырасталган Altavia сунушу эмес. 2026-жылдын 18-ноябрындагы базар мисалдарына негизделген; күндөр, топ жана кызматтар айырмаланат. Учуу жана көрсөтүлгөн мейманканалар акыркы жазуу жүзүндөгү сунушта көрсөтүлсө гана кирет.',tg:'Нархи тахминӣ барои банақшагирӣ, на пешниҳоди тасдиқшудаи Altavia. Аз муқоисаҳои бозории 18 ноябри 2026 гирифта шудааст; сана, гурӯҳ ва хизматҳо фарқ мекунанд. Парвоз ва меҳмонхонаҳои нишоншуда танҳо дар пешниҳоди ниҳоии хаттӣ дохил мешаванд.'};
await writeFile(file,JSON.stringify(text,null,2)+'\n');
