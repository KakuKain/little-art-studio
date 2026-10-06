"""Merge small decorative fill cells in existing SVGs, retaining complete artwork.
Run simplify-coloring.cjs first to obtain a labeled raster of native path geometry.
"""
from pathlib import Path
import cv2,numpy as np,json,re,xml.etree.ElementTree as ET
ROIS={
 'cinderella':[(195,160,115,235)],'aurora':[(130,160,140,245)],
 'ariel':[(205,180,125,185)],
 'jasmine':[(40,225,285,95)],'pocahontas':[(90,260,210,150)],
 'mulan':[(140,175,130,220)],'rapunzel':[(110,175,205,235)],
 'merida':[(110,240,150,180)],
 'moana':[(260,260,80,95)],'elsa':[(140,225,115,170)],
 'anna':[(135,160,175,170)],'raya':[(120,210,110,190)]}
ROOT=Path(__file__).resolve().parents[1];folder=ROOT/'assets/coloring'
report=[];catalog=json.loads((folder/'catalog.json').read_text());catalog=[i for i in catalog if not i.get('simpleOf')];by_id={i['id']:i for i in catalog}
def outline(mask):
 contours,_=cv2.findContours(mask,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE);parts=[]
 for c in contours:
  if cv2.contourArea(c)<30:continue
  pts=cv2.approxPolyDP(c,.6,True).reshape(-1,2).astype(float)/5
  if len(pts)<3:continue
  mids=(pts+np.roll(pts,-1,axis=0))/2
  pair=lambda p:f'{p[0]:.3f},{p[1]:.3f}'
  parts.append('M'+pair(mids[-1])+''.join('Q'+pair(p)+' '+pair(q) for p,q in zip(pts,mids))+'Z')
 return ''.join(parts)
for id,rois in ROIS.items():
 im=cv2.imread('/tmp/simple-art-labels/'+id+'.png');codes=(im[:,:,2].astype(np.uint32)<<16)|(im[:,:,1].astype(np.uint32)<<8)|im[:,:,0].astype(np.uint32)
 mapping=json.loads(Path('/tmp/simple-art-labels/'+id+'.json').read_text());selected=[];mask=np.zeros(codes.shape,np.uint8)
 indices=np.where(codes%8191==0,codes//8191,0).ravel().astype(np.int32);ys_grid,xs_grid=np.indices(codes.shape);counts=np.bincount(indices);sum_x=np.bincount(indices,weights=xs_grid.ravel());sum_y=np.bincount(indices,weights=ys_grid.ravel());selected_values=[]
 for value,key in mapping.items():
  idx=int(value)//8191
  if idx>=len(counts) or counts[idx]<1:continue
  cx,cy=sum_x[idx]/counts[idx]/5,sum_y[idx]/counts[idx]/5
  if any(x<=cx<x+w and y<=cy<y+h for x,y,w,h in rois):
   if id=='moana':
    region=codes==int(value); ys,xs=np.where(region)
    if np.mean((xs<260*5)|(xs>=340*5)|(ys<260*5)|(ys>=355*5))>.05:continue
   selected.append(key);selected_values.append(int(value))
 if len(selected)<3:continue
 mask[np.isin(codes,selected_values)]=255
 # Close narrow ornamental dividers; preserve other fill regions and outside silhouette.
 merged=cv2.morphologyEx(mask,cv2.MORPH_CLOSE,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(25,25)))
 valid_codes=np.isin(codes,np.array([int(v) for v in mapping],dtype=np.uint32));protected_values=[int(v) for v in mapping if int(v) not in selected_values and int(v)//8191<len(counts) and counts[int(v)//8191]>300];other=np.isin(codes,protected_values);contours,_=cv2.findContours(merged,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE);solid=np.zeros_like(merged);cv2.drawContours(solid,contours,-1,255,cv2.FILLED);merged=cv2.dilate(solid,np.ones((3,3),np.uint8))
 merged[cv2.dilate(other.astype(np.uint8),np.ones((3,3),np.uint8))>0]=0
 # Never expand into external background. Only white cells and original black outlines qualify.
 merged[codes==0]=0
 FACE={'cinderella':(190,35,95,135),'aurora':(130,30,135,145),'ariel':(95,70,105,120),'jasmine':(100,80,155,155),'pocahontas':(140,35,110,170),'mulan':(135,20,95,155),'rapunzel':(215,25,120,160),'merida':(100,60,140,185),'moana':(80,150,185,145),'elsa':(105,15,180,225),'anna':(190,10,140,155),'raya':(115,30,150,180)}
 fx,fy,fw,fh=FACE[id];merged[fy*5:(fy+fh)*5,fx*5:(fx+fw)*5]=0
 root=ET.fromstring((folder/(id+'.svg')).read_text())
 for parent in root.iter():
  for child in list(parent):
   if child.get('data-region') in selected:parent.remove(child)
 ET.SubElement(root,'{http://www.w3.org/2000/svg}path',{'data-region':'simple-details','d':outline(merged),'fill':'white','fill-rule':'evenodd'})
 svg=ET.tostring(root,encoding='unicode');svg=re.sub(r'xmlns:ns\d+="[^"]+"','',svg);svg=re.sub(r'(<\/?)(ns\d+:)',r'\1',svg);svg=svg.replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ',1)
 new=id+'-easy';(folder/(new+'.svg')).write_text(svg)
 item=by_id[id];catalog.append({'id':new,'category':item['category'],'name':item['name']+'・簡單版','source':item['source'],'simpleOf':id})
 report.append({'id':new,'source':id,'mergedRegions':len(selected),'regionsBefore':len(mapping),'regionsAfter':len(mapping)-len(selected)+1})
(folder/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
(folder/'SIMPLIFY-REPORT.json').write_text(json.dumps(report,indent=2)+'\n')
p=ROOT/'app.js';s=p.read_text();a=s.index('let catalog=')+12;b=s.index(',homeCategory=null',a)
embedded=[{k:i[k] for k in ('id','name','category','simpleOf') if k in i} for i in catalog];p.write_text(s[:a]+json.dumps(embedded,ensure_ascii=False,separators=(',',':'))+s[b:])
print(json.dumps(report,ensure_ascii=False))
