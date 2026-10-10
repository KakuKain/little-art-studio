# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

小小畫家 (Little Art Studio): a mobile-first coloring/drawing PWA for children aged about 3–6. It is plain browser JavaScript (ES modules, no framework, no bundler), deployed as static files to GitHub Pages at https://kakukain.github.io/little-art-studio/. UI strings and project docs are in Traditional Chinese (zh-Hant).

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
- New files in `modules/` and new `.svg`/`.png` files in `assets/ui/` join the offline shell automatically.

## Architecture

`app.js` wires DOM events to the modules: home grid, editor, album, and offline settings. Logic that doesn't need the DOM lives in modules with unit tests:

- `surface.js`: fits the catalog `bounds` into the paper (64/24/16px insets, never crops) and converts between canvas pixels and SVG space.
- `renderer.js`: `planReplay()` (replay starts at the newest checkpoint and skips everything before the last `clear`) and `strokePen()`. Live drawing and replay share `strokePen()`.
- `migrations.js`: maps fills saved by older artwork generations to current region IDs.
- `scheduler.js`: serializes editor work.
- `palette.js`: the fixed colors and their names.
- `install.js`: the parents' "install to home screen" section. It suppresses Chrome's automatic install banner so children can't trigger it.

**Navigation** (Android-first PWA): each screen (`home`, `category`, `editor`) is a `history.pushState` entry `{screen, category?, depth}`, and the URL never changes.
- Android's back gesture goes editor → category → home → exit. A `popstate` handler re-shows the matching screen.
- The on-screen ← buttons call `history.back()`. The home button calls `history.go(-depth)`.
- `init()` returns to the root entry (or replaces it), so every visit and reload starts at home.
- `navigation` counts back/forward moves. A sheet that finishes loading after the child went back does not open the editor.
- `showHome()`/`showEditor()` toggle `body.at-home` synchronously. Don't move screen state into View Transition callbacks: they run asynchronously and are aborted in some states, which once delayed the switch.
- Screen fade-ins are plain CSS animations. The drawing surface only fades and never moves, because moving it would offset an early stroke.

**App feel** (`style.css`): `body` has `touch-action: pan-x pan-y` (no pinch or double-tap zoom), `overscroll-behavior: none`, `user-select: none`, and no tap highlight. `ui.js` cancels `contextmenu`.

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
- `save()` also writes a `summary:<id>` record into `state`. The album reads only these summaries.
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

`scripts/build-app-icons.cjs` regenerates the manifest PNG icons (`assets/ui/app-icon-*.png`, including the maskable one) from `icon.svg`. Run it by hand; it is not part of `npm run build`, because cross-platform PNG output would break CI's no-diff check.

The other `scripts/*.py|cjs` files are one-off tracing and simplification tools for regenerating art. `tmp/` and raster originals are gitignored scratch.

## Verification

Automated tests do not judge whether line art looks right, and there is no browser test runner. Visual and interaction checks happen manually in a browser at phone, tablet, and desktop viewports. Results are recorded per release in `docs/VERIFICATION.md`, with progress in `docs/STRUCTURE-ROADMAP.md`. When behavior changes, also update `docs/UI-SPEC.md` and `docs/ASSET-CONTRACT.md`.
