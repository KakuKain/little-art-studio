"""Rebuild source-faithful SVGs with spline ink and independent fill barriers.

Requires Pillow, numpy, OpenCV and vtracer. Existing source PNG/WebP files
are sufficient; optionally pass a directory of high-resolution originals.
The displayed ink never contains automatic fill-gap repair strokes.
"""
from pathlib import Path
import sys,json,re,cv2,numpy as np,vtracer,ast,subprocess
from PIL import Image,ImageOps
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
FOLDER=ROOT/'assets/coloring'
TMP=ROOT/'tmp/clean-lines';TMP.mkdir(parents=True,exist_ok=True)
cv2.setNumThreads(2)
DETAIL=Path(sys.argv[1]) if len(sys.argv)>1 else FOLDER/'originals'
catalog=json.loads((FOLDER/'catalog.json').read_text())
items=[i for i in catalog if i['category'] in ('princess','dragons','gabby') and not i.get('simpleOf')]
items=[dict(i,id=i.get('replaces',i['id'])) for i in items]
only=set(sys.argv[2:])
if only:items=[i for i in items if i['id'] in only]
closures=json.loads((ROOT/'scripts/coloring-closures.json').read_text())
report=[]
# Reuse the reviewed gap detector exclusively on the hidden fill barrier.
from skimage.morphology import skeletonize
from scipy.spatial import cKDTree
W,H,width=1800,2202,5
tree=ast.parse((ROOT/'scripts/trace-coloring.py').read_text())
gap_fn=next(node for node in tree.body if isinstance(node,ast.FunctionDef) and node.name=='close_short_gaps')
exec(compile(ast.Module(body=[gap_fn],type_ignores=[]),'fill-gap-helper','exec'))
GARMENTS={'elsa':(130,220,145,210),'anna':(135,160,175,170),
 'rapunzel':(110,175,205,235),'merida':(110,250,150,175),
 'jasmine':(40,225,285,95),'moana':(260,260,80,95),
 'cinderella':(195,160,115,235),'aurora':(130,160,140,245),
 'pocahontas':(90,260,210,150),'mulan':(140,175,130,220),
 'raya':(120,210,110,190)}
def vector(mask):
 contours,_=cv2.findContours(mask,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE);parts=[]
 for contour in contours:
  if cv2.contourArea(contour)<8:continue
  pts=cv2.approxPolyDP(contour,1.2,True).reshape(-1,2).astype(float)
  if len(pts)<3:continue
  mids=(pts+np.roll(pts,-1,axis=0))/2
  pair=lambda p:f'{p[0]:.1f},{p[1]:.1f}'
  parts.append('M'+pair(mids[-1])+''.join('Q'+pair(p)+' '+pair(q) for p,q in zip(pts,mids))+'Z')
 return ''.join(parts)

