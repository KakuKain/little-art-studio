# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

小小遊樂園 (formerly 小小畫家, Little Art Studio): a mobile-first PWA for children aged about 3–6. It has a coloring/drawing studio plus small ad-free puzzle games (no timers, lives or purchases). The repo, URL, IndexedDB name and cache names still say little-art-studio. It is plain browser JavaScript (ES modules, no framework, no bundler), deployed as static files to GitHub Pages at https://kakukain.github.io/little-art-studio/. UI strings and project docs are in Traditional Chinese (zh-Hant).

## Commands

Requires Node.js ≥ 22 and Python 3.

```sh
npm ci
npm run build          # thumbnails → catalog + prepared bundles → stamp release version (+ Prettier)
npm test               # full suite (node:test unit tests + .cjs artwork/renderer regressions)
npm run serve          # python http.server on :8088
npm run format         # Prettier (format:check to verify); see .prettierignore
```

Run a single test from the repo root (the `.cjs` tests use cwd-relative paths):

```sh
node --test tests/scheduler.test.js    # node:test files (*.test.js)
node tests/coloring-regression.cjs     # standalone .cjs scripts, run directly
```

Dev query flags: the service worker is **not** registered on localhost/127.0.0.1 unless you add `?offline-qa=1`. Once registered, it keeps serving cached `?v=N` files on that origin. `?performance-qa` logs first-stroke latency to the console.

CI (`.github/workflows/pages.yml`) runs `npm run build`, fails if that changes any file, runs `npm test`, and only then deploys `main` to Pages. This requires the repo's Pages source to be set to "GitHub Actions".

## Generated files: never hand-edit

Nothing is bundled. The committed files are what ship, so generated output must be rebuilt with `npm run build` and committed.

- `scripts/build-thumbnails.cjs` generates `assets/coloring/thumbs/<id>.webp` plus `manifest.json`. The manifest stores source hashes, so unchanged thumbnails are never re-encoded. This keeps CI's no-diff check platform-independent.
- `scripts/build-catalog.py` generates `assets/coloring/catalog.js` (`ART_CATEGORIES`, `ART_CATALOG`, `ART_METADATA`) and `assets/coloring/prepared/<id>.json` from `catalog.json`, `categories.json`, and the source SVGs.
- `scripts/prepare-release.py` generates `offline-shell.js` (the SW shell file list and cache name). It also stamps the release version into several places:
  - every `?v=…` in `index.html`
  - every relative `from "./x.js"` import in `app.js` and `modules/*.js` (keep imports relative and static so the regex stamps them)
  - the `<span data-release>` shown in the about dialog
  - the `version` in `package.json` and `package-lock.json`

## Versioning and releases

- The version is a semantic version string in `release.json`, its single source of truth. Edit `release.json` only, then run `npm run build`; the script rejects anything else.
  - During beta it is `1.0.0-beta.N`. Bump N for every release.
  - After `1.0.0`: `1.0.x` for fixes, `1.x.0` for features, `x.0.0` for incompatible changes.
- Every deployed change needs a bump. Without one, installed service workers keep serving the old `?v=…` files.
- Release commits are titled `Release <version>` and tagged `v<version>`.
- V1–V49 were plain internal numbers; their shells (`little-art-studio-shell-v49`) are still cleaned up by prefix.
- New files in `modules/` and `styles/`, and new `.svg`/`.png`/`.webp` files in `assets/ui/` and `assets/games/`, join the offline shell automatically.

## Architecture

`app.js` wires DOM events to the modules: home grid, editor, album, and offline settings. Logic that doesn't need the DOM lives in modules with unit tests:

