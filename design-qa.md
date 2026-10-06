# Design QA — 樣板 2 簡約童趣風

日期：2026-10-06。範圍：現有 GitHub Pages 繪畫工具改版，不建立新網站、不更换框架。

## Source visual truth

- 原始選定參考：docs/reference.jpg（1536×1024 px，使用者提供的樣板中間欄）。
- 實作完整截圖：docs/screenshots/home-desktop.jpg、category-desktop.jpg、draw-desktop.jpg（1280×720 CSS px，browser screenshot 1280×720 pixels，1×）。
- 手機：home-mobile.jpg、category-mobile.jpg、draw-mobile.jpg（390×844 CSS px，1×）。
- 全頁並排比較：docs/design-comparison.jpg。來源中間欄依每個面板的實際邊界裁取，再與對應首頁、分類、繪畫状态並排，保持比例，不拉伸；最大對比宽 500px。參考為合成 mock，不含真實裝置 CSS viewport，故不把原圖外框當成應實作的瀏覽器邊框。
- 局部細節：docs/screenshots/tools-detail.jpg，並檢查 390px 實際操作截圖中的工具、色票、返回按鈕與文字。

## Findings and fixes

- [P1, fixed] 舊首頁沒有品牌層級、卡片全為米色線稿選擇。改成藍色「小小畫家」、副標、太陽、透明四角 PNG 裝飾、淡色分類卡；圖示採 Tabler，來源線稿直接轉成透明淡色預覽。最新證據：home-mobile.jpg、home-desktop.jpg。
- [P1, fixed] 舊桌機畫畫頁所有工具在底部，與樣板 2 的左右分組不符。寬 ≥900px 且高 ≥560px 改左繪圖、右操作、底部常用色票；手機保持大畫布與底部七個圖示。最新證據：draw-desktop.jpg、draw-mobile.jpg。
- [P1, fixed] 三幅独立縮圖拼成一張紙，且部分角色縮在大量留白中央。移除選圖庫的 dragon-family 拼版，改為各角色獨立選擇；所有 36 张以真實黑線 bounding box 等比例置中，不裁切，最大輪廓 320×396／360×440。FIT-REPORT.json 記錄全部變換，svg-background.cjs 36 張指定種子通過。
- [P2, fixed] 首輪桌機導覽圖示被全域工具文字規則影響。只在桌機工具列顯示短標，首頁設定與返回按鈕仍純圖示。
- [P2, fixed] 320px 裝置的七個 44px 按鈕加外距可能橫向溢出。極小手機改 3px footer 外距及 1px 間距，保持完整 44px tap target。docs/rwd-checks.json：320、375、768、1024 和橫向 844px 無橫向溢出、可見主要控制全在視窗内。
- [P2, fixed] 作品操作放在舊工具混合選單，筆刷與資訊層級混亂。粗細保留點工具開啟，來源單獨關於；重做常駐工具列，手機更多只放作品操作。已驗證局部擦除、粗細選擇與不同圖片復原隔離。
- [P3, accepted] 現有分類為六個，因此首頁採手機兩欄／大螢幕三欄，而不是參考八分類的四欄；不新增沒有內容的交通／太空／花草空卡片。
- [P3, accepted] 分類插圖重用真正線稿的淡色預覽，保留熟悉的既有角色，不替換成參考中示意 emoji／車子圖；太陽和背景裝飾使用生成 PNG，未用 CSS／自製 SVG 仿造這些裝飾。

## Required fidelity surfaces

- 字體／排版：依提供規格使用 Noto Sans TC／PingFang TC 系統 fallback；藍色粗主標，深色簡短分類標，手機繪圖圖示不帶長說明。實際尺寸介面文字清楚，无分類名換行／截斷；合成 mock 的標題比例並非逐像素複製，依裝置可讀尺寸重排。
- 間距／布局：卡片 22px、dialog／桌機畫布 24px 圓角，14–18px 卡距，留白明確；桌機左右工具分組與底部色票符合樣板 2 結構，手機畫布完整。極小／橫向尺寸已測。
- 顏色／token：白、淡藍、淡黃、淡粉、淡綠；主要字 #263238、品牌 #087BAC；選中淡黃 + 金黃描邊、停用 .35。沒有以米色／深紫舊主題混入主要新畫面。
- 圖片品質：線稿真 SVG、等比縮放、完整轮廓；透明 PNG 分類預覽不留白色矩形，太陽與四角裝飾不進畫布。36 張粉紅背景總覽逐張檢視，種子點隔離通過。細節多的群像保留於額外難度，不宣稱全部 path 完美或全部重新手繪。
- 文案／內容：名稱、回選圖、回首頁、簡單／全部／細節較多都與真實功能一致。未放未實作蠟筆與貼紙；功能與路由差異清楚寫進 UI-SPEC.md。

