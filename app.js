import { installUI, syncSizes, setStatus } from "./modules/ui.js?v=47";
import { categoryStatus, downloadCategory } from "./modules/offline.js?v=47";
import {
  createWork,
  record,
  canUndo,
  canRedo,
  moveCursor,
  replayStart,
  addCheckpoint,
} from "./modules/history.js?v=47";
import { openStudio } from "./modules/storage.js?v=47";
import { createPainter } from "./modules/painter.js?v=47";
import { ART_CATALOG, ART_METADATA } from "./assets/coloring/catalog.js?v=47";
import { loadArtwork } from "./modules/assets.js?v=47";
import { loadRegions } from "./modules/regions.js?v=47";
const $ = (id) => document.getElementById(id),
  canvas = $("drawing"),
  ctx = canvas.getContext("2d"),
  svg = $("coloring"),
  outlines = $("outlines");
const colors = [
  "#ff7399",
  "#ffae62",
  "#ffe16b",
  "#7ccca0",
  "#74b9ed",
  "#ac8bd8",
  "#f4b7ce",
  "#cde9c4",
  "#845e49",
  "#333948",
  "#ffffff",
  "#e95c57",
  "#e0a23e",
  "#358a6c",
  "#476cbb",
];
const toolSizes = { pen: 12, eraser: 12 };
const painter = createPainter(canvas);
let scene = "kitty",
  tool = "pen",
  color = colors[0],
  stroke = null,
  hue = 0,
  studio,
  currentWork,
  ready = false;
const blankPreview = '<img src="assets/ui/pen.svg" alt="">';
const ASSET_VERSION='47';
const artworkURL = (id) =>
  `assets/coloring/${id}.svg?rev=${ART_METADATA[id]?.revision || ASSET_VERSION}`;
let catalog = ART_CATALOG,
  homeCategory = null,
  showDetailed = false;
let editorLoaded = false,
  pendingWork,
  loadingEditor;
async function ensureCurrent() {
  if (editorLoaded) return;
  if (loadingEditor) return loadingEditor;
  loadingEditor = (async () => {
    currentWork = pendingWork || createWork(scene);
    await replayWork(currentWork);
    editorLoaded = true;
    pendingWork = null;
  })().finally(() => (loadingEditor = null));
  return loadingEditor;
}
const workCache = new Map();

