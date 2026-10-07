"""Make toddler coloring variants while retaining the source faces and silhouettes.
Cuts are in the sheet's world coordinates and only remove interior costume motifs.
Original sheets remain available in the detailed gallery.
"""
from pathlib import Path
import xml.etree.ElementTree as ET
import re
ET.register_namespace('', 'http://www.w3.org/2000/svg')
folder=Path(__file__).resolve().parents[1]/'assets/coloring'
specs={
 'elsa': {'group':'dress','regions':['cell36','cell56'], 'cuts':[
  'M166 333H231L234 354L237 393L218 412H157L163 370Z',
  'M160 323H193V337H160Z',
  'M198 328H206V334H198Z',
 ]},
 'anna': {'group':'cape','regions':['cell20'], 'cuts':[
  'M244 94H250L255 102L260 115L261 135H244Z',
  'M88 211H113V239H88Z',
  'M110 220H134V250H110Z',
  'M132 243H157V273H132Z',
 ]},
 'moana': {'group':'skirt','regions':['cell30'], 'cuts':[
  'M235 252L263 255L284 282L291 312L292 340H256V324L260 311L247 276Z',
 ]},
}
for name,spec in specs.items():
 svg=ET.parse(folder/f'{name}-clean.svg').getroot()
 defs=ET.Element('defs')
 clip=ET.SubElement(defs,'clipPath',{'id':'simple-costume','clipPathUnits':'userSpaceOnUse'})
 ET.SubElement(clip,'path',{'d':'M0 0H360V440H0Z '+' '.join(spec['cuts']),'clip-rule':'evenodd'})
 art=ET.Element('g',{'clip-path':'url(#simple-costume)'})
 for child in list(svg):
  if child.get('data-region')=='sky':continue
  svg.remove(child);art.append(child)
 for el in art.iter():
  if el.get('data-region') in spec['regions']:el.set('data-fill-group',spec['group'])
 svg.append(defs)
 # A same-color underlay overlaps the clipped edge so antialiasing cannot leave white seams.
 for i,d in enumerate(spec['cuts']):
  tokens=re.findall(r'[MLHVZ]|-?\d+(?:\.\d+)?',d);points=[];x=y=0;j=0
  while j<len(tokens):
   cmd=tokens[j];j+=1
   if cmd in ('M','L'):x=float(tokens[j]);y=float(tokens[j+1]);j+=2
   elif cmd=='H':x=float(tokens[j]);j+=1
   elif cmd=='V':y=float(tokens[j]);j+=1
   else:continue
   points.append((x,y))
  cx=sum(x for x,y in points)/len(points);cy=sum(y for x,y in points)/len(points)
  expanded=[(x+(.3 if x>cx else -.3),y+(.3 if y>cy else -.3)) for x,y in points]
  path='M'+'L'.join(f'{x:g} {y:g}' for x,y in expanded)+'Z'
  ET.SubElement(svg,'path',{'data-region':f'costume-underlay-{i}','data-fill-group':spec['group'],'d':path,'fill':'white'})
 svg.append(art)
 for i,d in enumerate(spec['cuts']):
  ET.SubElement(svg,'path',{'data-region':f'simple-costume-{i}','data-fill-group':spec['group'],'d':d,'fill':'white'})
 lines={
  'anna':'M249 90Q260 102 262 119M90 211L85 218M136 243L124 257M132 271L138 274',
  'elsa':'M157 320L159 334M157 363L153 376M232 323L235 352',
  'moana':'M235 253Q258 252 273 269Q288 285 291 307Q285 324 292 339M270 340H290',
 }
 ET.SubElement(svg,'path',{'d':lines[name],'fill':'none','stroke':'#171717','stroke-width':'2.3','stroke-linecap':'round','stroke-linejoin':'round','pointer-events':'none'})
 (folder/f'{name}-simple.svg').write_text(ET.tostring(svg,encoding='unicode'))