## Browser and interaction evidence

Codex in-app browser 實際瀏覽並操作，不以 HTTP 或建置成功替代視覺驗證。

驗證：首頁 → 分類 → 圖案；分類返回與回首頁；「全部」公主 15 张；圖案切換復原停用；身體填色、12px 橡皮擦局部拖曳、復原；固定色票、完整選色／粗細 dialog；手機直向、平板直／橫向、桌機、短橫向。

尺寸：320×568、375×667、390×844、768×1024、1024×768、1280×720、844×390。檢查 DOM control bounds + 畫面；普通按鈕至少 44px，寬螢幕 64×66px。橫向色票祖先設為 display:none 時，bounds 0 屬預期收起，不是隱藏了必要的顏色按鈕。

Console：檢查 browser error／warn，回傳空列表。SVG 背景測試全数通過。PNG 匯出後相簿確認 data:image/png 圖片（720×427 的當次桌機畫布）。in-app browser 的 download event 等待超時，未確認作業系統下載檔案落地；PNG 生成與本機相簿儲存已確認，原下载觸發邏輯保留。全螢幕支援由瀏覽器決定，不宣稱 iOS Safari 支援同樣 API。

## Implementation checklist

- [x] 參考及三頁完整 screenshot 對照
- [x] 字體、布局、色彩、素材、文案五項表面檢查
- [x] 觸控按鈕局部檢查及 RWD 邊界紀錄
- [x] 全庫大圖比例及指定背景隔離種子測試
- [x] 核心流程、填色、橡皮擦、復原和選單驗證
- [x] 實作差異與後續項目納入 UI 規格

final result: passed

## V13 mobile drawing performance
- Replaced SVG path-by-path pointer hit testing with the prepared region-label bitmap.
- Cached stroke geometry and restricted clear/composite operations to the segment bounds.
- Undo captures a Canvas copy immediately; PNG encoding and persistence wait until 700 ms after drawing stops. History copies are compressed individually during pauses; starting another stroke cancels pending work.
- Native Canvas comparison (720 × 1400, 240 samples): pen clipped 742 → 140 ms; eraser clipped 740 → 167 ms; rainbow clipped 1043 → 255 ms. This is a desktop renderer benchmark, not measured phone latency. Tests check opaque interiors, bounded antialias differences, and no pixels escaping the selected mask.
- Browser verified at 390 × 844: drawing, brush sizes, eraser, undo/redo, restoration after reload; no console errors. Physical phone verification remains with the user.

## V14 toolbar and contextual menu
- At 390 × 844 and 1280 × 800, undo/redo appear at the top, with icon-only clear beside home and a 16px gap.
- Clearing removes paint, preserves line art, and can be undone. Browser verified clear → undo restored the drawing.
- More opens a compact anchored menu without a modal backdrop. Verified Escape dismissal and opening About; no console errors.

## V15 home loading and color placement
- Embedded the lightweight catalog; home does not wait for a catalog network request or build the last artwork’s masks. Category covers no longer briefly request SVGs, and sheet thumbnails load lazily.
- Removed full-artwork precaching and reuse cached assets before contacting the network. Newly selected uncached sheets require connectivity.
- Reduced sun.png from 544130 to 8027 bytes while retaining transparency.
- Verified home SVG contains zero prepared regions; selecting kitty restores saved fills after reload. Color control is first in the tool group. Browser test at 390 × 844 reported no console errors. Cache regression covers offline hits, shell fallback and fresh navigation.

## V16 consolidated colors
- Moved current-color panel entry to the start of the bottom color row; removed it from the tool group.
- Six fixed swatches immediately choose color; the final rainbow swatch directly enables rainbow drawing and exposes pressed state.
- Verified direct rainbow drawing, changing back to blue, opening the full panel, and mobile layout at 390 × 844 and 320 × 568; no console errors.

## V18 per-artwork audit
- All 36 catalog sheets rendered and visually reviewed; suspect areas checked at 1800 × 2200. Per-sheet observations and remaining complexity limitations recorded in assets/coloring/REVIEW.md.
- Strengthened light-fury/night-lights outline strokes while retaining fill IDs and geometry. Elsa/Raya now use the detailed category.
- All 36 background isolation seed checks passed, including additional Ariel-tail and Merida-hair points. These are sampled assertions, not exhaustive guarantees for every decorative cell.
- Browser checked Light Fury background fill, separate character fill and undo at 390 × 844; no console errors.

## V20 clothing simplification QA

12 native SVG variants were visually inspected; Moana's selection was narrowed to the skirt so Pua and the limbs remain intact. All 48 sheets passed designated background-isolation seed checks. Each of the 12 merged clothing masks passed comparison against the original exterior background (2-pixel antialias margin). Mobile 390×844: Elsa simplified dress fill, undo to white, redo to blue; no console errors. Screenshot: docs/screenshots/elsa-easy-mobile-v20.jpg.

