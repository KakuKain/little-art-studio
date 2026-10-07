"""Keep Belle's existing silhouette and pose; simplify the rose and combine hair paint regions."""
from pathlib import Path
import xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[1]
folder=root/'assets/coloring'
ET.register_namespace('','http://www.w3.org/2000/svg')
svg=ET.parse(folder/'belle-clean.svg').getroot()
# World-coordinate cut replaces only the original dense flower.
defs=ET.Element('defs');clip=ET.SubElement(defs,'clipPath',{'id':'simple-details','clipPathUnits':'userSpaceOnUse'})
ET.SubElement(clip,'path',{'d':'M0 0H360V440H0Z M192 168H242V214H186V181L192 176Z','clip-rule':'evenodd'})
art=ET.Element('g',{'clip-path':'url(#simple-details)'})
for child in list(svg):
 if child.get('data-region')=='sky':continue
 svg.remove(child);art.append(child)
svg.append(defs)
svg.append(art)
# A rosebud with broad overlapping petals, pointed sepals and two leaves.
flower=ET.SubElement(svg,'g',{'stroke':'#171717','stroke-width':'1.9','stroke-linecap':'round','stroke-linejoin':'round'})
petals=[
 ('simple-rose','M193 183C188 176 195 170 202 172C204 164 213 164 219 168C227 165 235 171 233 178C238 184 233 195 226 200C216 208 201 203 196 194Z'),
 ('rose-back-fold','M202 172C207 164 216 163 222 169C224 172 224 179 221 185L207 187C202 182 200 177 202 172Z'),
 ('rose-heart','M204 174C209 169 218 170 221 174C220 179 214 183 209 184C210 180 209 177 204 174Z'),
 ('rose-left-fold','M193 178C198 176 208 181 214 188C217 190 221 190 227 187C225 199 214 204 206 200C199 196 194 188 193 178Z'),
 ('rose-front-fold','M200 191C210 199 222 193 234 181C234 195 225 204 216 204C208 204 203 199 200 191Z')]
for name,d in petals:ET.SubElement(flower,'path',{'data-region':name,'data-fill-group':'rose','d':d,'fill':'white'})
ET.SubElement(flower,'path',{'data-region':'rose-sepal','d':'M207 203L208 209L214 207L220 211L222 202Q215 207 207 203Z','fill':'white'})
ET.SubElement(flower,'path',{'data-region':'simple-leaf-left','d':'M212 213C204 211 194 202 187 207L190 211L188 213C197 218 204 216 212 213Z','fill':'white'})
ET.SubElement(flower,'path',{'data-region':'simple-leaf-right','d':'M215 214C218 204 229 198 239 201L236 204L238 205C232 214 223 217 215 214Z','fill':'white'})
ET.SubElement(flower,'path',{'d':'M214 207Q217 214 214 220M193 209L207 213M220 212L232 205','fill':'none','pointer-events':'none'})
for el in svg.iter():
 if el.get('data-region') in ('cell1', 'cell3', 'cell5', 'cell6', 'cell15', 'cell17', 'cell18', 'cell26', 'cell28'):el.set('data-fill-group','hair')
(folder/'belle-simple.svg').write_text(ET.tostring(svg,encoding='unicode'))
