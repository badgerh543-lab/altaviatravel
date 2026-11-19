import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSitemap,buildRobots,siteOrigin,indexingEnabled,publicRoutes} from '../shared/seo.mjs';
import {formatDuration} from '../shared/formatting.mjs';
import {correctContent} from '../shared/content-corrections.mjs';
import corrections from '../shared/content-corrections.json' with {type:'json'};
import {seedContent} from '../server/content-seed.mjs';
import {buildEnvironment} from '../scripts/build-environment.mjs';

test('Workers main builds use the real origin without changing local builds or explicit configuration',()=>{
  const input={WORKERS_CI:'1',WORKERS_CI_BRANCH:'main'};
  assert.equal(buildEnvironment(input).SITE_URL,'https://altaviatravel.uz');assert.equal(input.SITE_URL,undefined);
  assert.equal(buildEnvironment({}).SITE_URL,undefined);
  assert.equal(buildEnvironment({...input,SITE_URL:'https://configured.test'}).SITE_URL,'https://configured.test');
});
test('Workers preview branches stay noindex even if a production SITE_URL was inherited',()=>{
  const env=buildEnvironment({WORKERS_CI:'1',WORKERS_CI_BRANCH:'preview-test',SITE_URL:'https://altaviatravel.uz'});
  assert.equal(indexingEnabled(env.SITE_URL),false);
});

test('sitemap lists the real public catalog in every language and excludes hidden tours and private routes',()=>{
  const routes=publicRoutes({...seedContent,tours:[...seedContent.tours,{slug:'private-trip',visible:false}]});
  assert.equal(routes.length,225);assert.equal(new Set(routes).size,225);
  const xml=buildSitemap([...routes,'/edit/','/api/admin/','/404.html','/en/tours/?q=private']);
  assert.equal((xml.match(/<loc>/g)||[]).length,225);assert.equal((xml.match(/hreflang="x-default"/g)||[]).length,225);
  for(const lang of ['uz','en','ru','ky','tg'])assert(xml.includes(`https://altaviatravel.uz/${lang}/tours/dubai-escape/`));
  for(const value of ['private-trip','/edit','/api/','404.html','altavia.example','?q='])assert(!xml.includes(value));
});
test('sitemap alternatives reference only pages that exist, including themselves',()=>{
  const xml=buildSitemap(['/en/','/uz/','/en/tours/'],'https://altaviatravel.uz');
  const tour=xml.match(/<url>\s*<loc>https:\/\/altaviatravel\.uz\/en\/tours\/[\s\S]*?<\/url>/)[0];
  assert(tour.includes('hreflang="en"'));assert(!tour.includes('hreflang="uz"'));assert(!tour.includes('x-default'));
});
test('preview indexing stays disabled and canonical origins reject credentials or paths',()=>{
  assert.equal(siteOrigin(),'https://altaviatravel.uz');
  for(const value of [undefined,'http://localhost:4321','https://branch.altavia.pages.dev','https://altavia.workers.dev','https://altavia.example'])assert.equal(indexingEnabled(value),false);
  assert(indexingEnabled('https://altaviatravel.uz'));
  assert(buildRobots('https://altaviatravel.uz',true).includes('Sitemap: https://altaviatravel.uz/sitemap.xml'));
  assert.equal(buildRobots('https://altaviatravel.uz',false),'User-agent: *\nDisallow: /\n');
  for(const value of ['javascript:alert(1)','https://user:secret@site.test/','https://site.test/path','https://site.test/?secret=a'])assert.throws(()=>siteOrigin(value));
});
test('duration labels use English singular and Russian count grammar',()=>{
  assert.equal(formatDuration('en',1,seedContent.translations),'1 day');assert.equal(formatDuration('en',2,seedContent.translations),'2 days');
  for(const [count,label] of [[1,'день'],[2,'дня'],[5,'дней'],[11,'дней'],[21,'день'],[22,'дня']])assert.equal(formatDuration('ru',count,seedContent.translations),`${count} ${label}`);
});
test('legacy copy corrections preserve staff wording and do not mutate their input',()=>{
  const [oldText,newText]=corrections.find(([old])=>old.startsWith('Dates, room choices'));
  const source={question:{en:oldText},custom:{en:'The owner wrote this custom hotel policy.'}};
  const corrected=correctContent(source);assert.equal(corrected.question.en,newText);assert.equal(corrected.custom.en,source.custom.en);assert.equal(source.question.en,oldText);
});
