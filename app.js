import { installUI, syncSizes, setStatus } from "./modules/ui.js?v=49";
import {
  categoryStatus,
  downloadCategory,
  pruneArtCache,
} from "./modules/offline.js?v=49";
import {
  createWork,
  record,
  canUndo,
  canRedo,
  moveCursor,
  addCheckpoint,
} from "./modules/history.js?v=49";
import { openStudio } from "./modules/storage.js?v=49";
import { createPainter } from "./modules/painter.js?v=49";
import { ART_CATALOG, ART_CATEGORIES } from "./assets/coloring/catalog.js?v=49";
import { loadArtwork, thumbnailURL } from "./modules/assets.js?v=49";
import { loadRegions } from "./modules/regions.js?v=49";
import {
  surfaceFor,
  sameSurface,
  canvasHeight,
  toWorld,
  toPixel,
  CANVAS_WIDTH,
} from "./modules/surface.js?v=49";
import { fillOperations, FILL_VERSION } from "./modules/migrations.js?v=49";
import {
  planReplay,
  strokePen,
  pixelPlacement,
} from "./modules/renderer.js?v=49";
import { createScheduler } from "./modules/scheduler.js?v=49";
import { PALETTE } from "./modules/palette.js?v=49";
import { installAppSupport } from "./modules/install.js?v=49";
const $ = (id) => document.getElementById(id),
  canvas = $("drawing"),
  ctx = canvas.getContext("2d"),
  svg = $("coloring"),
  outlines = $("outlines");
const toolSizes = { pen: 12, eraser: 12 };
// Live drawing and replay never run at the same time, so they share one ink
// buffer. Replays draw off screen and are swapped in at once.
const ink = document.createElement("canvas"),
  painter = createPainter(canvas, ink),
  offscreen = document.createElement("canvas"),
  offscreenPainter = createPainter(offscreen, ink);
let scene = "kitty",
  tool = "pen",
  color = PALETTE[0].color,
  stroke = null,
  hue = 0,
  studio,
  currentWork,
  ready = false;
let artwork, surface, regions, outlinesKey;
let homeCategory = null;
let editorLoaded = false,
  pendingWork,
  loadingEditor;
// Without storage, recently opened works stay available for this visit.
const workCache = new Map();
const scheduler = createScheduler({
  blocked: () => !ready || !!stroke,
  onBusy(busy) {
    $("paper").setAttribute("aria-busy", String(busy));
    if (!busy) buttons();
  },
  onError: showEditorError,
});
async function ensureCurrent() {
  if (editorLoaded) return;
  if (loadingEditor) return loadingEditor;
  loadingEditor = (async () => {
    currentWork = pendingWork || createWork(scene);
    await renderWork(currentWork);
    editorLoaded = true;
    pendingWork = null;
  })().finally(() => (loadingEditor = null));
  return loadingEditor;
}
async function savedWork(id) {
  // A storage failure must not stop a child from opening a picture.
  return (await studio?.forScene(id).catch(() => null)) || null;
}