for item in items:
 name=item['id'];sources=[DETAIL/(name+ext) for ext in ('.png','.jpeg','.webp')]
 if name=='fury-pair':
  report.append({'id':'fury-pair-clean','original':name,'regions':0,'seeds':[],'visibleAutoGapRepairs':0});continue
 if name=='light-fury':sources.insert(0,FOLDER/'originals/light-fury-clean-input.png')
 sources += [FOLDER/'originals'/(name+'.png')]
 sources += [FOLDER/(name+ext) for ext in ('.png','.webp')]
 source=next(p for p in sources if p.exists())
 raw=Image.open(source).convert('RGB');im=ImageOps.contain(raw,(1800,2202),Image.Resampling.LANCZOS)
 ox,oy=(1800-im.width)//2,(2202-im.height)//2
 page=Image.new('RGB',(1800,2202),'white');page.paste(im,(ox,oy))
 gray=cv2.cvtColor(np.array(page),cv2.COLOR_RGB2GRAY)
 ink=(cv2.GaussianBlur(gray,(3,3),.55)<170).astype(np.uint8)*255
 n,labels,stats,_=cv2.connectedComponentsWithStats(ink,8)
 removed=0
 for j in range(1,n):
  x,y,w,h,a=stats[j]
  frame=name not in ('toothless-crouching','toothless-soaring','toothless-gliding','toothless-sitting') and w>im.width*.8 and h>im.height*.7 and a<im.width*im.height*.025
  caption=y>oy+im.height*.95 and h<im.height*.045
  if name=='dragon-riders':caption=caption or y<oy+im.height*.23 and h<im.height*.23 or y>oy+im.height*.90 and h<im.height*.08
  if frame or caption or a<12:ink[labels==j]=0;removed+=1
 if name=='fury-pair':
  edge=int(min(im.size)*.035)
  ink[oy:oy+edge,ox:ox+im.width]=0;ink[oy+im.height-edge:oy+im.height,ox:ox+im.width]=0
  ink[oy:oy+im.height,ox:ox+edge]=0;ink[oy:oy+im.height,ox+im.width-edge:ox+im.width]=0
 # Remove only disconnected costume ornaments wholly inside a reviewed ROI.
 # Connected face, hands, hair and silhouette paths can never match this test.
 ornaments=0
 if name in GARMENTS:
  gx,gy,gw,gh=np.array(GARMENTS[name])*5
  n,components,details,_=cv2.connectedComponentsWithStats(ink,8)
  for j in range(1,n):
   x,y,w,h,a=details[j]
   if gx<x and gy<y and x+w<gx+gw and y+h<gy+gh:
    ink[components==j]=0;ornaments+=1
 # Close actual cropped portrait hems with the previously reviewed garment curve.
 # Cloud/head crop boundaries on dragon sheets belong only to the fill barrier.
 if name in ('belle','tiana','merida','elsa','pocahontas'):
  for curve in closures.get(name,[]):
   a,b,c=np.array(curve,float);t=np.linspace(0,1,150)[:,None]
   pts=((1-t)**2*a+2*(1-t)*t*b+t*t*c).round().astype(np.int32)
   cv2.polylines(ink,[pts],False,255,5)
 # Modest uniform weight, no skeleton-derived or double exterior outlines.
 ink=cv2.dilate(ink,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(3,3)))
 barrier=cv2.morphologyEx(ink,cv2.MORPH_CLOSE,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(17,17)))
 out=str(FOLDER/(name+'.svg'))
 close_short_gaps(barrier)
 # Only the hidden fill barrier can use extra closure curves.
 for curve in (closures.get(name,[]) if name!='light-fury' else []):
  a,b,c=np.array(curve,float);t=np.linspace(0,1,150)[:,None]
  pts=((1-t)**2*a+2*(1-t)*t*b+t*t*c).round().astype(np.int32)
  cv2.polylines(barrier,[pts],False,255,6)
 if name=='fury-pair' and source.suffix=='.webp':
  edge=int(min(im.size)*.035);cv2.rectangle(barrier,(ox+edge,oy+edge),(ox+im.width-edge-1,oy+im.height-edge-1),255,2)
 if name in ('hiccup-toothless','toothless-gliding','toothless-sitting'):
  cv2.rectangle(barrier,(ox,oy),(ox+im.width-1,oy+im.height-1),255,3)
 if name=='merida' and Path('/tmp/merida-legacy-fill.png').exists():
  barrier=(cv2.imread('/tmp/merida-legacy-fill.png',0)<200).astype(np.uint8)*255
 envelope_ink=barrier
 if name=='merida' and Path('/tmp/merida-legacy-outline.png').exists():
  envelope_ink=(cv2.imread('/tmp/merida-legacy-outline.png',0)<180).astype(np.uint8)*255
 envelope=np.zeros_like(barrier)
 external,_=cv2.findContours(envelope_ink,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
 cv2.drawContours(envelope,external,-1,255,cv2.FILLED)
 n,regions,stats,_=cv2.connectedComponentsWithStats(255-barrier,4)
 background={int(regions[0,0]),int(regions[-1,-1])}
 if name in ('toothless-gliding','toothless-sitting'):
  for px,py in [(ox+10,oy+10),(ox+im.width-11,oy+10),(ox+10,oy+im.height-11),(ox+im.width-11,oy+im.height-11)]:background.add(int(regions[py,px]))
 if name=='fury-pair' and source.suffix=='.webp' and not barrier[675,900]:background.add(int(regions[675,900]))
 # Crop whitespace, then fit the complete visible artwork with a 20px margin.
 yy,xx=np.where(ink>0);x0,x1=int(xx.min()),int(xx.max());y0,y1=int(yy.min()),int(yy.max())
 scale=min(320/(x1-x0+1),396/(y1-y0+1));dx=180-scale*(x0+x1)/2;dy=220-scale*(y0+y1)/2
 mono=TMP/(name+'.png');Image.fromarray(255-ink).save(mono)
 traced=TMP/(name+'.svg')
 vtracer.convert_image_to_svg_py(str(mono),str(traced),colormode='binary',mode='spline',filter_speckle=8,corner_threshold=85,length_threshold=6,splice_threshold=45,path_precision=2)
 root=ET.parse(traced).getroot();outlines=[]
 for path in root:
  path.set('pointer-events','none');path.set('data-outline','true')
  outlines.append(re.sub(r'ns\d+:','',ET.tostring(path,encoding='unicode')).replace(' xmlns:ns0="http://www.w3.org/2000/svg"',''))
 parts=['<path data-region="sky" d="M0 0H360V440H0Z" fill="white"/>',f'<g data-art-fit="true" transform="translate({dx:.5f} {dy:.5f}) scale({scale:.7f})">']
 count=0;seeds=[]
 for j in range(1,n):
  x,y,w,h,a=stats[j]
  if j in background or a<20:continue
  ax,ay=max(0,x-22),max(0,y-22);bx,by=min(W,x+w+22),min(H,y+h+22)
  label_tile=regions[ay:by,ax:bx]
  mask=(label_tile==j).astype(np.uint8)*255
  visible_white=mask.copy();visible_white[ink[ay:by,ax:bx]>0]=0
  mask=cv2.dilate(mask,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(43,43)))
  mask[(label_tile!=j)&(barrier[ay:by,ax:bx]==0)]=0
  mask[envelope[ay:by,ax:bx]==0]=0
  d=vector(mask)
  if not d:continue
  count+=1;parts.append(f'<path data-region="cell{count}" transform="translate({ax} {ay})" d="{d}" fill="white" fill-rule="evenodd"/>')
  dist=cv2.distanceTransform(visible_white,cv2.DIST_L2,5);_,radius,_,peak=cv2.minMaxLoc(dist)
  if radius*scale>3:seeds.append([round(dx+scale*(ax+peak[0]),3),round(dy+scale*(ay+peak[1]),3)])
 parts+=outlines+['</g>']
 new=name+'-clean';(FOLDER/(new+'.svg')).write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 440">'+''.join(parts)+'</svg>')
 report.append({'id':new,'original':name,'regions':count,'sourcePixels':list(raw.size),'bounds':{'w':round(scale*(x1-x0+1)+4,3),'h':round(scale*(y1-y0+1)+4,3)},'removedPrintComponents':removed,'removedCostumeComponents':ornaments,'seeds':seeds,'visibleAutoGapRepairs':0})
 print(new,count,flush=True)
if only:
 old=json.loads((FOLDER/'CLEAN-LINES-REPORT.json').read_text())
 report=[i for i in old if i['original'] not in only]+report
(FOLDER/'CLEAN-LINES-REPORT.json').write_text(json.dumps(report,indent=2)+'\n')
subprocess.run([sys.executable,str(ROOT/'scripts/protect-clean-regions.py')],check=True)
subprocess.run([sys.executable,str(ROOT/'scripts/compose-fury-pair.py')],check=True)
