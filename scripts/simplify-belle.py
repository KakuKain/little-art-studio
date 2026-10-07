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
# Large petal silhouette, a single spiral mark, and two broad leaves.
flower=ET.SubElement(svg,'g',{'stroke':'#171717','stroke-width':'2.2','stroke-linecap':'round','stroke-linejoin':'round'})
ET.SubElement(flower,'path',{'data-region':'simple-rose','d':'M203 201C189 199 185 188 192 181C188 170 200 164 208 169C217 162 229 171 226 180C236 185 229 198 217 201Q210 207 203 201Z','fill':'white'})
ET.SubElement(flower,'path',{'d':'M199 185C199 176 215 176 216 184C217 190 207 194 204 188','fill':'none','pointer-events':'none'})
ET.SubElement(flower,'path',{'data-region':'simple-leaf-left','d':'M211 208Q194 194 187 211Q198 216 211 208Z','fill':'white'})
ET.SubElement(flower,'path',{'data-region':'simple-leaf-right','d':'M214 208Q225 194 238 202Q234 214 214 208Z','fill':'white'})
ET.SubElement(flower,'path',{'d':'M213 209Q215 213 214 219','fill':'none','pointer-events':'none'})
for el in svg.iter():
 if el.get('data-region') in ('cell1', 'cell3', 'cell5', 'cell6', 'cell15', 'cell17', 'cell18', 'cell26', 'cell28'):el.set('data-fill-group','hair')
(folder/'belle-simple.svg').write_text(ET.tostring(svg,encoding='unicode'))
