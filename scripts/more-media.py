import sys
sys.stdout.reconfigure(encoding='utf-8')
import json, urllib.request, urllib.parse, pathlib, re, html, time
root=pathlib.Path(__file__).resolve().parents[1]
def get(u):
    with urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'AltaviaTravelReview/1.0'}),timeout=40) as r:return r.read()
def query(q):
    p={'action':'query','generator':'search','gsrsearch':q,'gsrnamespace':6,'gsrlimit':6,'prop':'imageinfo','iiprop':'url|extmetadata|size','iiurlwidth':1600,'format':'json'}
    d=json.loads(get('https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode(p)))
    return sorted(d.get('query',{}).get('pages',{}).values(),key=lambda p:p.get('index',100))
records=json.loads((root/'src/data/media.json').read_text(encoding='utf8'))
tasks={'samarkand':'intitle:Registan Samarkand Uzbekistan','bukhara':'intitle:Kalyan minaret Bukhara'}
for ident,q in tasks.items():
    try:
        pages=query(q)
        print(ident, [(p['title'],p['imageinfo'][0]['width'],p['imageinfo'][0]['height']) for p in pages],flush=True)
        for p in pages:
            i=p['imageinfo'][0];m=i['extmetadata'];lic=m.get('LicenseShortName',{}).get('value','')
            if not any(x in lic for x in ['CC BY','CC0','Public domain']):continue
            if i['width']<1000 or not 1.2<i['width']/i['height']<3.5:continue
            if i.get('size',0)>18000000:continue
            raw=get(i.get('thumburl',i['url']));(root/'public/images/travel'/f'{ident}.jpg').write_bytes(raw)
            s=lambda v:html.unescape(re.sub('<[^>]+>','',v))
            r={'id':ident,'title':s(m.get('ObjectName',{}).get('value',p['title'][5:])),'description':s(m.get('ImageDescription',{}).get('value','')),'author':s(m.get('Artist',{}).get('value','Unknown')),'license':lic,'licenseUrl':m.get('LicenseUrl',{}).get('value','https://creativecommons.org/publicdomain/mark/1.0/'),'sourceUrl':i['descriptionurl'],'originalUrl':i['url'],'width':i['width'],'height':i['height'],'src':f'/images/travel/{ident}-960.webp'}
            records=[r0 for r0 in records if r0['id']!=ident]+[r]
            print('saved',ident,flush=True);break
        time.sleep(2)
    except Exception as e:print('ERROR',ident,str(e),flush=True)
(root/'src/data/media.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf8')
