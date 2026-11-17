from pathlib import Path
import json,re,base64,zipfile
root=Path(__file__).resolve().parents[1]
output=root.parent
pages={}
for f in (root/'dist').rglob('*.html'):
 relative=f.relative_to(root/'dist');route='/'+str(relative.parent).strip('.')
 if route!='/':route=route.rstrip('/')+'/'
 html=f.read_text()
 for match in re.finditer(r'<script type="module" src="([^"]+)"></script>',html):
  script=(root/'dist'/match.group(1).lstrip('/')).read_text()
  html=html.replace(match.group(0),'<script type="module">'+script+'</script>')
 image=root/'public/assets/bloom-box.webp'
 html=html.replace('/assets/bloom-box.webp','data:image/webp;base64,'+base64.b64encode(image.read_bytes()).decode())
 pages[route]=html
payload=json.dumps(pages).replace('</','<\\/')
preview='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>I Will Bloom — website design preview</title><style>body{margin:0;background:#fbf9f3;font-family:Arial,sans-serif}#toolbar{padding:10px 18px;display:flex;align-items:center;gap:16px;font-size:12px;background:#404b3c;color:white}#toolbar button{padding:8px 12px;background:#fbf9f3;border:0;color:#31392f;cursor:pointer}iframe{border:0;width:100%;height:calc(100dvh - 55px);display:block}#route{margin-left:auto}</style></head><body><div id="toolbar"><button id="home">Home</button><span>Website design preview · payments inactive</span><span id="route"></span></div><iframe title="I Will Bloom website preview" id="site"></iframe><script id="pages" type="application/json">'''+payload+'''</script><script>
const pages=JSON.parse(document.querySelector('#pages').textContent),frame=document.querySelector('#site');let current='/';
function show(route,fragment=''){if(!pages[route])return;current=route;frame.srcdoc=pages[route];document.querySelector('#route').textContent=route;frame.onload=()=>{const doc=frame.contentDocument;doc.addEventListener('click',e=>{const a=e.target.closest('a');if(!a)return;const raw=a.getAttribute('href');if(!raw)return;const u=new URL(raw,'https://preview.invalid'+current);if(u.origin!=='https://preview.invalid')return;e.preventDefault();let path=u.pathname;if(!path.endsWith('/'))path+='/';if(path===current&&u.hash){doc.getElementById(decodeURIComponent(u.hash.slice(1)))?.scrollIntoView();return;}show(path,u.hash.slice(1));});if(fragment)doc.getElementById(decodeURIComponent(fragment))?.scrollIntoView();};}
document.querySelector('#home').onclick=()=>show('/');show('/');
</script></body></html>'''
(output/'I_Will_Bloom_Homepage_Preview.html').write_text(preview)
with zipfile.ZipFile(output/'I_Will_Bloom_Astro_Source.zip','w',zipfile.ZIP_DEFLATED) as z:
 for f in root.rglob('*'):
  if f.is_file() and not any(x in f.relative_to(root).parts for x in ['node_modules','.astro','dist','.git']) and not (f.name == '.env' or (f.name.startswith('.env.') and f.name != '.env.example')):z.write(f,str(f.relative_to(root)))
print(f'Packaged {len(pages)} pages in the self-contained design preview, plus Astro source.')