const categories = [
  ["princess", "公主"],
  ["dragons", "馴龍高手"],
  ["rescue", "救援騎士"],
  ["peppa", "佩佩豬"],
  ["gabby", "蓋比娃娃屋"],
  ["ocean", "海洋生物"],
  ["land", "陸地生物"],
];
function sceneCard(id, name, preview = artworkURL(id)) {
  const b = document.createElement("button");
  b.dataset.scene = id;
  b.setAttribute("aria-label", name);
  if (id === "blank") {
    b.innerHTML = blankPreview;
    b.className = "blank-card";
  } else {
    const img = new Image();
    img.src = preview;
    img.decoding = "async";
    img.loading = homeCategory ? "lazy" : "eager";
    img.alt = name;
    b.append(img);
  }
  return b;
}
function renderHome() {
  const grid = $("home-grid");
  grid.replaceChildren();
  grid.dataset.view = homeCategory ? "sheets" : "categories";
  $("category-back").hidden = !homeCategory;
  $("difficulty").hidden = !homeCategory;
  document.body.classList.toggle("in-category", !!homeCategory);
  $("category-title").textContent =
    categories.find((c) => c[0] === homeCategory)?.[1] || "";
  if (homeCategory) {
    const level = $("difficulty").value;
    for (const item of catalog.filter(
      (i) =>
        i.category === homeCategory &&
        (level === "all" || i.difficulty === level),
    ))
      grid.append(sceneCard(item.id, item.name));
    if (!grid.children.length) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "這個分類都是簡單圖案";
      grid.append(empty);
    }
  } else {
    for (const [index, [id, name]] of categories.entries()) {
      const item = catalog.find(
        (i) => i.category === id && i.difficulty === "simple",
      );
      if (!item) continue;
      const card = sceneCard(
        item.id,
        name,
        id === "gabby"
          ? "assets/ui/category-gabby.png"
          : `assets/ui/category-${item.replaces || item.id}.png`,
      );
      delete card.dataset.scene;
      card.dataset.category = id;
      card.dataset.theme = index;
      const label = document.createElement("span");
      label.textContent = name;
      card.append(label);
      grid.append(card);
    }
    const blank = sceneCard("blank", "空白畫布");
    const label = document.createElement("span");
    label.textContent = "自由畫畫";
    blank.append(label);
    grid.append(blank);
  }
}
$("difficulty").onchange = renderHome;
$("category-back").onclick = () => {
  homeCategory = null;
  renderHome();
};
const ensureScene = loadArtwork;
let artwork;
$("editor-back").onclick = () => {
  if (busy || stroke) return;
  showHome();
  historyBack();
};
$("settings-open").onclick = () => $("about-modal").showModal();
function showHome() {
  document.body.classList.add("at-home");
  save();
  refreshAfterUpdate();
}
$("home-back").onclick = () => {
  if (busy || stroke) return;
  homeCategory = null;
  renderHome();
  showHome();
  if (location.hash) historyBack();
};
function historyBack() {
  window.history.replaceState(null, "", location.pathname + location.search);
}
window.addEventListener("hashchange", () => {
  if (!location.hash) showHome();
});
function surfaceGeometry() {
  const home = document.body.classList.contains("at-home");
  if (home) document.body.classList.remove("at-home");
  const r = canvas.getBoundingClientRect();
  if (home) document.body.classList.add("at-home");
  if (scene === "blank") {
    const ratio = r.width / r.height,
      w = Math.max(360, 440 * ratio),
      h = Math.max(440, 360 / ratio);
    return { x: (360 - w) / 2, y: (440 - h) / 2, w, h };
  }
  const bounds =
    catalog.find((item) => item.id === scene)?.bounds ||
    (scene === "hiccup-toothless-clean"
      ? { w: 264, h: 400 }
      : { w: 360, h: 440 });
  const top = 64,
    bottom = 24,
    side = 16;
  const scale = Math.min(
    Math.max(1, r.width - side * 2) / bounds.w,
    Math.max(1, r.height - top - bottom) / bounds.h,
  );
  const w = r.width / scale,
    h = r.height / scale;
  return {
    x: (bounds.cx ?? 180) - w / 2,
    y: (bounds.cy ?? 220) - h / 2 - (top - bottom) / (2 * scale),
    w,
    h,
  };
}
let surface;
function prepareCopy(copy) {
  copy.setAttribute(
    "viewBox",
    `${surface.x} ${surface.y} ${surface.w} ${surface.h}`,
  );
  copy.setAttribute("preserveAspectRatio", "none");
  copy.setAttribute("width", canvas.width);
  copy.setAttribute("height", canvas.height);
  const sky = copy.querySelector('[data-region="sky"]');
  if (sky)
    sky.setAttribute(
      "d",
      `M${surface.x} ${surface.y}h${surface.w}v${surface.h}h${-surface.w}Z`,
    );
  return copy;
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
async function restore(s) {
  artwork = await ensureScene(s.scene);
  scene = s.scene;
  canvas.style.objectFit = "fill";
  surface = surfaceGeometry();
  canvas.height = Math.round((720 * surface.h) / surface.w);
  painter.resize();
  svg.innerHTML = artwork.paint;
  outlines.innerHTML = artwork.lines;
  prepareCopy(svg);
  prepareCopy(outlines);
  s.fills.forEach(([id, c]) => {
    const mapped =
      s.assetVersion < 32
        ? svg.querySelectorAll(`[data-previous-region="${id}"]`)
        : [];
    if (mapped.length) mapped.forEach((e) => e.setAttribute("fill", c));
    else if (
      !(
        s.assetVersion < 32 &&
        svg.querySelector("[data-previous-region]") &&
        id !== "sky"
      )
    )
      svg.querySelector(`[data-region="${id}"]`)?.setAttribute("fill", c);
  });
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (s.pixels) {
    const img = new Image();
    const url =
      s.pixels instanceof Blob ? URL.createObjectURL(s.pixels) : s.pixels;
    img.src = url;
    try {
      await img.decode();
    } finally {
      if (s.pixels instanceof Blob) URL.revokeObjectURL(url);
    }
    if (s.surface) {
      const scale = canvas.width / surface.w;
      ctx.drawImage(
        img,
        (s.surface.x - surface.x) * scale,
        (s.surface.y - surface.y) * scale,
        s.surface.w * scale,
        s.surface.h * scale,
      );
    } else if (scene === "blank") {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    } else {
      const scale = Math.min(canvas.width / 720, canvas.height / 880);
      ctx.drawImage(
        img,
        (canvas.width - 720 * scale) / 2,
        (canvas.height - 880 * scale) / 2,
        720 * scale,
        880 * scale,
      );
    }
  }
  if ((s.assetVersion || 0) < 43) {
    const oldCostume = {
      "anna-simple": "cell20",
      "elsa-simple": "cell36",
      "moana-simple": "cell30",
    }[scene];
    const previous = oldCostume && s.fills.find(([id]) => id === oldCostume);
    if (previous)
      svg
        .querySelector('[data-region^="simple-"][data-fill-group]')
        ?.setAttribute("fill", previous[1]);
  }
  if (scene === "belle-simple" && s.assetVersion < 37) {
    const rose = s.fills.find(([id]) => id === "simple-rose");
    if (rose)
      svg
        .querySelectorAll('[data-fill-group="rose"]')
        .forEach((el) => el.setAttribute("fill", rose[1]));
  }
  document
    .querySelectorAll("[data-scene]")
    .forEach((b) => b.classList.toggle("active", b.dataset.scene === scene));
  syncBackground();
  setTool(scene === "blank" && tool === "fill" ? "pen" : tool);
  buttons();
  await buildMasks();
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
  if (stroke || busy) {
    scheduleSave();
    return;
  }
  const work = currentWork,
    revision = work.revision,
    state = {
      scene,
      assetVersion: 44,
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
  } catch {
    setStatus("儲存空間不足，請用「儲存」下載作品", { notify: true });
  }
}
async function exportCanvas() {
  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  const c = out.getContext("2d");
  c.fillStyle = "white";
  c.fillRect(0, 0, canvas.width, canvas.height);
  async function layer(node) {
    const copy = prepareCopy(node.cloneNode(true));
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
let regions;
async function buildMasks() {
  regions =
    scene === "blank"
      ? null
      : await loadRegions(svg, artwork, canvas.width, canvas.height, surface);
}
function regionMask(id) {
  return regions?.mask(id) || null;
}
function startRegion(p) {
  return regions?.hit(p.x, p.y) || null;
}
let saveTimer;
function pauseBackgroundWork() {
  clearTimeout(saveTimer);
}
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (stroke || busy) {
      scheduleSave();
      return;
    }
    save();
    checkpointWork();
  }, 350);
}
function paintRegion(key, c) {
  const targets = key.startsWith("group:")
    ? svg.querySelectorAll("[data-fill-group]")
    : svg.querySelectorAll("[data-region]");
  for (const el of targets)
    if (
      key.startsWith("group:")
        ? el.dataset.fillGroup === key.slice(6)
        : el.dataset.region === key
    )
      el.setAttribute("fill", c);
  syncBackground();
}
svg.addEventListener("pointerdown", (e) => {
  const region = e.target.closest("[data-region]");
  if (!ready || busy || tool !== "fill" || !region) return;
  const key = region.dataset.fillGroup
    ? "group:" + region.dataset.fillGroup
    : region.dataset.region;
  const targets = region.dataset.fillGroup
    ? [...svg.querySelectorAll("[data-fill-group]")].filter(
        (el) => el.dataset.fillGroup === region.dataset.fillGroup,
      )
    : [region];
  if (targets.every((el) => el.getAttribute("fill") === color)) return;
  pauseBackgroundWork();
  paintRegion(key, color);
  commitAction({ type: "fill", region: key, color });
});
function point(e, r = stroke?.bounds || canvas.getBoundingClientRect()) {
  return {
    x: ((e.clientX - r.left) * canvas.width) / r.width,
    y: ((e.clientY - r.top) * canvas.height) / r.height,
  };
}
canvas.style.objectFit = "fill";
function worldPoint(p) {
  return [
    Math.round((surface.x + (p.x * surface.w) / canvas.width) * 1000) / 1000,
    Math.round((surface.y + (p.y * surface.h) / canvas.height) * 1000) / 1000,
  ];
}
function pixelPoint(p) {
  return {
    x: ((p[0] - surface.x) * canvas.width) / surface.w,
    y: ((p[1] - surface.y) * canvas.height) / surface.h,
  };
}
function mark(p, previous) {
  const action = stroke.action;
  if (previous)
    stroke.distance +=
      (Math.hypot(p.x - previous.x, p.y - previous.y) * surface.w) /
      canvas.width;
  const c =
    action.tool === "rainbow"
      ? `hsl(${(action.hue + stroke.distance * 2) % 360} 85% 65%)`
      : action.color;
  painter.mark(
    p,
    previous,
    stroke.width,
    c,
    action.tool === "eraser",
    stroke.mask,
  );
}
canvas.onpointerdown = (e) => {
  if (!ready || busy || stroke || e.isPrimary === false) return;
  const started = performance.now();
  pauseBackgroundWork();
  const bounds = canvas.getBoundingClientRect(),
    p = point(e, bounds),
    region = startRegion(p);
  if (scene !== "blank" && !regions?.has(region)) {
    scheduleSave();
    return;
  }
  canvas.setPointerCapture(e.pointerId);
  const width = (+$("size").value * canvas.width) / bounds.width;
  const action = {
    type: "stroke",
    tool,
    color,
    region,
    width: (width * surface.w) / canvas.width,
    hue,
    points: [worldPoint(p)],
  };
  hue = (hue + 30) % 360;
  stroke = {
    id: e.pointerId,
    p,
    region,
    bounds,
    width,
    mask: region ? regionMask(region) : null,
    action,
    distance: 0,
  };
  mark(p);
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
    mark(p, stroke.p);
    stroke.p = p;
    stroke.action.points.push(worldPoint(p));
  }
};
function finish(e) {
  if (stroke?.id !== e.pointerId) return;
  const action = stroke.action;
  stroke = null;
  commitAction(action);
  if (canvas.hasPointerCapture(e.pointerId))
    canvas.releasePointerCapture(e.pointerId);
  refitEditor();
}
canvas.onpointerup = finish;
canvas.onpointercancel = finish;
async function replayWork(work) {
  const checkpoint = replayStart(work);
  await restore(checkpoint.state);
  work.assetRevision = artwork.revision;
  const savedTool = tool,
    savedColor = color;
  try {
    for (let i = checkpoint.cursor; i < work.cursor; i++) {
      const action = work.actions[i];
      if (action.type === "fill") paintRegion(action.region, action.color);
      else if (action.type === "clear") {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        svg
          .querySelectorAll("[data-region]")
          .forEach((el) => el.setAttribute("fill", "white"));
        syncBackground();
      } else if (action.type === "stroke") {
        stroke = {
          width: (action.width * canvas.width) / surface.w,
          mask: action.region ? regionMask(action.region) : null,
          action,
          distance: 0,
        };
        let previous;
        for (const wp of action.points) {
          const p = pixelPoint(wp);
          mark(p, previous);
          previous = p;
        }
        stroke = null;
      }
      if (i % 10 === 9)
        await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  } finally {
    stroke = null;
    setTool(savedTool);
    color = savedColor;
    buttons();
  }
}
function showEditorError(error) {
  console.error(error);
  const message = /fetch|artwork|load|network/i.test(error.message)
    ? "圖片暫時無法開啟，請連網或下載這個分類"
    : "操作暫時沒有成功，請重新嘗試";
  setStatus(message, { notify: true });
}
async function runEditor(action) {
  if (busy || stroke) return;
  busy = true;
  $("paper").setAttribute("aria-busy", "true");
  pauseBackgroundWork();
  try {
    await action();
  } catch (error) {
    showEditorError(error);
  } finally {
    busy = false;
    $("paper").setAttribute("aria-busy", "false");
    buttons();
    await refitEditor();
  }
}
let busy = false;
async function travel(direction) {
  return runEditor(async () => {
    if (!currentWork) return;
    const before = currentWork.cursor;
    if (!moveCursor(currentWork, direction)) return;
    try {
      await replayWork(currentWork);
      await save();
    } catch (error) {
      currentWork.cursor = before;
      await replayWork(currentWork);
      throw error;
    }
  });
}
$("undo").onclick = () => travel(-1);
$("redo").onclick = () => travel(1);
async function switchWork(next) {
  await keepArtwork();
  if (currentWork && !studio) {
    workCache.delete(currentWork.scene);
    workCache.set(currentWork.scene, currentWork);
    if (workCache.size > 5) workCache.delete(workCache.keys().next().value);
  }
  const previous = currentWork;
  currentWork = next;
  try {
    await replayWork(next);
  } catch (error) {
    currentWork = previous;
    if (previous) await replayWork(previous);
    throw error;
  }
  setTool("pen");
  await save();
  document.body.classList.remove("at-home");
  location.hash = "draw";
}
$("home-grid").onclick = async (e) => {
  const b = e.target.closest("button");
  if (!b || busy || !ready) return;
  if (b.dataset.category) {
    homeCategory = b.dataset.category;
    $("difficulty").value = "simple";
    renderHome();
    return;
  }
  if (!b.dataset.scene) return;
  await runEditor(async () => {
    if (!editorLoaded && pendingWork?.scene !== b.dataset.scene) {
      // Open the requested sheet directly. Loading the default cat first would
      // prevent a downloaded princess pack from opening on a fresh offline visit.
      currentWork =
        (await studio?.forScene(b.dataset.scene)) ||
        createWork(b.dataset.scene);
      await replayWork(currentWork);
      editorLoaded = true;
      pendingWork = null;
      setTool("pen");
      document.body.classList.remove("at-home");
      location.hash = "draw";
      await save();
      return;
    }
    await ensureCurrent();
    if (b.dataset.scene !== scene) {
      const next =
        (await studio?.forScene(b.dataset.scene)) ||
        workCache.get(b.dataset.scene) ||
        createWork(b.dataset.scene);
      await switchWork(next);
    } else {
      setTool("pen");
      document.body.classList.remove("at-home");
      location.hash = "draw";
    }
  });
};
$("clear").onclick = () =>
  runEditor(async () => {
    await keepArtwork();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    svg
      .querySelectorAll("[data-region]")
      .forEach((e) => e.setAttribute("fill", "white"));
    syncBackground();
    commitAction({ type: "clear" });
    await save();
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
  runEditor(async () => {
    downloadBlob(await canvasBlob(await exportCanvas()), "小小畫室.png");
    await keepArtwork();
    setStatus("作品已儲存，也可以下載圖片", { notify: true });
  });
let albumURLs = [];
$("gallery").onclick = () =>
  runEditor(async () => {
    if (!ready || !studio) {
      setStatus("相簿無法保存，請下載圖片", { notify: true });
      return;
    }
    await keepArtwork();
    const all = await studio.list();
    $("artworks").replaceChildren();
    for (const art of all) {
      const img = new Image();
      img.alt = art.editable
        ? catalog.find((i) => i.id === art.scene)?.name || "我的畫作"
        : "以前的畫作";
      const hasContent =
        art.preview ||
        art.actions?.length ||
        art.base?.pixels ||
        art.base?.fills?.some(([, c]) => c !== "white");
      const picture =
        art.preview ||
        art.image ||
        (art.editable && hasContent ? artworkURL(art.scene) : null);
      if (!picture) continue;
      img.src =
        picture instanceof Blob ? URL.createObjectURL(picture) : picture;
      if (picture instanceof Blob) albumURLs.push(img.src);
      if (art.editable) {
        const button = document.createElement("button");
        button.setAttribute("aria-label", "繼續畫：" + img.alt);
        button.append(img);
        button.onclick = () =>
          runEditor(async () => {
            const work = await studio.get(art.id);
            if (!work) throw Error("Work missing");
            await ensureCurrent();
            await switchWork(work);
            $("album").close();
          });
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
  renderHome();
  try {
    studio = await openStudio();
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
    busy ||
    stroke ||
    !document.body.classList.contains("at-home")
  )
    return;
  updatePending = false;
  save().finally(() => location.reload());
}
init().then(async () => {
  if (location.hash === "#draw")
    await runEditor(async () => {
      await ensureCurrent();
      setTool("pen");
      document.body.classList.remove("at-home");
    });
  refreshAfterUpdate();
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

async function refitEditor() {
  if (
    !ready ||
    !editorLoaded ||
    document.body.classList.contains("at-home") ||
    busy ||
    stroke
  )
    return;
  const next = surfaceGeometry();
  if (
    Math.abs(next.w - surface.w) < 0.01 &&
    Math.abs(next.h - surface.h) < 0.01 &&
    Math.abs(next.x - surface.x) < 0.01 &&
    Math.abs(next.y - surface.y) < 0.01
  )
    return;
  busy = true;
  $("paper").setAttribute("aria-busy", "true");
  try {
    await replayWork(currentWork);
    await save();
  } catch (error) {
    showEditorError(error);
  } finally {
    busy = false;
    $("paper").setAttribute("aria-busy", "false");
    buttons();
  }
}
window.addEventListener("resize", refitEditor);

const offlineSelect = $("offline-category");
for (const [id, name] of categories) {
  const option = document.createElement("option");
  option.value = id;
  option.textContent = name;
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

installUI({ colors, toolSizes, getTool: () => tool, chooseColor, setTool });