function card(name, preview, lazy) {
  const b = document.createElement("button");
  b.setAttribute("aria-label", name);
  const img = new Image();
  img.src = preview;
  img.decoding = "async";
  img.loading = lazy ? "lazy" : "eager";
  img.alt = name;
  b.append(img);
  return b;
}
function label(button, text) {
  const span = document.createElement("span");
  span.textContent = text;
  button.append(span);
  return button;
}
function renderHome() {
  const grid = $("home-grid");
  grid.replaceChildren();
  grid.dataset.view = homeCategory ? "sheets" : "categories";
  $("category-back").hidden = !homeCategory;
  $("difficulty").hidden = !homeCategory;
  document.body.classList.toggle("in-category", !!homeCategory);
  $("category-title").textContent =
    ART_CATEGORIES.find((c) => c.id === homeCategory)?.name || "";
  if (homeCategory) {
    const level = $("difficulty").value;
    for (const item of ART_CATALOG.filter(
      (i) =>
        i.category === homeCategory &&
        (level === "all" || i.difficulty === level),
    )) {
      const sheet = card(item.name, thumbnailURL(item.id), true);
      sheet.dataset.scene = item.id;
      grid.append(sheet);
    }
    if (!grid.children.length) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "這個分類都是簡單圖案";
      grid.append(empty);
    }
    return;
  }
  for (const [index, category] of ART_CATEGORIES.entries()) {
    const button = label(card(category.name, category.cover), category.name);
    button.dataset.category = category.id;
    button.dataset.theme = index;
    grid.append(button);
  }
  const blank = document.createElement("button");
  blank.dataset.scene = "blank";
  blank.className = "blank-card";
  blank.setAttribute("aria-label", "空白畫布");
  blank.innerHTML = '<img src="assets/ui/pen.svg" alt="">';
  grid.append(label(blank, "自由畫畫"));
}
$("difficulty").onchange = renderHome;
// Screens are history entries, so Android's back gesture steps from the
// editor to its category, then home, and only then leaves the app. The URL
// never changes, so every visit and reload starts at home.
let navigation = 0;
const screen = () => history.state || { screen: "home", depth: 0 };
function pushScreen(state) {
  history.pushState({ ...state, depth: screen().depth + 1 }, "");
}
function goHome() {
  const depth = screen().depth;
  if (depth > 0) history.go(-depth);
  else showHome(null);
}
$("category-back").onclick = () => {
  if (screen().screen === "category") history.back();
  else showHome(null);
};
$("editor-back").onclick = () => {
  if (scheduler.busy || stroke) return;
  if (screen().screen === "editor") history.back();
  else showHome();
};
$("home-back").onclick = () => {
  if (scheduler.busy || stroke) return;
  goHome();
};
$("settings-open").onclick = () => $("about-modal").showModal();
function showHome(category = homeCategory) {
  // A stroke still pressed when the editor closes (a back gesture that began
  // on the canvas) never receives its pointerup and would block every tap.
  if (stroke) finish({ pointerId: stroke.id });
  if (category !== homeCategory) {
    homeCategory = category;
    if (category) $("difficulty").value = "simple";
    renderHome();
  }
  document.body.classList.add("at-home");
  save();
  refreshAfterUpdate();
}
function showEditor() {
  if (screen().screen !== "editor")
    pushScreen({ screen: "editor", category: homeCategory });
  document.body.classList.remove("at-home");
}
window.addEventListener("popstate", () => {
  navigation++;
  const state = screen();
  if (state.screen === "editor" && editorLoaded && currentWork)
    document.body.classList.remove("at-home");
  else showHome(state.category || null);
});
// Returning through browser history can restore the page exactly as it was
// left. Start from home, like any other visit.
window.addEventListener("pageshow", (e) => {
  if (!e.persisted) return;
  document.querySelectorAll("dialog[open]").forEach((d) => d.close());
  if ($("tool-modal").matches(":popover-open")) $("tool-modal").hidePopover();
  goHome();
});
// The editor is hidden at home; measure it as it will appear once opened.
function measurePaper() {
  const home = document.body.classList.contains("at-home");
  if (home) document.body.classList.remove("at-home");
  const rect = canvas.getBoundingClientRect();
  if (home) document.body.classList.add("at-home");
  return rect;
}
function surfaceOf(id) {
  return surfaceFor(measurePaper(), {
    blank: id === "blank",
    bounds: ART_CATALOG.find((item) => item.id === id)?.bounds,
  });
}
function currentView() {
  return { surface, width: canvas.width, height: canvas.height };
}
function prepareLayer(node, { surface: s, width, height }) {
  node.setAttribute("viewBox", `${s.x} ${s.y} ${s.w} ${s.h}`);
  node.setAttribute("preserveAspectRatio", "none");
  node.setAttribute("width", width);
  node.setAttribute("height", height);
  node
    .querySelector('[data-region="sky"]')
    ?.setAttribute("d", `M${s.x} ${s.y}h${s.w}v${s.h}h${-s.w}Z`);
  return node;
}
function syncBackground() {
  svg.style.background =
    svg.querySelector('[data-region="sky"]')?.getAttribute("fill") || "white";
}
function buttons() {
  $("undo").disabled = !canUndo(currentWork);
  $("redo").disabled = !canRedo(currentWork);
}
function commitAction(action) {
  record(currentWork, action);
  buttons();
  save();
  checkpointWork();
}
function setTool(value) {
  tool = value;
  $("size").value = toolSizes[value === "eraser" ? "eraser" : "pen"];
  syncSizes(tool);
  canvas.style.pointerEvents = value === "fill" ? "none" : "auto";
  ["fill", "pen", "rainbow", "eraser"].forEach((t) =>
    $(t).classList.toggle("active", t === value),
  );
  $("fill").disabled = scene === "blank";
  $("pen").classList.toggle("active", value === "pen" || value === "rainbow");
  $("color-open").classList.toggle("rainbow", value === "rainbow");
  $("rainbow-quick")?.classList.toggle("active", value === "rainbow");
  $("rainbow-quick")?.setAttribute("aria-pressed", String(value === "rainbow"));
  document
    .querySelectorAll("#quick-colors [data-color]")
    .forEach((b) =>
      b.classList.toggle(
        "active",
        value !== "rainbow" && b.dataset.color === color,
      ),
    );
}
function selectorFor(by, id) {
  const attribute = {
    region: "data-region",
    previous: "data-previous-region",
    group: "data-fill-group",
  }[by];
  return `[${attribute}="${CSS.escape(id)}"]`;
}
function paintRegion(node, key, c) {
  const selector = key.startsWith("group:")
    ? selectorFor("group", key.slice(6))
    : selectorFor("region", key);
  node.querySelectorAll(selector).forEach((el) => el.setAttribute("fill", c));
}
function applySavedFills(node, state, id) {
  const previous = new Set(
    [...node.querySelectorAll("[data-previous-region]")].map(
      (el) => el.dataset.previousRegion,
    ),
  );
  for (const op of fillOperations(state, id, { previous })) {
    const selector = selectorFor(op.by, op.id);
    if (op.by === "region")
      node.querySelector(selector)?.setAttribute("fill", op.color);
    else
      node
        .querySelectorAll(selector)
        .forEach((el) => el.setAttribute("fill", op.color));
  }
}
async function decodeImage(pixels) {
  const img = new Image(),
    url = pixels instanceof Blob ? URL.createObjectURL(pixels) : pixels;
  img.src = url;
  try {
    await img.decode();
  } finally {
    if (pixels instanceof Blob) URL.revokeObjectURL(url);
  }
  return img;
}
const nextFrame = () =>
  new Promise((resolve) => requestAnimationFrame(resolve));
