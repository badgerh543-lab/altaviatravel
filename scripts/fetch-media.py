import concurrent.futures, html, json, re, urllib.request, urllib.parse, pathlib, time
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'public/images/travel'; OUT.mkdir(parents=True,exist_ok=True)
queries={'samarkand':'Registan Samarkand panorama','bukhara':'Bukhara Poi Kalyan','khiva':'Khiva Kalta Minor','tashkent':'Tashkent Amir Timur square','fergana':'Kokand Khudayar Khan palace','andijan':'Andijan Babur park','mountains':'Chimgan mountains Uzbekistan','istanbul':'Istanbul Bosphorus panorama','cappadocia':'Cappadocia hot air balloons','dubai':'Dubai skyline marina','thailand':'Phi Phi islands beach','malaysia':'Kuala Lumpur Petronas towers','egypt':'Giza pyramids panorama'}
def get(url):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'AltaviaTravelContent/1.0 (educational website development)'}), timeout=45) as r: return r.read()
        except Exception:
            if attempt==2: raise
            time.sleep(2)
def strip(v): return html.unescape(re.sub('<[^>]+>','',v))
def run(item):
    ident,query=item
    params={'action':'query','generator':'search','gsrsearch':query+' filetype:bitmap','gsrnamespace':6,'gsrlimit':10,'prop':'imageinfo','iiprop':'url|extmetadata|size','iiurlwidth':1600,'format':'json'}
    data=json.loads(get('https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode(params)))
    pages=sorted(data.get('query',{}).get('pages',{}).values(),key=lambda p:p.get('index',100))
    for p in pages:
        i=p['imageinfo'][0]; m=i.get('extmetadata',{}); lic=m.get('LicenseShortName',{}).get('value','')
        if not any(x in lic for x in ['CC BY','CC0','Public domain']):continue
        if i['width']<900 or i['width']/i['height']<1.15 or i['width']/i['height']>2.6:continue
        url=i.get('thumburl',i['url']);raw=get(url)
        (OUT/(ident+'.jpg')).write_bytes(raw)
        return {'id':ident,'title':strip(m.get('ObjectName',{}).get('value',p['title'][5:])),'description':strip(m.get('ImageDescription',{}).get('value','')),'author':strip(m.get('Artist',{}).get('value','Unknown')),'license':lic,'licenseUrl':m.get('LicenseUrl',{}).get('value','https://creativecommons.org/publicdomain/mark/1.0/'),'sourceUrl':i['descriptionurl'],'originalUrl':i['url'],'width':i['width'],'height':i['height'],'src':'/images/travel/'+ident+'-960.webp'}
    raise ValueError('No suitable licensed image: '+ident)
records=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
    futures={ex.submit(run,item):item[0] for item in queries.items()}
    for f in concurrent.futures.as_completed(futures):
        try: records.append(f.result());print('Downloaded',futures[f],flush=True)
        except Exception as e:print('ERROR',futures[f],str(e),flush=True)
(ROOT/'src/data/media.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