- `surface.js`: fits the catalog `bounds` into the paper (64/24/16px insets, never crops) and converts between canvas pixels and SVG space. `previewCrop()` cuts album previews to the 360:440 frame around the sheet.
- `sound.js`: sounds synthesized with Web Audio (`sounds.pop/bump/swish/meow/cheer`, no audio files) and `say()`, which speaks with a Chinese `speechSynthesis` voice and stays quiet on devices without one; new words interrupt what is being said. Coloring and the games have sounds but no speech; only the hub cards say their names. `little-playground.sound` = `off` mutes both; the about dialog's checkbox sets it. `audioContext()` is the one context, shared with the music.
- `music.js`: the background music, also synthesized: a 24-bar music-box waltz (`BARS`, `CHORDS`, `score()`) scheduled a little ahead and looped. It starts at the first touch or key (`installMusic()`), and the context is suspended while the page is hidden. `little-playground.music` holds the volume 0–100 (default 50, 0 = off; the gain is its square); the about dialog's slider sets it and plays while it moves. It is independent of the sound checkbox.
- `renderer.js`: `planReplay()` (replay starts at the newest checkpoint and skips everything before the last `clear`) and `strokePen()`. Live drawing and replay share `strokePen()`.
- `migrations.js`: maps fills saved by older artwork generations to current region IDs.
- `scheduler.js`: serializes editor work.
- `palette.js`: the fixed colors and their names.
- `install.js`: the parents' "install to home screen" section. It suppresses Chrome's automatic install banner so children can't trigger it.
- `ui.js`: `onHold()` runs a parents' action after a two-second hold (album deletion) and `holdToOpen()` gates the about dialog with it (a keyboard click opens it at once). Brush size is three radio buttons (`syncSizes()`), not a slider.

**Navigation** (Android-first PWA): each screen is a `history.pushState` entry `{screen, category?, game?, depth}`, and the URL never changes. Screens: `home` (game hub) → `coloring` → `category` → `editor`, or `home` → `game`.
- Android's back gesture goes one screen back, and exits only from home. A `popstate` handler re-shows the matching screen.
- The on-screen ← buttons call `history.back()`. The home button calls `history.go(-depth)`.
- `init()` returns to the root entry (or replaces it), so every visit and reload starts at home.
- `navigation` counts back/forward moves. A sheet that finishes loading after the child went back does not open the editor.
- `showHome()`/`showEditor()` toggle `body.at-home` synchronously. Don't move screen state into View Transition callbacks: they run asynchronously and are aborted in some states, which once delayed the switch.
- Screen fade-ins are plain CSS animations. The drawing surface only fades and never moves, because moving it would offset an early stroke.

**Styles** live in `styles/`, one file per part, linked by `index.html` in this order: `base.css` (shared by every screen), `home.css`, `editor.css`, `parents.css` (album and about dialog), `celebration.css` (the card shared by a cleared level and 「完成」), `games.css` (what both games share), `game-blocks.css`, `game-restaurant.css`. A style used by one part belongs in its file; only styles that really are shared go in `base.css`, `celebration.css` or `games.css`. Image URLs in them are relative to `styles/` (`../assets/…`). Later files win ties, so a part's file may refine a shared rule.
- The look is the games' warm room everywhere: `base.css` holds the colors (`--bg` cream, `--text` warm brown, `--cream`/`--wood` for round buttons, trays and level names, `--honey` for the chosen tool), and cards on the home screen are toy blocks tinted by `data-theme` (`--tint`, `--edge`). The hub's background is 方塊出門's room. The Tabler icons in `assets/ui/` are stroked `#5b4636`.
- The font is 遊樂園圓體 (`Playground Round`, `assets/fonts/playground-round.woff2`): jf open 粉圓 cut by `scripts/build-font.py` to the characters of `index.html`, `app.js`, `modules/*.js` and the catalog, renamed because the OFL reserves its names. It has one weight (`font-synthesis-weight: none`). Text with a new character fails `tests/font.test.js` until the script is run again (by hand; it needs fontTools and the source TTF in `tmp/fonts/`, see its docstring). WOFF2 files in `assets/fonts/` join the offline shell.

