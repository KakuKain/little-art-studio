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
