# Coloring artwork sources

Disney princess pages: [Disneyclips](https://www.disneyclips.com/funstuff/disney-princess-coloring.html), non-commercial use with attribution; characters © Disney. Elsa/Anna: [Frozen coloring pages](https://www.disneyclips.com/funstuff/frozencoloring.html).

Toothless and pair: [Cute Coloring](https://www.cutecoloring.page/how-to-train-your-dragon-coloring-pages), personal non-commercial coloring pages. Light Fury and Night Lights: [TheToyZone](https://thetoyzone.com/how-to-train-your-dragon-coloring-pages). Family SVG combines the traced character sheets. Characters © DreamWorks. Dragon Riders: official DreamWorks printable.

Raya, Rescue Riders interpretations, Peppa, George and 12 animals: generated using built-in imagegen, then thresholded and traced into vector outlines and closed white-region paths using scripts/trace-coloring.py. AI character interpretations can differ from the original show.

All assets are for this free personal family drawing tool, with no ads or sales. See catalog.json for per-image sources.

2026-10-05 line cleanup: printable source PDFs were rendered/extracted at higher resolution where available, then retraced as closed SVG regions. Printed borders/captions were removed from the drawing surface; attribution remains in this file, catalog metadata and the app's credits. Large solid hair/bodice patches in selected sheets were opened into coloring regions. The underlying poses/compositions remain source-derived, including cropped portraits and detailed group scenes. See REVIEW.md for all-sheet inspection.

2026-10-06 simplified variants: the 12 `*-easy.svg` sheets derive from existing SVG paths and keep their source attribution. Clothing cells are merged using scripts/simplify-coloring.cjs and scripts/simplify-coloring.py (sharp, Python NumPy/OpenCV). No new image-generated artwork was produced for this batch. The detailed originals are unchanged.

V22 source-faithful rebuild: 15 princess and 5 dragon SVGs are rebuilt as spline contours. Most retain the original source pose; these are vector reconstructions, not newly generated character illustrations. Light Fury is isolated from ColoringBook.ai's Toothlessand Light Fury Magical Encounter: https://www.coloringbook.ai/how-to-train-your-dragon/toothlessand-light-fury-magical-encounter (characters © DreamWorks). The new pair composes the complete Toothless and Light Fury sheets. V20 originals and simplified sheets remain on disk for saved-work compatibility but are removed from the picker.

V23: `hiccup-toothless-clean.svg` derives from the ColoringBook.ai image supplied by the user (1024×1536). The printed border/footer is omitted; the illustration composition is unchanged. Characters © DreamWorks. Source attribution is retained here and in app credits.
