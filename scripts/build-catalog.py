"""Validate the canonical catalog and emit its browser entry point."""
import json
import copy
import hashlib
from pathlib import Path
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[1]
folder = root / 'assets/coloring'
items = json.loads((folder / 'catalog.json').read_text())
seen = set()
prepared = folder / 'prepared'
prepared.mkdir(exist_ok=True)
metadata = {}
graphics = {'path', 'ellipse', 'circle', 'rect', 'polygon', 'polyline', 'line', 'text', 'image', 'use'}
ET.register_namespace('', 'http://www.w3.org/2000/svg')

def tag(node):
    return node.tag.split('}')[-1]

def prune_paint(node):
    for child in list(node):
        if tag(child) == 'defs':
            continue
        if 'data-region' in child.attrib:
            child.set('stroke', 'none')
            continue
        if tag(child) in graphics:
            node.remove(child)
        else:
            prune_paint(child)
    if tag(node) != 'defs':
        node.set('stroke', 'none')

def children_xml(node):
    return ''.join(ET.tostring(child, encoding='unicode') for child in node)
for item in items:
    ident = item['id']
    assert ident not in seen, f'Duplicate catalog ID: {ident}'
    seen.add(ident)
    assert item.get('name') and item.get('category'), f'Missing metadata: {ident}'
    svg = ET.parse(folder / f'{ident}.svg').getroot()
    box = list(map(float, svg.attrib['viewBox'].split()))
    assert len(box) == 4 and box[2] > 0 and box[3] > 0, f'Invalid viewBox: {ident}'
    regions = [e.attrib['data-region'] for e in svg.iter() if 'data-region' in e.attrib]
    assert 'sky' in regions, f'Missing background: {ident}'
    assert len(regions) == len(set(regions)), f'Duplicate region ID: {ident}'
    for region in (e for e in svg.iter() if 'data-region' in e.attrib):
        assert tag(region) in graphics, f'Region must be a shape: {ident}'
        assert not list(region), f'Region must not contain nested regions: {ident}'
        if 'data-fill-group' in region.attrib:
            assert region.get('data-fill-group').strip(), f'Empty group: {ident}'
    paints, lines = copy.deepcopy(svg), copy.deepcopy(svg)
    prune_paint(paints)
    for element in lines.iter():
        if 'data-region' in element.attrib:
            element.set('fill', 'none')
            for attr in ('data-region', 'data-fill-group', 'data-previous-region'):
                element.attrib.pop(attr, None)
    # A late paint shape can hide earlier ink (the simplified costumes do this).
    # Preserve that occlusion explicitly, rather than resurrecting hidden details
    # when all ink is moved to the top layer.
    for position, original in enumerate(list(svg)):
        if original.get('data-region') and original.get('data-region') != 'sky':
            predecessors = [e for e in list(lines)[:position] if tag(e) != 'defs']
            if not predecessors:
                continue
            ns = '{http://www.w3.org/2000/svg}'
            mask_id = f'paint-occlusion-{position}'
            defs = ET.SubElement(lines, ns + 'defs')
            mask = ET.SubElement(defs, ns + 'mask', {'id': mask_id,
                'maskUnits': 'userSpaceOnUse', 'x': str(box[0]), 'y': str(box[1]),
                'width': str(box[2]), 'height': str(box[3])})
            ET.SubElement(mask, ns + 'rect', {'x': str(box[0]), 'y': str(box[1]),
                'width': str(box[2]), 'height': str(box[3]), 'fill': 'white'})
            blocker = copy.deepcopy(original)
            blocker.set('fill', 'black')
            blocker.set('stroke', 'none')
            for attr in ('data-region', 'data-fill-group', 'data-previous-region'):
                blocker.attrib.pop(attr, None)
            mask.append(blocker)
            wrapper = ET.Element(ns + 'g', {'mask': f'url(#{mask_id})'})
            insertion = list(lines).index(predecessors[0])
            for element in predecessors:
                lines.remove(element)
                wrapper.append(element)
            lines.insert(insertion, wrapper)
    # Each inline layer has its own namespace for clip IDs.
    line_xml = children_xml(lines)
    for element in lines.iter():
        if element.get('id'):
            name = element.get('id')
            line_xml = line_xml.replace(f'id="{name}"', f'id="outline-{name}"')
            line_xml = line_xml.replace(f'url(#{name})', f'url(#outline-{name})')
    raw = (folder / f'{ident}.svg').read_bytes()
    revision = hashlib.sha256(raw + Path(__file__).read_bytes()).hexdigest()[:16]
    payload = {'schemaVersion': 1, 'id': ident, 'revision': revision,
               'viewBox': box, 'paint': children_xml(paints), 'lines': line_xml,
               'regions': [{'id': e.get('data-region'), 'group': e.get('data-fill-group')}
                           for e in svg.iter() if 'data-region' in e.attrib]}
    (prepared / f'{ident}.json').write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n')
    metadata[ident] = {'revision': revision, 'bundle': f'assets/coloring/prepared/{ident}.json', 'regionCount': len(regions)}
(folder / 'catalog.js').write_text(
    '// Generated from catalog.json by scripts/build-catalog.py. Do not edit.\n'
    'export const ART_CATALOG=' + json.dumps(items, ensure_ascii=False, separators=(',', ':')) + ';\n'
    'export const ART_METADATA=' + json.dumps(metadata, ensure_ascii=False, separators=(',', ':')) + ';\n'
)
print(f'Validated and generated {len(items)} coloring sheets')