// Builds the whole picture off screen, then swaps it in within one task, so
// an undo, a resize or a sheet switch never shows a half-drawn frame.
async function renderWork(work) {
  const plan = planReplay(work),
    state = plan.state,
    nextScene = state.scene,
    blank = nextScene === "blank",
    nextArtwork = await loadArtwork(nextScene),
    nextSurface = surfaceOf(nextScene),
    view = {
      surface: nextSurface,
      width: CANVAS_WIDTH,
      height: canvasHeight(nextSurface),
    };
  const paint = svg.cloneNode(false);
  paint.innerHTML = nextArtwork.paint;
  prepareLayer(paint, view);
  if (plan.cleared)
    paint
      .querySelectorAll("[data-region]")
      .forEach((el) => el.setAttribute("fill", "white"));
  else applySavedFills(paint, state, nextScene);
  for (const action of plan.fills)
    paintRegion(paint, action.region, action.color);
  const nextRegions = blank
    ? null
    : await loadRegions(
        paint,
        nextArtwork,
        view.width,
        view.height,
        nextSurface,
      );
  offscreen.width = view.width;
  offscreen.height = view.height;
  offscreenPainter.resize();
  if (!plan.cleared && state.pixels)
    offscreen
      .getContext("2d")
      .drawImage(
        await decodeImage(state.pixels),
        ...pixelPlacement(state, view, blank),
      );
  for (const [i, action] of plan.strokes.entries()) {
    const mask = action.region
        ? nextRegions?.mask(action.region) || null
        : null,
      pen = strokePen(offscreenPainter, action, view, mask);
    for (const point of action.points) pen(toPixel(point, view));
    if (i % 10 === 9) await nextFrame();
  }
  artwork = nextArtwork;
  scene = nextScene;
  surface = nextSurface;
  regions = nextRegions;
  canvas.width = view.width;
  canvas.height = view.height;
  ctx.drawImage(offscreen, 0, 0);
  painter.resize();
  svg.replaceChildren(...paint.childNodes);
  prepareLayer(svg, view);
  // The line layer only changes with the artwork; re-parsing it is costly.
  const key = `${artwork.id}@${artwork.revision}`;
  if (outlinesKey !== key) {
    outlines.innerHTML = artwork.lines;
    outlinesKey = key;
  }
  prepareLayer(outlines, view);
  work.assetRevision = artwork.revision;
  document
    .querySelectorAll("[data-scene]")
    .forEach((b) => b.classList.toggle("active", b.dataset.scene === scene));
  syncBackground();
  setTool(blank && tool === "fill" ? "pen" : tool);
  buttons();
}
function canvasBlob(node) {
  return new Promise((resolve, reject) =>
    node.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(Error("Unable to encode artwork")),
      "image/png",
    ),
  );
}
let checkpointPending = false;
async function checkpointWork() {
  const lastCheckpoint = currentWork?.checkpoints?.at(-1)?.cursor || 0;
  if (
    checkpointPending ||
    !currentWork ||
    currentWork.cursor - lastCheckpoint < 20
  )
    return;
  if (stroke || scheduler.busy) {
    scheduleSave();
    return;
  }
  const work = currentWork,
    revision = work.revision,
    state = {
      scene,
      assetVersion: FILL_VERSION,
      assetRevision: artwork.revision,
      surface: { ...surface },
      width: canvas.width,
      height: canvas.height,
      fills: [...svg.querySelectorAll("[data-region]")].map((el) => [
        el.dataset.region,
        el.getAttribute("fill"),
      ]),
    };
  checkpointPending = true;
  try {
    state.pixels = await canvasBlob(canvas);
    if (work !== currentWork || work.revision !== revision) return;
    addCheckpoint(work, state);
    await save();
  } catch (error) {
    console.warn("Checkpoint skipped", error);
  } finally {
    checkpointPending = false;
    if (currentWork === work && work.revision !== revision) scheduleSave();
  }
}
async function save() {
  if (!ready || !studio || !editorLoaded || !currentWork) return;
  try {
    await studio.save(structuredClone(currentWork));
    setStatus("已保存到這台手機 ✦");
  } catch (error) {
    // A closed connection was already explained when another tab upgraded.
    if (error.code === "storage-closed") return;
    setStatus(
      error.name === "QuotaExceededError"
        ? "儲存空間不足，請用「儲存」下載作品"
        : "暫時無法保存，請用「儲存」下載作品",
      { notify: true },
    );
  }
}
function storageReplaced() {
  setStatus("畫室已在其他分頁更新，回到首頁會重新整理", { notify: true });
  updatePending = true;
  refreshAfterUpdate();
}
async function exportCanvas() {
  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  const c = out.getContext("2d");
  c.fillStyle = "white";
  c.fillRect(0, 0, canvas.width, canvas.height);
  async function layer(node) {
    const copy = prepareLayer(node.cloneNode(true), currentView());
    copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const img = new Image();
    img.src =
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(new XMLSerializer().serializeToString(copy));
    await img.decode();
    c.drawImage(img, 0, 0);
  }
  if (scene !== "blank") await layer(svg);
  c.drawImage(canvas, 0, 0);
  if (scene !== "blank") await layer(outlines);
  return out;
}
async function keepArtwork() {
  if (!ready || !editorLoaded || !currentWork) return;
  if (
    !currentWork.actions.length &&
    !currentWork.base.pixels &&
    currentWork.base.fills.every(([, c]) => c === "white")
  ) {
    await save();
    return;
  }
  if (
    currentWork.preview &&
    currentWork.previewRevision === currentWork.revision
  ) {
    await save();
    return;
  }
  const exported = await exportCanvas(),
    thumb = document.createElement("canvas");
  const scale = Math.min(1, 300 / exported.width, 300 / exported.height);
  thumb.width = Math.round(exported.width * scale);
  thumb.height = Math.round(exported.height * scale);
  thumb.getContext("2d").drawImage(exported, 0, 0, thumb.width, thumb.height);
  currentWork.preview = await canvasBlob(thumb);
  currentWork.previewRevision = currentWork.revision;
  await save();
}
function chooseColor(c) {
  color = c;
  $("color-preview").style.background = c;
  document
    .querySelectorAll("#palette button")
    .forEach((b) => b.classList.toggle("active", b.dataset.color === c));
  if (tool === "rainbow") setTool("pen");
  document
    .querySelectorAll("#quick-colors button[data-color]")
    .forEach((b) => b.classList.toggle("active", b.dataset.color === c));
  $("color-modal").close();
}
let saveTimer;
function pauseBackgroundWork() {
  clearTimeout(saveTimer);
}
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (stroke || scheduler.busy) {
      scheduleSave();
      return;
    }
    save();
    checkpointWork();
  }, 350);
}
svg.addEventListener("pointerdown", (e) => {
  const region = e.target.closest("[data-region]");
  if (!ready || scheduler.busy || tool !== "fill" || !region) return;
  const group = region.dataset.fillGroup,
    key = group ? "group:" + group : region.dataset.region;
  const targets = group
    ? svg.querySelectorAll(selectorFor("group", group))
    : [region];
  if ([...targets].every((el) => el.getAttribute("fill") === color)) return;
  pauseBackgroundWork();
  paintRegion(svg, key, color);
  syncBackground();
  commitAction({ type: "fill", region: key, color });
});
function point(e, r = stroke?.bounds || canvas.getBoundingClientRect()) {
  return {
    x: ((e.clientX - r.left) * canvas.width) / r.width,
    y: ((e.clientY - r.top) * canvas.height) / r.height,
  };
}
canvas.style.objectFit = "fill";
canvas.onpointerdown = (e) => {
  // Only touch, pen and the main mouse button draw. The mouse's back button
  // must not start a stroke that the navigation then leaves unfinished.
  if (
    !ready ||
    scheduler.busy ||
    stroke ||
    e.isPrimary === false ||
    e.button !== 0
  )
    return;
  const started = performance.now();
  pauseBackgroundWork();
  const bounds = canvas.getBoundingClientRect(),
    p = point(e, bounds),
    region = regions?.hit(p.x, p.y) || null;
  if (scene !== "blank" && !regions?.has(region)) {
    scheduleSave();
    return;
  }
  canvas.setPointerCapture(e.pointerId);
  const view = currentView(),
    action = {
      type: "stroke",
      tool,
      color,
      region,
      width: (+$("size").value * surface.w) / bounds.width,
      hue,
      points: [toWorld(p, view)],
    };
  hue = (hue + 30) % 360;
  stroke = {
    id: e.pointerId,
    bounds,
    view,
    action,
    pen: strokePen(painter, action, view, region ? regions.mask(region) : null),
  };
  stroke.pen(p);
  if (new URLSearchParams(location.search).has("performance-qa")) {
    console.info(
      `first-stroke ${Math.round((performance.now() - started) * 100) / 100} ms`,
    );
  }
};
canvas.onpointermove = (e) => {
  if (!stroke || stroke.id !== e.pointerId) return;
  const samples = e.getCoalescedEvents?.();
  for (const sample of samples?.length ? samples : [e]) {
    const p = point(sample);
    stroke.pen(p);
    stroke.action.points.push(toWorld(p, stroke.view));
  }
};
function finish(e) {
  if (stroke?.id !== e.pointerId) return;
  const action = stroke.action;
  stroke = null;
  commitAction(action);
  if (canvas.hasPointerCapture(e.pointerId))
    canvas.releasePointerCapture(e.pointerId);
  // Run a resize that arrived while the child was drawing.
  scheduler.drain();
}
canvas.onpointerup = finish;
canvas.onpointercancel = finish;
// Hiding the canvas or a system gesture takes the pointer away mid-stroke.
canvas.onlostpointercapture = finish;
function showEditorError(error) {
  console.error(error);
  const message = error?.code?.startsWith("artwork-")
    ? "圖片暫時無法開啟，請連網或下載這個分類"
    : "操作暫時沒有成功，請重新嘗試";
  setStatus(message, { notify: true });
}
scheduler.onTravel(async (count) => {
  if (!currentWork) return;
  const before = currentWork.cursor;
  let moved = false;
  for (let i = 0; i < Math.abs(count); i++) {
    if (!moveCursor(currentWork, Math.sign(count))) break;
    moved = true;
  }
  if (!moved) return;
  try {
    await renderWork(currentWork);
  } catch (error) {
    // A failed render leaves the previous picture on screen.
    currentWork.cursor = before;
    throw error;
  }
  await save();
});
scheduler.onRefit(async () => {
  if (
    !editorLoaded ||
    !currentWork ||
    document.body.classList.contains("at-home") ||
    sameSurface(surfaceOf(scene), surface)
  )
    return;
  await renderWork(currentWork);
  await save();
});
$("undo").onclick = () => scheduler.travel(-1);
$("redo").onclick = () => scheduler.travel(1);
async function switchWork(next) {
  await keepArtwork();
  if (currentWork && !studio) {
    workCache.delete(currentWork.scene);
    workCache.set(currentWork.scene, currentWork);
    if (workCache.size > 5) workCache.delete(workCache.keys().next().value);
  }
  await renderWork(next);
  currentWork = next;
  setTool("pen");
  await save();
}
$("home-grid").onclick = (e) => {
  const b = e.target.closest("button");
  if (!b || scheduler.busy || !ready) return;
  if (b.dataset.category) {
    pushScreen({ screen: "category", category: b.dataset.category });
    showHome(b.dataset.category);
    return;
  }
  const id = b.dataset.scene;
  if (!id) return;
  // Going back while a sheet loads means the child changed their mind.
  const opened = navigation;
  scheduler.run(async () => {
    if (!editorLoaded && pendingWork?.scene !== id) {
      // Open the requested sheet directly. Loading the default cat first would
      // prevent a downloaded princess pack from opening on a fresh offline visit.
      currentWork = (await savedWork(id)) || createWork(id);
      await renderWork(currentWork);
      editorLoaded = true;
      pendingWork = null;
      setTool("pen");
      await save();
    } else {
      await ensureCurrent();
      if (id !== scene)
        await switchWork(
          (await savedWork(id)) || workCache.get(id) || createWork(id),
        );
      else setTool("pen");
    }
    if (navigation === opened) showEditor();
  });
};
$("clear").onclick = () =>
  scheduler.run(async () => {
    await keepArtwork();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    svg
      .querySelectorAll("[data-region]")
      .forEach((e) => e.setAttribute("fill", "white"));
    syncBackground();
    commitAction({ type: "clear" });
  });
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
$("download").onclick = () =>
  scheduler.run(async () => {
    downloadBlob(await canvasBlob(await exportCanvas()), "小小畫室.png");
    await keepArtwork();
    setStatus("作品已儲存，也可以下載圖片", { notify: true });
  });
