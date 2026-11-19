import {test,expect} from '@playwright/test';import AxeBuilder from '@axe-core/playwright';

test('default autumn renders immediately without restyling the page after appearance loads',async({page})=>{
  await page.route('**/api/appearance/',route=>route.fulfill({json:{season:'autumn'}}));
  await page.addInitScript(()=>{(window as any).__seasonChanges=0;new MutationObserver(records=>{for(const record of records)if(record.target===document.documentElement)(window as any).__seasonChanges++;}).observe(document,{subtree:true,attributes:true,attributeFilter:['data-season']});});
  const appearance=page.waitForResponse('**/api/appearance/');await page.goto('/en/');await appearance;await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await expect(page.locator('html')).toHaveAttribute('data-season','autumn');expect(await page.evaluate(()=>(window as any).__seasonChanges)).toBe(0);
});

test('sitemap is valid XML with all public language variants and the purchased domain',async({page,request})=>{
  const response=await request.get('/sitemap.xml');expect(response.status()).toBe(200);expect(response.headers()['content-type']).toContain('xml');const xml=await response.text();
  await page.goto('/en/');const result=await page.evaluate(xml=>{const doc=new DOMParser().parseFromString(xml,'application/xml');return {errors:doc.querySelectorAll('parsererror').length,urls:[...doc.getElementsByTagNameNS('http://www.sitemaps.org/schemas/sitemap/0.9','url')].map(node=>({loc:node.getElementsByTagNameNS('http://www.sitemaps.org/schemas/sitemap/0.9','loc')[0].textContent,alternates:node.getElementsByTagNameNS('http://www.w3.org/1999/xhtml','link').length}))};},xml);
  expect(result.errors).toBe(0);expect(result.urls).toHaveLength(225);for(const url of result.urls){expect(url.loc).toMatch(/^https:\/\/altavitravel\.uz\/(uz|en|ru|ky|tg)\//);expect(url.alternates).toBe(6);}expect(xml).not.toMatch(/\/edit|\/api\/|404\.html/);
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href','https://altavitravel.uz/en/');
});
test('Russian tour durations use correct plurals and single-destination pages avoid duplicate photos',async({page})=>{
  await page.goto('/ru/tours/');await expect(page.locator('[data-days="2"] .card-meta').first()).toContainText('2 дня');
  await page.goto('/en/tours/dubai-escape/');await expect(page.locator('.mini-photo-pair')).toHaveCount(0);await expect(page.locator('.tour-story')).toContainText('Why do I need a quote if a price is shown?');
});

test('compiled pages enforce CSP and load without browser errors',async({page})=>{const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const response=await page.goto('/en/');expect(response?.headers()['content-security-policy']).toContain("object-src 'none'");await page.evaluate(()=>document.fonts.ready);expect(await page.locator('.hero-photo').evaluate((e:HTMLImageElement)=>e.complete&&e.naturalWidth>0)).toBeTruthy();expect(errors).toEqual([]);});
test('language switching preserves the selected tour query',async({page})=>{await page.goto('/en/contact/?tour=silk-road-cities');await page.locator('.language-menu summary').click();await page.locator('.language-menu a[lang="uz"]').click();await expect(page).toHaveURL('/uz/contact/?tour=silk-road-cities');await expect(page.locator('[name=tour]')).toHaveValue('silk-road-cities');});
test('gallery dialog remains accessible at mobile width',async({page})=>{await page.setViewportSize({width:390,height:844});await page.goto('/en/gallery/');await page.locator('.gallery-open').first().click();const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(results.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);await page.keyboard.press('Escape');});
test('without JavaScript the content, itinerary and gallery links remain available',async({browser,baseURL})=>{const context=await browser.newContext({javaScriptEnabled:false});const page=await context.newPage();await page.goto(baseURL+'/en/tours/silk-road-cities/');await expect(page.locator('h1')).toContainText('Uzbekistan');await page.locator('.itinerary details').nth(1).locator('summary').click();await expect(page.locator('.itinerary details').nth(1)).toHaveAttribute('open','');await page.goto(baseURL+'/en/gallery/');expect(await page.locator('.gallery-open').first().getAttribute('href')).toMatch(/\.webp$/);await context.close();});
