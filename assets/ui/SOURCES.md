# UI 素材來源

- 工具 SVG：Tabler Icons，MIT（包含遊戲用的 restart.svg＝refresh、levels.svg＝layout-grid）。原始來源 https://github.com/tabler/tabler-icons ，本次使用 outline 24px、2px stroke；只調整描邊顏色。完整授權見 TABLER-LICENSE。
- sun.png：2026-10-06 使用 imagegen 生成的透明笑臉太陽，黃色、橘色短光芒、粉紅臉頰，縮至首頁 64px 使用。
- pastel-corners.png：同日使用 imagegen 生成的透明四角淡藍／青／粉／薄荷裝飾，中央留白。只用於介面背景，不畫進使用者作品。
- category-*.png：從對應現有 SVG 移除 sky、以單一淡色填色後渲染；角色線稿來源及使用條件沿用 ../coloring/SOURCES.md。保持真實線稿構圖與比例。
- ../../icon.svg：2026-10-28 為「小小遊樂園」手繪的簡單 SVG（疊方塊與星星的 App 圖示）；app-icon-*.png 由 scripts/build-app-icons.cjs 從 icon.svg 產生。
- game-*.webp 與 ../games/restaurant/*.webp：2026-10-28 至 10-29 以 ChatGPT 圖片生成製作的透明 PNG（圓潤扁平、#594137 深咖啡色描邊、粉彩配色），由 scripts/build-game-art.cjs 裁邊、置中並轉成 WebP。../games/restaurant/room-*.webp 是同日生成的直式、橫式餐廳背景（不透明），由同一個腳本切成牆面、條紋、櫃台邊緣與櫃台面板四段。原始 PNG 不放進版本庫。
