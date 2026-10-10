# 小小畫家

給約 3–6 歲兒童使用的手機繪畫工具。無登入、廣告、付費顏色或解鎖步驟。

網站：https://kakukain.github.io/little-art-studio/

## 使用

首頁選分類或空白畫布；圖片完整適配畫布，不裁切。進入畫布預設鉛筆，粗細直接使用工具列滑桿。下方第一格開啟選色面板，中間六個常用色直接換色，最後是彩虹筆。

填色以封閉區域為單位；鉛筆鎖定第一個落筆區域。橡皮擦移除筆跡，保留線稿與填色；清除按鈕重設整份畫布，仍可復原。每份作品保留最近 20 步復原／還原，重新開啟網站仍可繼續。相簿中的新版作品可編輯，舊版 PNG 仍可下載。

安裝：Android 在「設定與資訊 → 安裝到主畫面」安裝，或從 Chrome 選單選「安裝應用程式」；之後從主畫面開啟，全螢幕使用，返回鍵依畫布 → 分類 → 首頁的順序退回。

離線：家長可在「設定與資訊 → 離線圖片」下載分類，包含簡單及細節版。分類頁與離線包使用小型 WebP 縮圖，不下載原始 SVG。介面不預載全部圖片；更新介面時保留已下載圖片，被新版取代的舊圖片會自動清理。瀏覽器清除網站資料仍會移除本機草稿與離線圖片，重要作品可另存 PNG。

## 開發與驗證

需要 Node.js 22 以上與 Python 3，執行：

```sh
npm ci
npm run build
npm test
npm run serve
npm run format
```

`npm run build` 依序產生縮圖、圖片目錄與發布清單。推上 `main` 後，GitHub Actions 先確認產生的檔案與來源一致、通過 `npm test`，才發布到 GitHub Pages（Pages 來源須設為 GitHub Actions）。

一般 localhost 開發不啟用 Service Worker，避免測試到舊版程式；加上 `?offline-qa=1` 可驗證離線流程。正式 GitHub Pages 正常啟用。

`assets/coloring/catalog.json` 是圖片目錄的唯一來源，難度與角色範圍也記錄在此；首頁分類、名稱與封面記錄在 `assets/coloring/categories.json`。

## 版本

採語意化版本（SemVer）`主版號.次版號.修訂號`。正式版之前是測試版，格式為 `1.0.0-beta.N`。

| 變更 | 測試版期間 | 正式版之後 |
|---|---|---|
| 修正錯誤 | 遞增 N：`1.0.0-beta.2` | 遞增修訂號：`1.0.1` |
| 新增功能 | 遞增 N：`1.0.0-beta.3` | 遞增次版號：`1.1.0`，修訂號歸零 |
| 不相容的變更（例如舊作品無法遷移） | 遞增 N | 遞增主版號：`2.0.0` |

測試版完成後發布 `1.0.0`（可先發 `1.0.0-rc.1` 候選版）。版本只改 `release.json` 的 `version`，再執行 `npm run build`，會同步 `package.json`、`package-lock.json`、模組網址、離線快取名稱，以及「設定與資訊」顯示的版本。每次發布都要更新版本，已安裝的 App 才會下載新檔案。發布的 commit 標上同名 tag（例如 `v1.0.0-beta.1`）。

作品資料格式（`workSchemaVersion`）與素材格式（`assetSchemaVersion`）各自獨立，不跟介面版本一起變動。V49 以前使用內部流水號（V1–V49）；`1.0.0-beta.1` 是第一個語意化版本。

## 結構

- `app.js`：畫布生命週期與各模組的協調。
- `modules/scheduler.js`：編輯器工作排程；連按的復原會合併，旋轉後重新適配到尺寸穩定。
- `modules/renderer.js`：不依賴 DOM 的作品重播；即時繪製與重播共用同一套筆畫實作。
- `modules/surface.js`：畫布可視範圍與座標轉換，確保角色完整顯示。
- `modules/migrations.js`：舊版填色資料的區域對應。
- `modules/palette.js`：固定色票與名稱。
- `modules/install.js`：家長在資訊頁安裝 App；停用 Chrome 自動安裝橫幅。
- `modules/assets.js`：載入與驗證圖片契約；保留舊素材相容路徑。
- `modules/regions.js`：與顏色無關的語意區域、遮罩與有上限的快取。
- `modules/painter.js`：僅更新筆畫覆蓋的局部畫布。
- `modules/history.js`：操作紀錄、復原游標與檢查點整理。
- `modules/storage.js`：IndexedDB 作品儲存、相簿摘要及舊草稿遷移。
- `modules/offline.js`：分類下載、下載狀態與過期素材清理。
- `modules/ui.js`：顏色、粗細、對話框與工具選單。
- `sw.js`：介面與圖片分開快取，只管理本專案快取。

每筆操作保存結構資料，不在下筆時複製整張 Canvas。復原、旋轉與切圖都先在畫面外重畫，完成後一次換上。每 20 筆可建立非同步 Blob 檢查點；超出復原窗口的紀錄可整理進基底圖。切換圖片後從持久資料載入，避免每張圖片各保留 20 張完整畫布。區域遮罩只分配必要範圍，整體快取預算 24 MiB。

素材原稿及重製腳本保留在 `assets/coloring/` 與 `scripts/`。執行建置會產生每張圖獨立的填色層、線稿層、穩定區域 ID、縮圖與內容版本；內容版本由輸出內容計算，只修改腳本不會改變圖片網址。新增／修改素材須通過 57 張全目錄的結構與圖片回歸流程。

詳細文件：[UI 規格](docs/UI-SPEC.md)、[素材契約](docs/ASSET-CONTRACT.md)、[驗收紀錄](docs/VERIFICATION.md)、[改善清單](docs/STRUCTURE-ROADMAP.md)。
