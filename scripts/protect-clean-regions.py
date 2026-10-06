"""Keep small spline holes inside a character separate from its background."""
from pathlib import Path
import re,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[1]/'assets/coloring'
for file in root.glob('*-clean.svg'):
 if file.name=='fury-pair-clean.svg':continue
 tree=ET.parse(file);svg=tree.getroot();group=next(g for g in svg if g.get('data-art-fit'))
 for old in list(group):
  if (old.get('data-region') or '').startswith('backing'):group.remove(old)
 if file.stem in ('toothless-gliding-clean','toothless-sitting-clean'):continue
 backing=[]
 for outline in group:
  if not outline.get('data-outline'):continue
  d=outline.get('d','');subs=re.split(r'(?=[Mm])',d)
  first=next((s for s in subs if s),None)
  if not first:continue
  p=ET.Element('path',{'d':first,'fill':'white','data-region':f'backing{len(backing)+1}'})
  if outline.get('transform'):p.set('transform',outline.get('transform'))
  backing.append(p)
 for p in reversed(backing):group.insert(0,p)
 ET.register_namespace('','http://www.w3.org/2000/svg');tree.write(file,encoding='unicode')
