import {test,expect} from '@playwright/test';
import tours from '../../src/data/tours.json' with {type:'json'};

test('home name search reaches the matching tour without hidden pagination',async({page})=>{
  await page.goto('/en/');
  await expect(page.locator('.discovery-bar select')).toHaveCount(0);
  await page.locator('#home-tour-query').fill('Dubai');
  await page.locator('.discovery-bar [type=submit]').click();
  await expect(page).toHaveURL(/\/en\/tours\/\?q=Dubai/);
  await expect(page.locator('[data-tour-card]:visible')).toHaveCount(1);
  await expect(page.locator('[data-tour-card]:visible h3')).toHaveText('Dubai');
  await page.locator('[type=reset]').click();
  await expect(page.locator('[data-tour-card]:visible')).toHaveCount(tours.length);
});

test('name and place search handles spelling variants and non-English input',async({page})=>{
  await page.goto('/en/tours/?page=1'); // Old pagination links must also expose all tours.
  await expect(page.locator('[data-tour-card]:visible')).toHaveCount(tours.length);
  for(const [query,title] of [['dubay','Dubai'],['ДУБАЙ','Dubai'],['İstanbul','Istanbul'],['Farg‘ona','Fergana Valley'],["Farg'ona",'Fergana Valley'],['Fargona','Fergana Valley'],['Kuala-Lumpur','Kuala Lumpur'],['Giza','Cairo']]){
    await page.locator('[name=q]').fill(query);
    await expect(page.locator('[data-tour-card]:visible')).toHaveCount(1);
    await expect(page.locator('[data-tour-card]:visible h3')).toHaveText(title);
  }
});

test('all tour pages have simple titles, attractions, hotel examples and working inquiry links',async({page})=>{
  for(const tour of tours){
    await page.goto(`/en/tours/${tour.slug}/`);
    await expect(page.locator('h1')).toHaveText(tour.title.en);
    await expect(page.locator('#attractions .attraction-item')).toHaveCount(tour.attractions.length);
    await expect(page.locator('#hotels .hotel-option')).toHaveCount(tour.hotels.length);
    await expect(page.locator('#hotels')).toContainText('subject to availability');
    await expect(page.locator('.travel-notes li')).toHaveCount(tour.travelNotes.length);
    const hotelLinks=await page.locator('#hotels a').evaluateAll(links=>links.map(link=>(link as HTMLAnchorElement).href));
    expect(hotelLinks.every(url=>url.startsWith('https://'))).toBeTruthy();
    await expect(page.locator('.quote-panel .button')).toHaveAttribute('href',`/en/contact/?tour=${tour.slug}`);
  }
});

test('verified company details and exact social links appear in every language',async({page})=>{
  for(const lang of ['uz','en','ru','ky','tg']){
    await page.goto(`/${lang}/contact/`);
    const contact=page.locator('.inquiry-intro .company-contacts');
    await expect(contact).toContainText('Altavia travel by Travero Group M.Ch.J.');
    await expect(contact).toContainText('Toshkent ko‘chasi, 4-uy');
    await expect(contact.locator('.company-phone')).toHaveAttribute('href','tel:+998884555999');
    await expect(contact.locator('a:has-text("Instagram")')).toHaveAttribute('href','https://www.instagram.com/altaviauz/');
    await expect(contact.locator('a:has-text("Telegram")')).toHaveAttribute('href','https://t.me/altavia_admin');
    await expect(page.locator('.footer-company .company-contacts')).toBeAttached();
  }
});
