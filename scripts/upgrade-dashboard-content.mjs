import {readFile,writeFile} from 'node:fs/promises';
import {createTourDetails} from '../shared/tour-details.mjs';
const path='src/data/translations.json';const data=JSON.parse(await readFile(path,'utf8'));
const labels={
  intentLabel:{en:'How can we help?',uz:'Sizga qanday yordam beramiz?',ru:'Чем мы можем помочь?',ky:'Кантип жардам беребиз?',tg:'Чӣ гуна кӯмак кунем?'},
  intentInterested:{en:'I am interested in this trip',uz:'Bu sayohatga qiziqyapman',ru:'Меня интересует эта поездка',ky:'Бул саякатка кызыгам',tg:'Ба ин сафар шавқ дорам'},
  intentPay:{en:'I want to book / discuss payment',uz:'Band qilish / to‘lovni kelishmoqchiman',ru:'Хочу забронировать / обсудить оплату',ky:'Ээлөөнү / төлөмдү талкуулагым келет',tg:'Мехоҳам фармоиш диҳам / пардохтро баррасӣ кунам'},
  intentInfo:{en:'I need more information',uz:'Ko‘proq ma’lumot kerak',ru:'Мне нужна дополнительная информация',ky:'Көбүрөөк маалымат керек',tg:'Маълумоти бештар лозим аст'}
};
for(const [key,value] of Object.entries(labels))if(!data[key])data[key]=value;
await writeFile(path,JSON.stringify(data,null,2)+'\n');
const content={};for(const name of ['tours','destinations','hotels','places','faqs','service-notes'])content[name]=JSON.parse(await readFile('src/data/'+name+'.json','utf8'));
for(const tour of content.tours)if(!tour.details)tour.details=createTourDetails(tour,content);
await writeFile('src/data/tours.json',JSON.stringify(content.tours,null,2)+'\n');