let albumURLs = [];
$("gallery").onclick = () =>
  scheduler.run(async () => {
    if (!ready || !studio || studio.closed) {
      setStatus("相簿無法保存，請下載圖片", { notify: true });
      return;
    }
    await keepArtwork();
    const all = await studio.list();
    $("artworks").replaceChildren();
    for (const art of all) {
      const img = new Image();
      img.alt = art.editable
        ? ART_CATALOG.find((i) => i.id === art.scene)?.name || "我的畫作"
        : "以前的畫作";
      const picture =
        art.preview ||
        art.image ||
        (art.editable && art.hasContent ? thumbnailURL(art.scene) : null);
      if (!picture) continue;
      img.src =
        picture instanceof Blob ? URL.createObjectURL(picture) : picture;
      if (picture instanceof Blob) albumURLs.push(img.src);
      if (art.editable) {
        const button = document.createElement("button");
        button.setAttribute("aria-label", "繼續畫：" + img.alt);
        button.append(img);
        button.onclick = () => {
          const opened = navigation;
          scheduler.run(async () => {
            const work = await studio.get(art.id);
            if (!work) throw Error("Work missing");
            await ensureCurrent();
            await switchWork(work);
            $("album").close();
            if (navigation === opened) showEditor();
          });
        };
        $("artworks").append(button);
      } else {
        const link = document.createElement("a");
        link.href = img.src;
        link.download = "小小畫室-" + art.id + ".png";
        link.append(img);
        $("artworks").append(link);
      }
    }
    $("album").showModal();
  });