Scope: garment detail reduction, not a full character redraw. Hair, faces, small scene companions and remaining ornaments can still be intricate. Originals and existing saved works are retained.


## V22：公主與馴龍線稿重建（2026-10-06）

15 張公主、5 張馴龍著色紙改用平順曲線 SVG，保留來源角色造型與構圖。移除列印文字、外框及部分獨立裝飾；自動補缺口僅用於隱藏的填色邊界，不顯示額外補線。光煞採完整單隻角色，雙龍圖改成兩隻完整角色的組合。這批是來源線稿的向量重建，並非 20 張全新原創插畫。

舊 SVG 與 easy 版本保留，支援舊作品；選圖介面只呈現新版。群像、珊瑚、密集髮絲等複雜構圖置於細節較多分類。角色原有黑色髮塊等仍保留；不保證每個極小細節都可獨立填色。

驗證：全部 20 張新版逐張渲染檢視；36 張目前選圖皆通過白區背景隔離取樣檢查（容許取樣點周圍 2px 的曲線邊緣偏差）。390×844 手機畫面測試艾莎：背景粉紅、衣服藍色，臉部、手臂與辮子維持白色，復原與還原正常，無 console error。截圖：docs/screenshots/elsa-mobile-v22.jpg。

維護：scripts/rebuild-clean-lines.py 使用 OpenCV、NumPy、vtracer 重建；scripts/prepare-clean-lines.cjs 使用 sharp 準備梅莉達既有邊界；scripts/protect-clean-regions.py 保護曲線中的小留白；scripts/compose-fury-pair.py 組合双龍。執行階段僅需靜態 SVG，無新增 API 呼叫。

## V25：近景圖片滿寬

小嗝嗝與夜煞改用內容範圍 264×400 計算視野，維持原比例與完整內容。390×844 手機中左右留白接近零；上／下保留比例差所需空間。舊筆跡仍沿同一 SVG 座標重投影，填色仍保持獨立區域。截图 docs/screenshots/hiccup-fullwidth-v25.jpg。

## V27 驗證

新增 4 張使用者提供夜煞線稿與 12 位蓋比角色；全部新增 SVG 視覺檢查、53 張背景隔離取樣通過。手機填色驗證蛋糕貓及滑翔夜煞；7 個角色分類加空白畫布，維持兩欄手機佈局。測試使用獨立 127.0.0.1 來源，避免污染使用者 localhost 作品。新素材為來源重建，非全新角色創作。


## V28：圖片完整顯示

著色紙保留比例，以完整內容縮放到畫布；左右各保留 16px，上方 64px、下方 24px，避免圖案被導覽按鈕遮住。寬圖在手機直式畫面保留留白。空白畫布維持全區可畫。

驗證：390×844 手機尺寸檢查夜煞蓄勢待發的翅膀、尾巴，以及蓋比的耳朵與鞋子完整呈現；1280×720 桌面檢查直式角色。手機點選褲子填色後復原成功，維持同一張畫紙。截圖：docs/screenshots/complete-image-mobile-v28.jpg。


## V29：鉛筆與獨立粗細

開啟畫紙預設鉛筆；鉛筆、橡皮擦點擊只切換工具。工具列提供常駐粗細滑桿（5–40 CSS px），兩種工具在本次使用期間各自記住粗細；填色時停用滑桿。手機 390×844 檢查控制未溢出；鉛筆調到 40，切換橡皮擦為 12，再切回鉛筆保留 40，過程不出現 modal。


## V31：首頁分類排列

七個分類與自由畫畫以八張等大卡片排列；768px 以上四欄，手機兩欄。標題與太陽改成置中的緊密群組；預覽圖統一容器尺寸，白底以 multiply 融入柔和卡片背景，陸地分類補上淡綠底色。驗證 1280×720 桌面及 390×844 手機排列，截圖位於 docs/screenshots/home-v31.jpg 與 home-mobile-v31.jpg。


## V32：夜煞爪子與背景遮罩

針對四張新增夜煞圖重新分區：隱藏補線 closing 核由 17px 降到 5px，填色擴張由 43px 降到 9px（來源遮罩 1800×2202）。避免小爪子空腔被抹平與背景白色碎片。滑翔圖六個爪子空腔以 2880×3520 渲染驗證均為獨立 cell，填背景仍白；原有 53 張背景取樣檢查通過。瀏覽器實測背景填粉紅、爪子單独填藍成功。四張圖新增 data-previous-region，從舊標籤可見區域的重疊對應舊填色，新增區域保留白色，舊筆跡不變。截圖：docs/screenshots/gliding-background-v32.jpg。