**Games**: the hub card list is `GAMES` in `app.js`. The hub shows no levels or counts: the games are for play, not for keeping score.
- Each game has rules in a pure module with unit tests (e.g. `blocks.js`), a screen module (e.g. `game-blocks.js`, exporting `create…({onBack})` → `{open, close}`) and a stylesheet (`styles/game-blocks.css`). Nothing of a game is in `index.html` or `app.js` beyond its hub card and `gameScreens` entry.
- The screen module holds its markup (`MARKUP`) and adds `<section id="game-<id>" class="game">` after `#home` the first time the game opens; `body[data-game="<id>"]` shows it. `ui.js` closes every dialog's ✕ and backdrop taps through one document listener, so dialogs added later work too.
- Each game has an entry in `gameScreens` in `app.js`.
- A game screen keeps `body.at-home` and adds `at-game`, so editor refits ignore it and update reloads wait until the child leaves the game.
- Progress is a per-device convenience in `localStorage` (`little-playground.<game>`). `game-kit.js` loads and saves it, shows the shared level picker (cleared levels get a star; twenty to a page, with a 「繼續第 N 關」 button; calling it again while open swaps the list) and cheers a cleared level (`celebrate()`: a tune, plus confetti unless motion is reduced). `makeHand()` builds the demo hand both games use on levels 1–2.
- Generated levels use `random.js`: the seeded PRNG `seeded()` and the Fisher–Yates `shuffle()`. Never use `sort()` with a random comparator: sort algorithms differ between engines and would change the levels.
- 方塊出門 (`blocks.js`):
  - Blocks move cell by cell after the finger (`dragTo`) and leave through a same-colored door at least as wide as the block. A step needs the finger more than half a cell ahead (strictly: at exactly half, the block would swing back and forth forever), and the other axis (before the first step: the one the finger leads less) needs more than three quarters, so sideways drift neither changes rows nor slides a block pushed against the edge out of a door beside it. The screen picks up the block whose cells contain the finger, gaps included, and letting go of a block in front of its own door (`doorAt`) sends it out. One `dragTo` call can step a block several cells and then out (a block slid along the wall into its door), so an exit reports `from`, where the block stood at the door, and the screen animates the exit from there, not from where the block was last drawn. While a cat is held its doors bounce (`callHome()`); levels 1–2 show a demo hand (`showHand()`, straight paths only, which holds for those fixed levels), and the bulb hint wiggles a cat that `canExit` now.
  - Each cat is a picture chosen by its block's shape (`catPicture()`: `cat-<color>-head|lying|sitting.webp` in `assets/games/blocks/`; lying cats are mirrored by id to look either way), and colors alone match cats to doors. The fence is `frame.webp` scaled as a whole round the board, so its wood is a fixed share of the board (`fenceFor()`); doors are CSS pills lying on it.
  - `generateLevel(n, mode)` is deterministic and accepts only boards where blocks can be exited one by one (`exitOrder`), so no level can dead-end. `kids` levels grow gently (4×4 to level 14, 5×5 to 45, then 6×6); `adult` (大人) levels have their own seed and grow from 6×6 to 8×8 with many cats stuck at the start. The screen keeps the children's level at the top of its progress and the grown-ups' in `progress.adult`, with `progress.mode` the one being played; its level dialog has the 小朋友／大人 switch. A cat pushed almost a cell into something it cannot pass bumps (`bump()`) with a soft sound.
- 動物餐廳 (`restaurant.js`):
  - Customers sit at the counter, `seats` at a time, and each orders one dish made of parts (`DISHES`: 綠茶 is 杯子 + 茶葉 + 水). The 電鍋 (`COOKER`) cooks 米 + 水 into 白飯, a dish of its own and a part of sushi.
  - `tap()` sends an ingredient where `destination()` says it is needed: the plate of the customer who has waited longest, or the 電鍋 when that customer waits for 白飯. Anything else is handed back, so nothing is lost. It returns the new state and the events that follow (`put`, `cook`, `serve`, `arrive`, `done`), which the screen plays in order. A lone flight plays alongside the next tap; anything longer makes taps wait (`busy`), and steps of a day that is no longer shown stop at their next pause (`epoch`, `STALE`).
  - A day's ingredients, exactly as many as it needs, are heaped in stacks (`stacks`). Only tops can be taken; an unwanted one waits on the tray (`tray` places) and leaves it by itself once someone needs it, and with the tray full it is handed back. A full tray with nothing useful on top is stuck, so every day is checked with `solve()` (a budget keeps the generator quick) and the screen has undo and restart. Each day is also tried with 20 random games (`luckyGames()`): the first `kids` days must be finished by most of them (`easy`), later ones by at most `lucky`. The children's menu grows one idea at a time (drinks, then 白飯, then sushi), and the first customer of a day that adds a dish orders it. `adult` (大人) days have more customers, a two-place tray and need planning: few random games finish them and looking one tap ahead (`oneStepAhead()`) never does. Progress is kept like 方塊出門's (`progress.adult`, `progress.mode`, the 小朋友／大人 switch, styled by `.game-modes` in `games.css`).
  - Every animal, ingredient and dish is a drawn WebP named after its id in `assets/games/restaurant/` (`animal-<id>.webp`, `food-<id>.webp`, and `tool-cooker.webp` for the 電鍋), so a new one needs its picture. The game has sounds but no speech; `describeOrder()` (小兔子想要一杯綠茶) and `partName()` label orders and plates for screen readers.

