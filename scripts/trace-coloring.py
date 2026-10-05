"""Trace clean, high-resolution outlines and closed fill regions from raster art.

Optional third argument supplies a higher-resolution source with the same page
layout. Original 600px region labels are matched by overlap to preserve saved fills.
"""
import sys,json
from pathlib import Path
import cv2
import numpy as np
from PIL import Image,ImageOps

source,out=sys.argv[1:3]
detail=sys.argv[3] if len(sys.argv)>3 else source

def page_image(path,width,height):
 im=Image.open(path).convert('RGB')
 im=ImageOps.contain(im,(width,height),Image.Resampling.LANCZOS)
 page=Image.new('RGB',(width,height),'white')
 page.paste(im,((width-im.width)//2,(height-im.height)//2))
 return cv2.cvtColor(np.array(page),cv2.COLOR_RGB2GRAY)

# Match the prior tracer's labels, including its original region numbering.
legacy=(page_image(source,600,734)<210).astype(np.uint8)*255
k=5 if 'cinderella' in out else 3
legacy=cv2.morphologyEx(legacy,cv2.MORPH_CLOSE,np.ones((k,k),np.uint8))
legacy=cv2.dilate(legacy,np.ones((2,2),np.uint8))
_,old_labels,old_stats,_=cv2.connectedComponentsWithStats(255-legacy,4)
old_valid={i for i,(x,y,w,h,a) in enumerate(old_stats) if i and a>=25 and x>0 and y>0 and x+w<600 and y+h<734}

W,H=1800,2202
raw=page_image(detail,W,H)
source_image=Image.open(detail)
fitted=ImageOps.contain(source_image,(W,H))
fw,fh=fitted.size
ox,oy=(W-fw)//2,(H-fh)//2
# A conservative cutoff excludes grey page decorations without eating black ink.
black=(cv2.GaussianBlur(raw,(3,3),.55)<180).astype(np.uint8)*255
n,components,stats,_=cv2.connectedComponentsWithStats(black,8)
removed=[]
for i in range(1,n):
 x,y,w,h,a=stats[i]
 # Thin page-wide boxes and bottom captions are print-layout artifacts.
 top=components[y:min(y+max(3,int(h*.02)),H),x:x+w]==i
 bottom=components[max(y,y+h-max(3,int(h*.02))):y+h,x:x+w]==i
 straight_edges=top.any(axis=0).sum()>w*.50
 frame=w>fw*.80 and h>fh*.70 and a<fw*fh*.025 and straight_edges
 caption=y>oy+fh*.955 and h<fh*.045 and a<fw*fh*.004
 if 'dragon-riders' in out:
  caption=caption or (y<oy+fh*.23 and h<fh*.23) or (y>oy+fh*.90 and h<fh*.08)
 speck=a<5
 if frame or caption or speck:
  black[components==i]=0
  if frame or caption:removed.append([int(x),int(y),int(w),int(h)])
# Clear straight border segments joined to scenic art on the pair sheet.
if 'fury-pair' in out:
 border=int(min(fw,fh)*.035)
 black[oy:oy+border,ox:ox+fw]=0
 black[oy+fh-border:oy+fh,ox:ox+fw]=0
 black[oy:oy+fh,ox:ox+border]=0
 black[oy:oy+fh,ox+fw-border:ox+fw]=0
# Large pre-filled hair/bodice areas should also be available for coloring.
if any(name in out for name in ['pocahontas','aurora','moana']):
 cores=(cv2.distanceTransform(black,cv2.DIST_L2,5)>8).astype(np.uint8)*255
 count,core_labels,core_stats,_=cv2.connectedComponentsWithStats(cores,8)
 for j in range(1,count):
  _,_,cw,ch,area=core_stats[j]
  if area>5000 and cw>90 and ch>90:black[core_labels==j]=0
black=cv2.morphologyEx(black,cv2.MORPH_CLOSE,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(3,3)))
princesses=['snow-white','cinderella','aurora','ariel','belle','jasmine','pocahontas','mulan','tiana','rapunzel','merida','moana','elsa','anna']
width=5 if any(Path(out).stem==name for name in princesses) else 2
black=cv2.dilate(black,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(width,width)))
n,labels,stats,_=cv2.connectedComponentsWithStats(255-black,4)
old_labels=cv2.resize(old_labels,(W,H),interpolation=cv2.INTER_NEAREST)

def number(v):return f'{v:.2f}'.rstrip('0').rstrip('.')
def pair(p):return ','.join(number(v) for v in p)
def path_for(mask,exterior=False):
 contours,_=cv2.findContours(mask,cv2.RETR_EXTERNAL if exterior else cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)
 parts=[]
 for c in contours:
  if cv2.contourArea(c)<(4000 if exterior else 4):continue
  points=cv2.approxPolyDP(c,.8,True).reshape(-1,2).astype(float)
  if len(points)<3:continue
  mids=(points+np.roll(points,-1,axis=0))/2
  d='M'+pair(mids[-1])
  for p,end in zip(points,mids):d+='Q'+pair(p)+' '+pair(end)
  parts.append(d+'Z')
 return ''.join(parts)

regions=[]
for i in range(1,n):
 x,y,w,h,area=stats[i]
 if area<100 or x==0 or y==0 or x+w==W or y+h==H:continue
 overlaps=np.bincount(old_labels[labels==i])
 candidates=sorted(((int(overlaps[j]),j) for j in old_valid if j<len(overlaps) and overlaps[j]),reverse=True)
 regions.append((int(area),i,candidates))
regions.sort(reverse=True)
used=set()
parts=['<path data-region="sky" d="M0 0H360V440H0Z" fill="white" stroke="none"/>','<g transform="scale(.2 .19981835)" stroke="none">']
for area,i,candidates in regions:
 match=next((j for _,j in candidates if j not in used),None)
 if match is not None:used.add(match)
 id=f'r{match}' if match is not None else f'new{i}'
 d=path_for((labels==i).astype(np.uint8)*255)
 parts.append(f'<path data-region="{id}" d="{d}" fill="white" fill-rule="evenodd"/>')
parts.append(f'<path data-outline="true" pointer-events="none" d="{path_for(black)}" fill="#202020" fill-rule="evenodd" stroke="none"/>')
# Strengthen large exterior contours, keeping pupils, fingers and fine interior
# details at their original width rather than closing their white gaps.
parts.append(f'<path data-outline="true" pointer-events="none" d="{path_for(black,True)}" fill="none" stroke="#202020" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>')
parts.append('</g>')
svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 440">'+''.join(parts)+'</svg>'
Path(out).write_text(svg)
print(json.dumps({'svg':out,'regions':len(regions),'matchedSavedRegions':len(used),'removedPrintArtifacts':len(removed),'bytes':len(svg)}))