$("close").onclick = () => $("album").close();
$("album").addEventListener("close", () => {
  for (const url of albumURLs) URL.revokeObjectURL(url);
  albumURLs = [];
});
async function init() {
  // Every visit starts at home. A reload keeps this tab's history entries, so
  // return to the first one instead of leaving editor entries behind it.
  if (screen().depth > 0) history.go(-screen().depth);
  else
    history.replaceState(
      { screen: "home", depth: 0 },
      "",
      location.pathname + location.search,
    );
  renderHome();
  try {
    studio = await openStudio(indexedDB, { onClose: storageReplaced });
    pendingWork = await studio.active();
    if (pendingWork) scene = pendingWork.scene;
    ready = true;
  } catch (error) {
    console.error(error);
    ready = true;
    const message = ["storage-blocked", "storage-timeout"].includes(error.code)
      ? error.message
      : "此瀏覽器無法保存，畫完請下載圖片";
    setStatus(message, { notify: true });
  }
}
let updatePending = false;
function refreshAfterUpdate() {
  if (
    !updatePending ||
    !ready ||
    scheduler.busy ||
    stroke ||
    !document.body.classList.contains("at-home")
  )
    return;
  updatePending = false;
  save().finally(() => location.reload());
}
init().then(() => {
  refreshAfterUpdate();
  // Tidy offline artwork once the first screen is ready.
  setTimeout(() => pruneArtCache().catch(() => {}), 5000);
});
function flushDraft() {
  if (stroke) finish({ pointerId: stroke.id });
  save();
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) flushDraft();
});
window.addEventListener("pagehide", flushDraft);
if (
  "serviceWorker" in navigator &&
  (!["localhost", "127.0.0.1"].includes(location.hostname) ||
    new URLSearchParams(location.search).has("offline-qa"))
) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController) {
      updatePending = true;
      refreshAfterUpdate();
    }
  });
  navigator.serviceWorker
    .register("./sw.js", { updateViaCache: "none" })
    .then((r) => r.update())
    .catch(() => {});
}
// Rotation fires several resizes; the scheduler re-checks until it settles.
if ("ResizeObserver" in window)
  new ResizeObserver(() => scheduler.refit()).observe($("paper"));