**App feel** (`styles/base.css`): `body` has `touch-action: pan-x pan-y` (no pinch or double-tap zoom), `overscroll-behavior: none`, `user-select: none`, and no tap highlight. `ui.js` cancels `contextmenu`.

**Three-layer canvas** (`#paper` in `index.html`):
- `svg#coloring` is the paint layer. Regions are filled by setting the `fill` attribute.
- `canvas#drawing` holds the strokes. It is a fixed 720px wide.
- `svg#outlines` holds the line art. It sits **above** the strokes, so pen and eraser never cover the outlines.

Each prepared bundle supplies `paint`, `lines`, and `regions` separately (see `docs/ASSET-CONTRACT.md`).

**Rendering** (`renderWork()` in `app.js`): every undo, redo, resize, and sheet switch builds the next picture off screen first, using a detached SVG clone plus an offscreen canvas. It then commits the result in one synchronous block, so a failed render leaves the previous picture untouched. Live and offscreen painters share one ink buffer, which is safe because they never draw at the same time.

**Scheduling** (`scheduler.js`): never add ad-hoc busy flags.
- `scheduler.run(task)`: user tasks. A task is dropped while another is running, so no tap fires late.
- `scheduler.travel(±1)`: undo/redo taps made during a replay join it.
- `scheduler.refit()`: called by the `ResizeObserver`. A refit requested while busy runs afterwards, until the size settles.
- Nothing starts while a stroke is in progress. `finish()` calls `scheduler.drain()`.

**Semantic regions** (`modules/regions.js`): the paint SVG is re-rendered with each region coded as a unique RGB color (index × 8191), producing a `Uint16Array` label bitmap.
- Stroke hit-testing and per-region masks come from this bitmap. Fill taps use SVG DOM targets.
- Region keys are `data-region` ids, or `group:<data-fill-group>` for grouped regions.
- A stroke is clipped to the region where it started.
- The cache is LRU with a 24 MiB budget.

**Editable work model** (`history.js`, `storage.js`): a work is `{schemaVersion: 2, id, scene, base, actions[], cursor, checkpoints[]}`.
- Actions (`fill`, `stroke`, `clear`) are structured records. Stroke points and widths are stored in SVG space (360×440 viewBox), so they replay at any size.
- The undo window is 20 actions. About every 20 actions, a PNG Blob checkpoint is taken, and at most 2 are kept. Once the cursor reaches 40 or more, actions that can no longer be undone are compacted into `base`.
- IndexedDB `little-art-studio` is at v2, with stores `state`, `art`, and `works`.
- `save()` also writes a `summary:<id>` record into `state`. The album reads only these summaries. A summary's `hasContent` comes from `hasVisibleContent()` (strokes and colored fills still applied after the last clear), so a work whose strokes were all undone stays out of the album and unchecked; summaries without the current `version` are worked out again once. `remove(id)` deletes a work or old PNG, its summary and a matching `activeId`; the album offers it after a two-second hold.
- `openStudio()` times out after 3 s.
- When another tab upgrades the database, the connection closes and later calls reject with `code: "storage-closed"`. The app explains this once and reloads at home.

