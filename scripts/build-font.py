#!/usr/bin/env python3
"""Cut the app's rounded font from jf open 粉圓 (jf open huninn) 2.1.

Only the characters the app's pages and scripts use are kept (every
character from U+2000 up in the files below, plus printable ASCII), so the
font is small enough for the offline shell; anything else falls back to the
system font. A cut font is a Modified Version under the SIL Open Font
License, which reserves the names "open huninn", "huninn", "Varela" and
"Varela Round", so the cut is renamed Playground Round (遊樂園圓體); its
copyright and license records stay. assets/fonts/OFL.txt is the license.

Run it by hand after adding text with new characters: tests/font.test.js
fails until then. It needs fontTools and brotli (pip install fonttools
brotli). The source TTF is not committed; fetch it with

  curl -L -o tmp/fonts/jf-openhuninn-2.1.ttf \\
    https://github.com/justfont/open-huninn-font/releases/download/v2.1/jf-openhuninn-2.1.ttf
"""
import hashlib
import json
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parent.parent
source = root / 'tmp/fonts/jf-openhuninn-2.1.ttf'
SHA256 = '9d5bf4932d31fe94c18cd8cfddc98bc1b14ce10f4e354c682179db290a99c825'
out = root / 'assets/fonts'
NAME = 'Playground Round'

# The files whose text the font must cover; tests/font.test.js reads the
# same list.
TEXT_FILES = ['index.html', 'app.js', 'assets/coloring/catalog.js',
              *sorted(str(p.relative_to(root)) for p in (root / 'modules').glob('*.js'))]

if not source.exists() or hashlib.sha256(source.read_bytes()).hexdigest() != SHA256:
    sys.exit(f'Fetch jf-openhuninn-2.1.ttf into {source.parent} first (see this script).')

wanted = set()
for name in TEXT_FILES:
    wanted |= {c for c in (root / name).read_text(encoding='utf-8') if ord(c) >= 0x2000}
font = TTFont(source)
cmap = font.getBestCmap()
kept = sorted(c for c in wanted if ord(c) in cmap)
missing = sorted(c for c in wanted if ord(c) not in cmap)

options = subset.Options()
options.flavor = 'woff2'
options.hinting = False
options.name_IDs = ['*']
options.name_languages = ['*']
subsetter = subset.Subsetter(options)
subsetter.populate(unicodes=[*range(0x20, 0x7F), *(ord(c) for c in kept)])
subsetter.subset(font)

# The new name replaces every name record that names the font.
names = font['name']
names.names = [n for n in names.names if n.nameID not in (1, 2, 3, 4, 6, 16, 17, 18, 21, 22)]
version = font['head'].fontRevision
for name_id, text in [(1, NAME), (2, 'Regular'), (3, f'{NAME} {version:.1f} subset'),
                      (4, NAME), (6, NAME.replace(' ', '') + '-Regular')]:
    names.setName(text, name_id, 3, 1, 0x409)
    names.setName(text, name_id, 1, 0, 0)

out.mkdir(exist_ok=True)
subset.save_font(font, str(out / 'playground-round.woff2'), options)
(out / 'playground-round.json').write_text(json.dumps({
    'source': 'https://github.com/justfont/open-huninn-font/releases/tag/v2.1',
    'sha256': SHA256,
    'characters': ''.join(kept),
    'missing': ''.join(missing),
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'{len(kept)} characters ({len(missing)} not in the font: {"".join(missing)}), '
      f'{(out / "playground-round.woff2").stat().st_size // 1024} KiB')
