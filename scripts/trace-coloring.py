"""Trace clean, high-resolution outlines and closed fill regions from raster art.

Optional third argument supplies a higher-resolution source with the same page
layout. Original 600px region labels are matched by overlap to preserve saved fills.
"""
import sys,json
from pathlib import Path
import cv2
import numpy as np
from PIL import Image,ImageOps
from skimage.morphology import skeletonize
from scipy.spatial import cKDTree

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

def close_short_gaps(mask):
 skeleton=skeletonize(mask>0).astype(np.uint8)
 neighbors=cv2.filter2D(skeleton,-1,np.array([[1,1,1],[1,0,1],[1,1,1]],np.uint8))
 ends=np.argwhere((skeleton==1)&(neighbors==1))
 directions=[]
 for endpoint in ends:
  current=tuple(endpoint);previous=None
  for step in range(12):
   y,x=current
   choices=[(yy,xx) for yy in range(max(0,y-1),min(H,y+2)) for xx in range(max(0,x-1),min(W,x+2)) if skeleton[yy,xx] and (yy,xx)!=current and (yy,xx)!=previous]
   if len(choices)!=1:break
   previous,current=current,choices[0]
  delta=endpoint-np.array(current);length=np.linalg.norm(delta)
  directions.append(delta/length if length else np.zeros(2))
 used=set();repairs=[]
 gap_limit=90 if Path(out).stem=='merida' else 30
 if len(ends):
  pairs=cKDTree(ends).query_pairs(gap_limit)
  for a,b in sorted(pairs,key=lambda pair:np.linalg.norm(ends[pair[0]]-ends[pair[1]])):
   if a in used or b in used:continue
   vector=ends[b]-ends[a];length=np.linalg.norm(vector)
   if length<3:continue
   vector=vector/length
   if np.dot(directions[a],vector)<.65 or np.dot(directions[b],-vector)<.65:continue
   p,q=tuple(ends[a][::-1]),tuple(ends[b][::-1])
   cv2.line(mask,p,q,255,max(3,width));used.update([a,b]);repairs.append([p,q])
  # Join a dangling contour to a nearby boundary in its continuation direction.
  original=mask.copy()
  for i,(endpoint,direction) in enumerate(zip(ends,directions)):
   if i in used or not np.any(direction):continue
   for distance in range(5,55 if Path(out).stem=='merida' else 25):
    target=np.rint(endpoint+direction*distance).astype(int);y,x=target
    if y<1 or y>=H-1 or x<1 or x>=W-1:break
    if original[y,x]:
     p,q=tuple(endpoint[::-1]),(int(x),int(y))
     cv2.line(mask,p,q,255,max(3,width));repairs.append([p,q]);break
 return repairs,ends

repairs,endpoints=close_short_gaps(black)
# Local inspection data is separate from the published SVG assets.
closures_path=Path(__file__).with_name('coloring-closures.json')
closures=json.loads(closures_path.read_text()) if closures_path.exists() else {}
for curve in closures.get(Path(out).stem,[]):
 start,control,end=np.array(curve,dtype=float)
 t=np.linspace(0,1,120)[:,None]
 points=((1-t)**2*start+2*(1-t)*t*control+t**2*end).round().astype(np.int32)
 cv2.polylines(black,[points],False,255,max(4,width))
# The original close-up photos crop contours at their image edges. Use that
# edge only as a fill barrier, without drawing a rectangular frame on the page.
fill_barrier=black.copy()
cropped=Path(out).stem=='fury-pair'
if cropped:
 edge=int(min(fw,fh)*.035)
 cv2.rectangle(fill_barrier,(ox+edge,oy+edge),(ox+fw-1-edge,oy+fh-1-edge),255,2)
n,labels,stats,_=cv2.connectedComponentsWithStats(255-fill_barrier,4)
background_labels={int(labels[0,0]),int(labels[-1,-1])}
if cropped:
 # Cave air is the background; a dragon can legitimately occupy a page corner.
 for cx,cy in [(900,675)]:
  if fill_barrier[cy,cx]==0:background_labels.add(int(labels[cy,cx]))
old_labels=cv2.resize(old_labels,(W,H),interpolation=cv2.INTER_NEAREST)

def number(v):return f'{v:.2f}'.rstrip('0').rstrip('.')
def pair(p):return ','.join(number(v) for v in p)
def path_for(mask,exterior=False,offset=(0,0)):
 contours,_=cv2.findContours(mask,cv2.RETR_EXTERNAL if exterior else cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)
 parts=[]
 for c in contours:
  if cv2.contourArea(c)<(4000 if exterior else 4):continue
  points=cv2.approxPolyDP(c,.8,True).reshape(-1,2).astype(float)+offset
  if len(points)<3:continue
  mids=(points+np.roll(points,-1,axis=0))/2
  d='M'+pair(mids[-1])
  for p,end in zip(points,mids):d+='Q'+pair(p)+' '+pair(end)
  parts.append(d+'Z')
 return ''.join(parts)

regions=[]
for i in range(1,n):
 x,y,w,h,area=stats[i]
 if i in background_labels or area<9:continue
 overlaps=np.bincount(old_labels[y:y+h,x:x+w][labels[y:y+h,x:x+w]==i])
 candidates=sorted(((int(overlaps[j]),j) for j in old_valid if j<len(overlaps) and overlaps[j]),reverse=True)
 regions.append((int(area),i,candidates,int(x),int(y),int(w),int(h)))
regions.sort(reverse=True)
used=set()
parts=['<path data-region="sky" d="M0 0H360V440H0Z" fill="white" stroke="none"/>','<g transform="scale(.2 .19981835)" stroke="none">']
for area,i,candidates,x,y,w,h in regions:
 match=next((j for _,j in candidates if j not in used),None)
 if match is not None:used.add(match)
 id=f'r{match}' if match is not None else f'new{i}'
 d=path_for((labels[y:y+h,x:x+w]==i).astype(np.uint8)*255,offset=(x,y))
 parts.append(f'<path data-region="{id}" d="{d}" fill="white" fill-rule="evenodd"/>')
parts.append(f'<path data-outline="true" pointer-events="none" d="{path_for(black)}" fill="#202020" fill-rule="evenodd" stroke="none"/>')
# Strengthen large exterior contours, keeping pupils, fingers and fine interior
# details at their original width rather than closing their white gaps.
parts.append(f'<path data-outline="true" pointer-events="none" d="{path_for(black,True)}" fill="none" stroke="#202020" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>')
parts.append('</g>')
svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 440">'+''.join(parts)+'</svg>'
Path(out).write_text(svg)
print(json.dumps({'svg':out,'regions':len(regions),'matchedSavedRegions':len(used),'removedPrintArtifacts':len(removed),'closedGaps':len(repairs),'bytes':len(svg)}))
