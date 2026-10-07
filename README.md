# 小小畫家

給約 3–6 歲兒童使用的手機繪畫工具。無登入、廣告、付費顏色或解鎖步驟。

網站：https://kakukain.github.io/little-art-studio/

## 使用

首頁選分類或空白畫布；圖片完整適配畫布，不裁切。進入畫布預設鉛筆，粗細直接使用工具列滑桿。下方第一格開啟選色面板，中間六個常用色直接換色，最後是彩虹筆。

填色以封閉區域為單位；鉛筆鎖定第一個落筆區域。橡皮擦移除筆跡，保留線稿與填色；清除按鈕重設整份畫布，仍可復原。每份作品保留最近 20 步復原／還原，重新開啟網站仍可繼續。相簿中的新版作品可編輯，舊版 PNG 仍可下載。

離線：家長可在「設定與資訊 → 離線圖片」下載分類，包含簡單及細節版。介面不預載全部圖片；更新介面時保留已下載圖片。瀏覽器清除網站資料仍會移除本機草稿與離線圖片，重要作品可另存 PNG。

## 開發與驗證

需要 Node.js 22 以上與 Python 3，執行：

```sh
npm ci
npm run build
npm test
npm run serve
```

一般 localhost 開發不啟用 Service Worker，避免測試到舊版程式；加上 `?offline-qa=1` 可驗證離線流程。正式 GitHub Pages 正常啟用。

`release.json` 是介面版本的唯一來源。修改版本後執行 `npm run build`，產生統一的模組網址與離線介面清單。`assets/coloring/catalog.json` 是圖片目錄的唯一來源，難度也記錄在此。

## 結構

- `app.js`：畫布生命週期與各模組的協調。
- `modules/assets.js`：載入與驗證圖片契約；保留舊素材相容路徑。
- `modules/regions.js`：與顏色無關的語意區域、遮罩與有上限的快取。
- `modules/painter.js`：僅更新筆畫覆蓋的局部畫布。
- `modules/history.js`：操作紀錄、復原游標與檢查點整理。
- `modules/storage.js`：IndexedDB 作品儲存及舊草稿遷移。
- `modules/offline.js`：分類下載與下載狀態。
- `modules/ui.js`：顏色、粗細、對話框與工具選單。
- `sw.js`：介面與圖片分開快取，只管理本專案快取。

每筆操作保存結構資料，不在下筆時複製整張 Canvas。每 20 筆可建立非同步 Blob 檢查點；超出復原窗口的紀錄可整理進基底圖。切換圖片後從持久資料載入，避免每張圖片各保留 20 張完整畫布。區域遮罩只分配必要範圍，整體快取預算 24 MiB。

素材原稿及重製腳本保留在 `assets/coloring/` 與 `scripts/`。執行建置會產生每張圖獨立的填色層、線稿層、穩定區域 ID 與內容版本。新增／修改素材須通過 57 張全目錄的結構與圖片回歸流程。

詳細文件：[UI 規格](docs/UI-SPEC.md)、[素材契約](docs/ASSET-CONTRACT.md)、[驗收紀錄](docs/VERIFICATION.md)、[改善清單](docs/STRUCTURE-ROADMAP.md)。
