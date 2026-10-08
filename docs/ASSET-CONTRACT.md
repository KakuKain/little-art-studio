# 著色素材契約 v1

來源目錄為 `assets/coloring/catalog.json`。每筆記錄包含唯一 `id`、名稱、分類、難度 `simple | detailed`，可選 `source`、角色 `bounds`、`simpleOf`、舊 ID `replaces`。目前有 57 張圖、7 個分類。分類的 ID、名稱、順序與首頁封面記錄在 `assets/coloring/categories.json`；每個分類至少要有一張簡單圖。

目前來源 SVG 使用 `0 0 360 440` 座標；主體範圍以 catalog 的 `bounds` 決定完整顯示比例，無範圍資料時使用完整紙面。每張圖必須有 `data-region="sky"` 背景，以及不重複的區域 ID。區域是有填色幾何的葉節點；需要一起上色時，以同名 `data-fill-group` 明確指定。畫筆與填色均使用 `group:名稱` 這個穩定識別碼。

`scripts/build-catalog.py` 檢查 XML、viewBox、背景、ID、區域節點與群組，產生：

- `catalog.js`：瀏覽器共用的分類、目錄與素材 metadata；不可手動修改。
- `prepared/<id>.json`：`schemaVersion`、`id`、`revision`、`viewBox`、`paint`、`lines`、`regions`。

建置前，`scripts/build-thumbnails.cjs` 由來源 SVG 產生 `thumbs/<id>.webp`（360×440），供分類頁與離線包使用。`thumbs/manifest.json` 記錄每張縮圖的來源雜湊；來源與設定未變時不重新編碼，CI 也因此不受不同平台編碼結果影響。

`paint` 只保留填色幾何及所需 transform／clip 定義，移除線稿與裝飾；`lines` 沒有填色區域的所有權。線稿層位於使用者筆跡之上，避免塗抹或擦除角色輪廓。兩層的 clip ID 分開命名，後方圖形被較晚填色形狀遮住的情況以明確 mask 保留，避免被簡化掉的裝飾重新出現。

素材版本（`revision`）由產生的 bundle 內容計算，與介面版本、作品資料 schema v2 分開。輸出未改變時，升級介面或修改建置腳本都不改變下載網址，家長不必重新下載離線圖片。修改 ID 或群組前需提供作品遷移方式；既有 ID 不能任意重新分配給不同部位。

## 必要驗收

`npm test` 比對每張素材拆分前後的白底及填色外觀，檢查角色取樣點與背景分離、簡化區域不漏到背景、服裝區域無舊方框斷點，以及六個小爪子的獨立填色區。畫筆、橡皮擦與作品游標使用實際模組測試。

自動取樣不是對所有像素的角色語意判斷，也無法決定一張畫是否足夠可愛；新線稿仍須在手機尺寸人工檢視。此版本沒有重新分配既有 57 張圖片的部位 ID。

## 相容性

舊內建 cat／princess／bunny 等幾何保留在 `modules/legacy-scenes.js`，只用來開啟舊草稿。已退休但仍存在的原始 SVG 可用相容渲染器開啟。若更新後尚未下載新分層資料，離線時先使用快取中較舊版本的同張 bundle（區域 ID 跨版本穩定），再退回本專案先前快取的同張 SVG。新版本快取後，被取代的舊 bundle、舊縮圖與舊 SVG 會被清理；尚無替代品的舊版本與已退休圖片保留。
