# Coloring artwork sources

Disney princess pages: [Disneyclips](https://www.disneyclips.com/funstuff/disney-princess-coloring.html), non-commercial use with attribution; characters © Disney. Elsa/Anna: [Frozen coloring pages](https://www.disneyclips.com/funstuff/frozencoloring.html).

Toothless and pair: [Cute Coloring](https://www.cutecoloring.page/how-to-train-your-dragon-coloring-pages), personal non-commercial coloring pages. Light Fury and Night Lights: [TheToyZone](https://thetoyzone.com/how-to-train-your-dragon-coloring-pages). Family SVG combines the traced character sheets. Characters © DreamWorks. Dragon Riders: official DreamWorks printable.

Raya, Rescue Riders interpretations, Peppa, George and 12 animals: generated using built-in imagegen, then thresholded and traced into vector outlines and closed white-region paths using scripts/trace-coloring.py. AI character interpretations can differ from the original show.

All assets are for this free personal family drawing tool, with no ads or sales. See catalog.json for per-image sources.

2026-10-05 line cleanup: printable source PDFs were rendered/extracted at higher resolution where available, then retraced as closed SVG regions. Printed borders/captions were removed from the drawing surface; attribution remains in this file, catalog metadata and the app's credits. Large solid hair/bodice patches in selected sheets were opened into coloring regions. The underlying poses/compositions remain source-derived, including cropped portraits and detailed group scenes. See REVIEW.md for all-sheet inspection.

2026-10-06 simplified variants: the 12 `*-easy.svg` sheets derive from existing SVG paths and keep their source attribution. Clothing cells are merged using scripts/simplify-coloring.cjs and scripts/simplify-coloring.py (sharp, Python NumPy/OpenCV). No new image-generated artwork was produced for this batch. The detailed originals are unchanged.

V22 source-faithful rebuild: 15 princess and 5 dragon SVGs are rebuilt as spline contours. Most retain the original source pose; these are vector reconstructions, not newly generated character illustrations. Light Fury is isolated from ColoringBook.ai's Toothlessand Light Fury Magical Encounter: https://www.coloringbook.ai/how-to-train-your-dragon/toothlessand-light-fury-magical-encounter (characters © DreamWorks). The new pair composes the complete Toothless and Light Fury sheets. V20 originals and simplified sheets remain on disk for saved-work compatibility but are removed from the picker.

V23: `hiccup-toothless-clean.svg` derives from the ColoringBook.ai image supplied by the user (1024×1536). The printed border/footer is omitted; the illustration composition is unchanged. Characters © DreamWorks. Source attribution is retained here and in app credits.

## V27 additional dragons and Gabby characters

Four dragon drawings were supplied by the user: one Supercoloring print and three ColoringBook.ai prints. The original character composition is kept, with print marks omitted and source attribution moved to credits. The sitting/gliding sheets already crop parts of the character in the supplied drawing; no unseen anatomy is invented.

Gabby scope: all 11 characters currently listed on https://www.gabbysdollhouse.com/characters plus Mama Box (12 sheets). This covers the main cast, not every episodic/film supporting character. Characters © DreamWorks. Raster reference files remain in the ignored originals directory; deployable assets are SVG only.

- toothless-crouching-clean: User-provided line art; Supercoloring
- toothless-soaring-clean: User-provided ColoringBook.ai line art
- toothless-gliding-clean: User-provided ColoringBook.ai line art
- toothless-sitting-clean: User-provided ColoringBook.ai line art
- gabby-clean: https://tv.dreamworks.com/printables/Gabby/coloring/DW2021_Gabby_ColoringPages_Printable_.pdf
- pandy-clean: https://tv.dreamworks.com/printables/Gabby/coloring/DW2021_Gabby_ColoringPages_Printable_.pdf
- cakey-clean: https://tv.dreamworks.com/printables/Gabby/coloring/DW2021_Gabby_ColoringPages_Printable_.pdf
- dj-catnip-clean: https://wakethekids.com/gabbys-dollhouse-coloring-pages/
- kitty-fairy-clean: https://wakethekids.com/gabbys-dollhouse-coloring-pages/
- mercat-clean: https://wakethekids.com/gabbys-dollhouse-coloring-pages/
- pillow-cat-clean: https://wakethekids.com/gabbys-dollhouse-coloring-pages/
- baby-box-clean: https://wakethekids.com/gabbys-dollhouse-coloring-pages/
- catrat-clean: https://wakethekids.com/gabbys-dollhouse-coloring-pages/
- carlita-clean: https://wakethekids.com/gabbys-dollhouse-coloring-pages/
- mama-box-clean: https://wakethekids.com/gabbys-dollhouse-coloring-pages/
- marty-clean: https://www.coloringpages101.com/Gabby-s-Dollhouse-coloring-pages/101979-Marty-the-Party-Cat-Gabby-s-Dollhouse-coloring-page

- `belle-simple.svg`：沿用 `belle-clean.svg` 的貝兒造型與來源；本專案重製簡化玫瑰，合併主要髮絲填色區。原版保留。


### V40 簡化版

moana-simple、elsa-simple、anna-simple 衍生自本資料夾對應的 -clean.svg，來源與角色權利標示沿用原版；只簡化局部服裝裝飾。belle-simple 的玫瑰以 SVG 路徑重新設計；人物保留原始來源輪廓。製作腳本：scripts/simplify-princess-details.py、scripts/simplify-belle.py。