else window.addEventListener("resize", () => scheduler.refit());

const offlineSelect = $("offline-category");
for (const category of ART_CATEGORIES) {
  const option = document.createElement("option");
  option.value = category.id;
  option.textContent = category.name;
  offlineSelect.append(option);
}
async function showOfflineStatus() {
  try {
    const status = await categoryStatus(offlineSelect.value);
    $("offline-status").textContent =
      `可離線使用 ${status.ready} / ${status.total} 張`;
    $("offline-download").disabled = status.ready === status.total;
  } catch {
    $("offline-status").textContent = "此瀏覽器無法保存離線圖片";
  }
}
offlineSelect.onchange = showOfflineStatus;
$("offline-download").onclick = async () => {
  const button = $("offline-download");
  button.disabled = true;
  offlineSelect.disabled = true;
  try {
    await downloadCategory(offlineSelect.value, (ready, total) => {
      $("offline-status").textContent = `下載中 ${ready} / ${total} 張`;
    });
    await pruneArtCache().catch(() => {});
    await showOfflineStatus();
  } catch (error) {
    $("offline-status").textContent = error.message;
    button.disabled = false;
  } finally {
    offlineSelect.disabled = false;
  }
};
$("about-modal").addEventListener("toggle", (e) => {
  if (e.newState === "open") showOfflineStatus();
});

installUI({ toolSizes, getTool: () => tool, chooseColor, setTool });
installAppSupport();