**Offline** (`sw.js`, `offline.js`): there are two caches. `little-art-studio-shell-v<N>` is replaced on each release. `little-art-studio-art-v1` survives releases.
- An offline sheet consists of its current bundle plus its WebP thumbnail.
- `pruneArtCache()` deletes artwork only after its current replacement is cached.
- Offline, `loadArtwork()` falls back to any cached older-revision bundle, then to an SVG cached by pre-V48 releases.
- Errors carry codes (`artwork-unavailable`, `artwork-invalid`, `storage-*`). Never match on message text.

## Invariants and compatibility

- **Versions are independent.** `release.json` holds the UI `version`, `workSchemaVersion`, and `assetSchemaVersion`. Each artwork's `revision` is a hash of its generated bundle content, so it changes only when the output changes. Changing revisions (or thumbnails) makes parents' offline packs show as not downloaded.
- **Region IDs are stable.** Saved works reference region ids and `group:` names. Never reassign an existing id to a different body part. Add a mapping in `migrations.js` before renaming ids or groups.
- **Fill-format version.** Checkpoints write `assetVersion: FILL_VERSION` (44). A state without `assetVersion` predates v12 and is treated as the oldest format.
- **Keep the legacy paths.** Old drafts depend on them, so don't remove them:
  - `modules/legacy-scenes.js`
  - retired-but-shipped SVGs loaded by `loadArtwork`
  - the mappings in `migrations.js`
  - the v1 `state.current` draft migration
  - the cached-SVG fallback
  - pre-surface checkpoint placement in `pixelPlacement()`

## Artwork pipeline

Source SVGs live in `assets/coloring/` (viewBox `0 0 360 440`). Each SVG needs:

- a `data-region="sky"` background
- every region as a leaf shape with a unique `data-region`
- an optional `data-fill-group` for regions that should fill together

To add or change a sheet:

1. Edit `catalog.json`. The fields are `id`, `name`, `category`, and `difficulty: simple|detailed`. Optional fields are `bounds {w, h, cx?, cy?}`, `simpleOf`, `source`, and `replaces`.
2. Add character seed points to `tests/coloring-seeds.json`, or to `CLEAN-LINES-REPORT.json` for clean-line sheets.
3. Run `npm run build && npm test`. The suite checks all 57 sheets.

Home categories, their order, names, and cover PNGs live in `categories.json`. The build fails on these:
- an unknown category
- a missing cover
- a category without a `simple` sheet

`scripts/build-game-art.cjs` turns generated transparent PNGs (default source `tmp/restaurant-art/`: `animal-<id>.png`, `food-<id>.png`, `tool-<id>.png`, `game-<id>.png`) into trimmed, centered WebP files: 動物餐廳 pictures in `assets/games/restaurant/` and hub cards in `assets/ui/`. It converts every matching PNG in the folder, so pass a folder holding only the pictures to redo. It also cuts the 動物餐廳 room (`restaurant-background-portrait|landscape.png`) into `room-*.webp` strips at rows listed in `BACKDROP`; the page stretches the plain stripe and panel strips so the counter's edge meets the customer's chin at any screen size. For 方塊出門 it trims the cats (`cat-<color>-<pose>.png`) to their own shape, writes the room (`blocks-background-portrait|landscape.png`) and rebuilds the fence (`blocks-frame.png`) from its top left corner, mirrored and carried on along the sides, so all four sides match; pass the source folder (e.g. `tmp/blocks-art`). Run it by hand; the PNG originals are not committed. WebP files in `assets/ui/` and `assets/games/` join the offline shell automatically.

`scripts/build-app-icons.cjs` regenerates the manifest PNG icons (`assets/ui/app-icon-*.png`, including the maskable one) from `icon.svg`. Run it by hand; it is not part of `npm run build`, because cross-platform PNG output would break CI's no-diff check.

The other `scripts/*.py|cjs` files are one-off tracing and simplification tools for regenerating art. `tmp/` and raster originals are gitignored scratch.

## Verification

Automated tests do not judge whether line art looks right, and there is no browser test runner. Visual and interaction checks happen manually in a browser at phone, tablet, and desktop viewports. Results are recorded per release in `docs/VERIFICATION.md`, with progress in `docs/STRUCTURE-ROADMAP.md`. When behavior changes, also update `docs/UI-SPEC.md` and `docs/ASSET-CONTRACT.md`.
