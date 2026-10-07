"""Union a simplified costume's fill regions into one continuous paint shape.
Run after simplify-princess-details.py with the vector processing Python runtime.
The visible original linework stays on top; rectangle patch edges are not paint boundaries.
"""
from pathlib import Path
import xml.etree.ElementTree as E
import copy, subprocess, tempfile
import cv2
import numpy as np
E.register_namespace('','http://www.w3.org/2000/svg')
folder=Path(__file__).resolve().parents[1]/'assets/coloring'
for name,group in [('anna','cape'),('elsa','dress'),('moana','skirt')]:
 root=E.parse(folder/f'{name}-simple.svg').getroot()
 label=copy.deepcopy(root)
 for el in label.iter():
  if el.tag.rsplit('}',1)[-1] not in ('g','path','ellipse','circle'):continue
  if el.get('stroke') not in (None,'none'):el.set('stroke','black')
  if el.get('fill')!='none':el.set('fill','black')
  if el.get('data-fill-group')==group:el.set('fill','white')
 with tempfile.TemporaryDirectory() as temp:
  source=Path(temp)/'label.svg';png=Path(temp)/'label.png';source.write_text(E.tostring(label,encoding='unicode'))
  subprocess.run(['node','-e',"require('sharp')(process.argv[1]).resize(1440,1760).flatten({background:'black'}).png().toFile(process.argv[2])",str(source),str(png)],check=True)
  raster=cv2.imread(str(png),cv2.IMREAD_GRAYSCALE)
  mask=np.uint8(raster>127)*255
  # Half a world pixel: close antialias seams without merging nearby skin or background.
  mask=cv2.morphologyEx(mask,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
  contours,hierarchy=cv2.findContours(mask,cv2.RETR_TREE,cv2.CHAIN_APPROX_SIMPLE)
  for i,contour in enumerate(contours):
   if hierarchy[0][i][3]>=0 and abs(cv2.contourArea(contour))<100:cv2.drawContours(mask,[contour],-1,255,cv2.FILLED)
  contours,_=cv2.findContours(mask,cv2.RETR_TREE,cv2.CHAIN_APPROX_SIMPLE)
  pieces=[]
  for contour in contours:
   if abs(cv2.contourArea(contour))<2:continue
   points=cv2.approxPolyDP(contour,.45,True).reshape(-1,2)/4
   pieces.append('M'+'L'.join(f'{x:.3f} {y:.3f}' for x,y in points)+'Z')
 # Preserve original visible ink above the merged shape, including real garment creases.
 overlay=E.Element('g',{'data-costume-ink':'true','pointer-events':'none'})
 for child in list(root):
  if child.tag.rsplit('}',1)[-1]=='defs' or child.get('data-region')=='sky':continue
  cloned=copy.deepcopy(child)
  for parent in list(cloned.iter()):
   for el in list(parent):
    if el.get('data-region'):parent.remove(el)
  if not cloned.get('data-region'):overlay.append(cloned)
 for parent in list(root.iter()):
  for el in list(parent):
   if el.get('data-fill-group')==group:parent.remove(el)
 E.SubElement(root,'path',{'data-region':f'simple-{group}','data-fill-group':group,'d':' '.join(pieces),'fill':'white','fill-rule':'evenodd','stroke':'none'})
 defs=next(el for el in root if el.tag.rsplit('}',1)[-1]=='defs')
 clip=E.SubElement(defs,'clipPath',{'id':'costume-ink-clip','clipPathUnits':'userSpaceOnUse'})
 E.SubElement(clip,'path',{'d':'M0 0H360V440H0Z '+' '.join(pieces),'clip-rule':'evenodd'})
 overlay.set('clip-path','url(#costume-ink-clip)')
 root.append(overlay)
 (folder/f'{name}-simple.svg').write_text(E.tostring(root,encoding='unicode'))
 print(name,group,len(contours),'contours')
