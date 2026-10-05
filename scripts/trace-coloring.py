"""Convert a generated black/white coloring page into real SVG fill regions."""
import sys,json
from pathlib import Path
import cv2
import numpy as np
from PIL import Image,ImageOps
source,out=sys.argv[1:3]
im=Image.open(source).convert('RGB'); im=ImageOps.contain(im,(600,734));page=Image.new('RGB',(600,734),'white');page.paste(im,((600-im.width)//2,(734-im.height)//2))
gray=cv2.cvtColor(np.array(page),cv2.COLOR_RGB2GRAY)
black=(gray<210).astype(np.uint8)*255
black=cv2.morphologyEx(black,cv2.MORPH_CLOSE,np.ones((5 if 'cinderella' in out else 3,5 if 'cinderella' in out else 3),np.uint8))
black=cv2.dilate(black,np.ones((2,2),np.uint8))
white=255-black
n,labels,stats,_=cv2.connectedComponentsWithStats(white,4)
def path_for(mask):
 contours,_=cv2.findContours(mask,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)
 parts=[]
 for c in contours:
  if cv2.contourArea(c)<1:continue
  c=cv2.approxPolyDP(c,.45,True).reshape(-1,2)
  if len(c)<3:continue
  parts.append('M'+' '.join(f'{x},{y}' for x,y in c)+'Z')
 return ''.join(parts)
regions=[]
for i in range(1,n):
 x,y,w,h,area=stats[i]
 if area<25:continue
 if x==0 or y==0 or x+w==600 or y+h==734:continue
 regions.append((area,i,path_for((labels==i).astype(np.uint8)*255)))
regions.sort(reverse=True)
# Keep tiny details visible in the outline, but only offer useful tapping areas.
parts=['<path data-region="sky" d="M0 0H360V440H0Z" fill="white" stroke="none"/>','<g transform="scale(.6 .599455)" stroke="none">']
for _,i,d in regions:
 parts.append(f'<path data-region="r{i}" d="{d}" fill="white" fill-rule="evenodd"/>')
parts.append(f'<path data-outline="true" pointer-events="none" d="{path_for(black)}" fill="#292929" fill-rule="evenodd"/>')
parts.append('</g>')
svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 440">'+''.join(parts)+'</svg>'
Path(out).write_text(svg)
print(json.dumps({'svg':out,'regions':len(regions),'bytes':len(svg)}))
