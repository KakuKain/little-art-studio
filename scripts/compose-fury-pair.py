"""Arrange two complete, closed character sheets instead of the cave scene."""
from pathlib import Path
import json,xml.etree.ElementTree as ET,re
folder=Path(__file__).resolve().parents[1]/'assets/coloring'
report=json.loads((folder/'CLEAN-LINES-REPORT.json').read_text())
by_id={i['id']:i for i in report};seeds=[];count=0
parts=['<path data-region="sky" d="M0 0H360V440H0Z" fill="white"/>']
for name,x,y,scale in [('light-fury-clean',177,105,.48),('toothless-clean',12,105,.48)]:
 root=ET.fromstring((folder/(name+'.svg')).read_text())
 g=ET.Element('g',{'transform':f'translate({x} {y}) scale({scale})'})
 for element in root:
  if element.get('data-region')=='sky':continue
  for child in element.iter():
   if child.get('data-region'):
    child.set('data-region',name+'-'+child.get('data-region'));count+=1
  g.append(element)
 parts.append(ET.tostring(g,encoding='unicode'))
 seeds.extend([[round(x+px*scale,3),round(y+py*scale,3)] for px,py in by_id[name]['seeds']])
svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 440">'+''.join(parts)+'</svg>'
svg=re.sub(r'xmlns:ns\d+="[^"]+"','',svg);svg=re.sub(r'(<\/?)(ns\d+:)',r'\1',svg)
(folder/'fury-pair-clean.svg').write_text(svg)
entry={'id':'fury-pair-clean','original':'fury-pair','regions':count,'composition':['toothless-clean','light-fury-clean'],'seeds':seeds,'visibleAutoGapRepairs':0}
report=[entry if i['id']=='fury-pair-clean' else i for i in report]
(folder/'CLEAN-LINES-REPORT.json').write_text(json.dumps(report,indent=2)+'\n')
print('Composed complete dragon pair:',count,'fill regions')
