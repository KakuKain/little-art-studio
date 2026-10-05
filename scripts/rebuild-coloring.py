"""Rebuild available raster sources and the family composition from repo root."""
import subprocess,json,sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
items=json.loads(Path('assets/coloring/catalog.json').read_text())
def go(i):
 id=i['id'];source=next((p for ext in ['.png','.webp']if (p:=Path('assets/coloring')/(id+ext)).exists()),None)
 if source:subprocess.run([sys.executable,'scripts/trace-coloring.py',str(source),str(source.with_suffix('.svg'))],check=True,stdout=subprocess.DEVNULL)
with ThreadPoolExecutor(max_workers=4)as pool:list(pool.map(go,items))
import xml.etree.ElementTree as ET,re
parts=['<path data-region="sky" d="M0 0H360V440H0Z" fill="white" stroke="none"/>']
for id,x,y,scale in [('toothless',4,4,.47),('light-fury',187,4,.47),('night-lights',86,204,.52)]:
 root=ET.fromstring(Path('assets/coloring/'+id+'.svg').read_text());g=ET.Element('g',{'transform':f'translate({x} {y}) scale({scale})'})
 for el in list(root):
  if el.attrib.get('data-region')=='sky':continue
  for child in el.iter():
   if 'data-region'in child.attrib:child.attrib['data-region']=id+'-'+child.attrib['data-region']
  g.append(el)
 parts.append(ET.tostring(g,encoding='unicode'))
s='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 440">'+''.join(parts)+'</svg>';s=re.sub(r'xmlns:ns\d+="[^"]+"','',s);s=re.sub(r'(<\/?)(ns\d+:)',r'\1',s);Path('assets/coloring/dragon-family.svg').write_text(s)
print('Rebuilt smooth outlines and family composition')
