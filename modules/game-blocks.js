// 方塊出門 screen: draws a level, turns finger drags into block moves and
// remembers the child's progress on this device. The rules live in blocks.js.
import {
  generateLevel,
  dragTo,
  doorAt,
  canExit,
  cloneBlocks,
} from "./blocks.js?v=1.0.0-beta.8";
import {
  loadProgress,
  saveProgress,
  showLevelPicker,
  celebrate,
  makeHand,
} from "./game-kit.js?v=1.0.0-beta.8";
import { sounds } from "./sound.js?v=1.0.0-beta.8";

// Each color has its own shape, drawn as the cat's eyes and on its door,
// so a child who cannot tell the colors apart still matches them. Shapes
// are drawn in a 20 × 20 box around the origin.
const SHAPES = {
  heart:
    '<path d="M0 8C-9 2-10-4-5.5-6.5-2.5-8 0-5.5 0-4 0-5.5 2.5-8 5.5-6.5 10-4 9 2 0 8Z"/>',
  star: '<path d="M0-9 2.2-3.1 8.6-2.8 3.6 1.2 5.3 7.3 0 3.8-5.3 7.3-3.6 1.2-8.6-2.8-2.2-3.1Z"/>',
  circle: '<circle r="7"/>',
  triangle: '<path d="M0-7 7.5 6H-7.5Z"/>',
  diamond: '<path d="M0-9 7 0 0 9-7 0Z"/>',
};
const LOOK = {
  pink: { fill: "#ff8fb0", shape: "heart", name: "粉紅" },
  yellow: { fill: "#ffd866", shape: "star", name: "黃色" },
  blue: { fill: "#7cc3f0", shape: "circle", name: "藍色" },
  green: { fill: "#7fd6a2", shape: "triangle", name: "綠色" },
  purple: { fill: "#b79cf0", shape: "diamond", name: "紫色" },
};
// A cat filling a block of `width` × `height` pixels on cells of `c`
// pixels. Ears and tail stay inside the block, so a cat never covers its
// neighbour: a 1 × 1 cat is a round head, a lying cat (2 × 1) and a sitting
// cat (1 × 2) show their front paws and curl their tail at the back. Its
// eyes are its color's shape, and its mouth opens while it is held.
function cat(block, c, width, height, shape) {
  const r = (v) => Math.round(v * 10) / 10,
    pt = ([x, y]) => `${r(x)} ${r(y)}`,
    line = Math.max(2, c * 0.05),
    top = c * 0.17,
    head = Math.min(width, height),
    wide = width > height + 1,
    tall = height > width + 1,
    hx = wide ? head / 2 : width / 2,
    hy = top + ((tall ? head : height) - top) / 2 + c * 0.02,
    k = (c * 0.78) / 52;
  const ear = (s) => {
    const corners = [
        [hx + s * c * 0.38, top + c * 0.16],
        [hx + s * c * 0.32, line / 2 + 0.5],
        [hx + s * c * 0.07, top + c * 0.04],
      ],
      mx = corners.reduce((sum, [x]) => sum + x, 0) / 3,
      my = corners.reduce((sum, [, y]) => sum + y, 0) / 3,
      inner = corners.map(([x, y]) => [
        mx + (x - mx) * 0.5,
        my + (y - my) * 0.5 + c * 0.02,
      ]);
    return (
      `<path class="ear" d="M${corners.map(pt).join("L")}Z"/>` +
      `<path class="ear-in" d="M${inner.map(pt).join("L")}Z"/>`
    );
  };
  const tail = (d) =>
    d &&
    `<path class="tail-line" d="${d}" stroke-width="${r(c * 0.12 + line * 2)}"/>` +
      `<path class="tail" d="${d}" stroke-width="${r(c * 0.12)}"/>`;
  const paws = (x) =>
    [-1, 1]
      .map(
        (s) =>
          `<ellipse class="paw" cx="${r(x + s * c * 0.15)}" cy="${r(height - line / 2 - c * 0.05)}" rx="${r(c * 0.11)}" ry="${r(c * 0.075)}"/>`,
      )
      .join("");
  const stripes = [-1, 0, 1]
    .map(
      (s) =>
        `M${pt([hx + s * c * 0.075, top + c * 0.05])}L${pt([hx + s * c * 0.075, top + c * 0.13])}`,
    )
    .join("");
  const eye = (x) =>
    `<g transform="translate(${x} -6) scale(.8)">${SHAPES[shape]}</g>`;
  const face =
    `<g transform="translate(${r(hx)} ${r(hy)}) scale(${k.toFixed(4)})">` +
    '<ellipse class="cheek" cx="-17" cy="4" rx="4" ry="2.6"/>' +
    '<ellipse class="cheek" cx="17" cy="4" rx="4" ry="2.6"/>' +
    '<path class="whiskers" stroke-width="1.5" d="M-15 2-25 0M-15 5.5-25 6.5M15 2 25 0M15 5.5 25 6.5"/>' +
    `<g class="eyes" stroke-width="2">${eye(-11)}${eye(11)}</g>` +
    '<path class="nose" stroke-width="1" d="M-2.6 1.4H2.6L0 4Z"/>' +
    '<path class="smile" stroke-width="2.2" d="M-5.5 5Q-2.75 8.5 0 4.8 2.75 8.5 5.5 5"/>' +
    '<ellipse class="gasp" cx="0" cy="7.4" rx="2.6" ry="3"/></g>';
  // Lying cats look either way.
  const flip =
    wide && block.id.charCodeAt(0) % 2
      ? ` transform="matrix(-1 0 0 1 ${r(width)} 0)"`
      : "";
  return (
    `<svg class="blocks-cat" viewBox="0 0 ${r(width)} ${r(height)}" aria-hidden="true">` +
    `<g${flip} stroke-width="${r(line)}">` +
    ear(-1) +
    ear(1) +
    `<rect class="body" x="${r(line / 2)}" y="${r(top)}" width="${r(width - line)}" height="${r(height - top - line / 2)}" rx="${r(c * 0.26)}"/>` +
    `<path class="stripes" stroke-width="${r(c * 0.035)}" d="${stripes}"/>` +
    tail(
      wide
        ? `M${pt([width - c * 0.45, height - line - c * 0.07])}C${pt([width - line - c * 0.02, height - c * 0.04])} ${pt([width - line - c * 0.02, top + c * 0.12])} ${pt([width - c * 0.24, top + c * 0.2])}`
        : tall
          ? `M${pt([width / 2 + c * 0.12, height - line - c * 0.07])}C${pt([width - line - c * 0.02, height - c * 0.06])} ${pt([width - line - c * 0.02, height - c * 0.36])} ${pt([width - c * 0.22, height - c * 0.5])}`
          : "",
    ) +
    (wide ? paws(hx) : tall ? paws(width / 2) : "") +
    face +
    "</g></svg>"
  );
}
// A little house in the fence for the cats of one color: its roof points
// away from the mat and its open side faces the mat. It is drawn as if on
// the top edge (span × thick, outside at y = 0), then turned to its side;
// the shape on it stays upright.
const FACING = {
  top: () => "matrix(1 0 0 1 0 0)",
  bottom: (thick) => `matrix(1 0 0 -1 0 ${thick})`,
  left: () => "matrix(0 1 1 0 0 0)",
  right: (thick) => `matrix(0 1 -1 0 ${thick} 0)`,
};
function house(side, span, thick, shape) {
  const r = (v) => Math.round(v * 10) / 10,
    o = 1.5,
    eave = r(thick * 0.4),
    walls = `M${o} ${thick}L${o} ${eave}L${r(span / 2)} ${o}L${r(span - o)} ${eave}L${r(span - o)} ${thick}`,
    along = side === "top" || side === "bottom",
    mx = span / 2,
    my = thick * 0.7,
    [x, y] = {
      top: [mx, my],
      bottom: [mx, thick - my],
      left: [my, mx],
      right: [thick - my, mx],
    }[side];
  return (
    `<svg viewBox="0 0 ${along ? span : thick} ${along ? thick : span}" aria-hidden="true">` +
    `<g transform="${FACING[side](thick)}">` +
    `<path class="house" d="${walls}Z"/>` +
    `<path class="roof" d="M${o} ${eave}L${r(span / 2)} ${o}L${r(span - o)} ${eave}Z"/>` +
    `<path class="house-line" d="${walls}M${o} ${eave}H${r(span - o)}"/></g>` +
    `<g class="mark" transform="translate(${r(x)} ${r(y)}) scale(${((thick * 0.52) / 20).toFixed(3)})">${SHAPES[shape]}</g>` +
    "</svg>"
  );
}
const OUT = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] };
// The screen's markup. It is added after the home screen the first time
// the game opens, so the page itself carries no game.
const MARKUP = `
<div class="game-top">
  <button class="game-back" aria-label="返回">
    <img src="assets/ui/back.svg" alt="" />
  </button>
  <div class="game-actions">
    <button class="game-undo" aria-label="上一步">
      <img src="assets/ui/undo.svg" alt="" /></button
    ><button class="game-restart" aria-label="重來">
      <img src="assets/ui/restart.svg" alt="" /></button
    ><button class="game-levels" aria-label="選關卡">
      <img src="assets/ui/levels.svg" alt="" />
    </button>
  </div>
</div>
<h2 class="game-title">方塊出門</h2>
<p class="game-hint">把貓咪拖到同顏色的門</p>
<div class="blocks-home" aria-hidden="true"></div>
<div class="game-stage">
  <div class="blocks-board" aria-label="遊戲盤面"></div>
</div>
<button class="blocks-help" aria-label="提示">
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      class="glass"
      d="M9.2 17v-1c0-1.3-.7-2.3-1.6-3.3a5.8 5.8 0 1 1 8.8 0c-.9 1-1.6 2-1.6 3.3v1Z"
    />
    <path
      d="M9.6 19.6h4.8M10.6 22h2.8M12 13.5v-2.5M10.6 10.8l1.4 1.2 1.4-1.2"
    />
  </svg>
</button>
<div class="game-win win-overlay" hidden>
  <div class="win-card">
    <div class="win-hero" aria-hidden="true">
      <div class="win-burst"></div>
      <img
        class="win-picture"
        src="assets/ui/game-blocks.webp"
        alt=""
      />
    </div>
    <div class="win-body">
      <div class="win-stars" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path
            d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8Z"
          /></svg
        ><svg viewBox="0 0 24 24">
          <path
            d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8Z"
          /></svg
        ><svg viewBox="0 0 24 24">
          <path
            d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8Z"
          />
        </svg>
      </div>
      <div class="win-ribbon">
        <p class="win-title">過關了！</p>
      </div>
      <div class="win-friends" aria-hidden="true"></div>
      <div class="win-actions">
        <button class="game-next win-primary">
          下一關<svg
            class="win-arrow"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <button class="game-again win-secondary">
          <img src="assets/ui/restart.svg" alt="" />再玩一次
        </button>
      </div>
    </div>
  </div>
</div>
<dialog class="game-levels-dialog" aria-label="選關卡">
  <div class="dialog-head">
    <h2>選關卡</h2>
    <button class="dismiss" aria-label="關閉">✕</button>
  </div>
  <div class="blocks-modes" role="radiogroup" aria-label="關卡">
    <button role="radio" data-mode="kids">小朋友</button
    ><button role="radio" data-mode="adult">大人</button>
  </div>
  <div class="levels-grid"></div>
</dialog>
`;
const KEY = "little-playground.blocks";

export function createBlocksGame({ onBack }) {
  const root = document.createElement("section");
  root.id = "game-blocks";
  root.className = "game";
  root.setAttribute("aria-label", "方塊出門");
  root.innerHTML = MARKUP;
  document.getElementById("home").after(root);
  const $ = (selector) => root.querySelector(selector),
    board = $(".blocks-board"),
    stage = $(".game-stage"),
    home = $(".blocks-home"),
    win = $(".game-win"),
    elements = new Map(),
    // Progress keeps the children's levels at the top and the grown-ups'
    // (大人) in `adult`, with `mode` the ones being played.
    progress = loadProgress(KEY);
  let mode = progress.mode === "adult" ? "adult" : "kids";
  function track(m = mode) {
    return m === "adult"
      ? (progress.adult ??= { level: 1, unlocked: 1 })
      : progress;
  }
  let level = null,
    blocks = [],
    history = [],
    drag = null,
    cell = 0,
    thick = 0,
    guide = false,
    guideTimer = 0,
    hintTimer = 0;

  function gap() {
    return Math.max(3, Math.round(cell * 0.06));
  }
  function render() {
    for (const block of blocks) {
      let el = elements.get(block.id);
      if (!el) {
        const look = LOOK[block.color];
        el = document.createElement("div");
        el.className = "blocks-block";
        el.dataset.id = block.id;
        el.style.setProperty("--fill", look.fill);
        el.setAttribute("role", "img");
        el.setAttribute("aria-label", look.name + "貓咪");
        board.append(el);
        elements.set(block.id, el);
      }
      const width = block.w * cell - gap() * 2,
        height = block.h * cell - gap() * 2;
      el.style.width = width + "px";
      el.style.height = height + "px";
      // The cat is redrawn only when the board changes size.
      if (el.dataset.size !== `${width}x${height}`) {
        el.dataset.size = `${width}x${height}`;
        el.innerHTML = cat(block, cell, width, height, LOOK[block.color].shape);
      }
      // The block in the child's hand is lifted a little.
      el.style.transform = `translate(${block.x * cell + gap()}px, ${block.y * cell + gap()}px)${drag?.id === block.id ? " scale(1.06)" : ""}`;
    }
    for (const [id, el] of elements)
      if (!blocks.some((b) => b.id === id)) {
        el.remove();
        elements.delete(id);
      }
    for (const mini of home.children)
      mini.classList.toggle(
        "arrived",
        !blocks.some((b) => b.id === mini.dataset.id),
      );
    $(".game-undo").disabled = !history.length;
  }
  // Sizes the board to the space left on screen, with room for the fence and
  // the gates that stand out of it.
  function layout() {
    if (!level) return;
    const rect = stage.getBoundingClientRect(),
      gateFor = (size) => Math.round(Math.min(56, Math.max(30, size * 0.7))),
      fit = (room) =>
        Math.floor(
          Math.min(
            (rect.width - room * 2) / level.w,
            (rect.height - room * 2) / level.h,
            96,
          ),
        );
    // Gates grow with the cells, so fit once more with the room they need.
    const size = fit(gateFor(fit(24)) + 4);
    if (size <= 0) return;
    cell = size;
    const fence = Math.round(Math.min(24, Math.max(12, cell * 0.24)));
    thick = gateFor(cell);
    board.style.width = level.w * cell + "px";
    board.style.height = level.h * cell + "px";
    board.style.setProperty("--cell", cell + "px");
    board.style.setProperty("--fence", fence + "px");
    board.querySelectorAll(".blocks-door").forEach((door) => door.remove());
    for (const door of level.doors) {
      const el = document.createElement("div"),
        look = LOOK[door.color],
        along = door.side === "top" || door.side === "bottom";
      el.className = `blocks-door ${door.side}`;
      el.dataset.color = door.color;
      el.style.setProperty("--fill", look.fill);
      el.setAttribute("aria-label", look.name + "貓咪的家");
      // The house opens onto the mat and stands out of the fence.
      const span = door.size * cell - 8,
        start = door.at * cell + 4;
      el.innerHTML = house(door.side, span, thick, look.shape);
      Object.assign(el.style, {
        width: (along ? span : thick) + "px",
        height: (along ? thick : span) + "px",
        left:
          (along ? start : door.side === "left" ? -thick : level.w * cell) +
          "px",
        top:
          (along ? (door.side === "top" ? -thick : level.h * cell) : start) +
          "px",
      });
      board.append(el);
    }
    render();
    callHome();
    if (guide) showHand();
  }
  // While a cat is held (or shown by the hint), its own houses bounce and
  // glow and the others step back, so the child sees where it wants to go.
  function callHome(
    color = drag && blocks.find((b) => b.id === drag.id)?.color,
  ) {
    board.classList.toggle("holding", Boolean(color));
    for (const door of board.querySelectorAll(".blocks-door"))
      door.classList.toggle("calling", door.dataset.color === color);
  }
  // A cat that can go home now without moving any other.
  function nextHome() {
    return blocks.find((b) => canExit(level, blocks, b.id));
  }
  // On levels 1 and 2 a hand drags the next cat that can go home to its
  // house, over and over, until the child touches the board; it comes back
  // for the next cat. Those levels' cats go home in a straight line.
  function showHand() {
    clearTimeout(guideTimer);
    board.querySelector(".game-hand")?.remove();
    if (!guide || !blocks.length || !win.hidden) return;
    const block = nextHome(),
      door = block && level.doors.find((d) => d.color === block.color);
    if (!door) return;
    const along = door.side === "top" || door.side === "bottom",
      middle = (door.at + door.size / 2) * cell,
      edge =
        { top: -thick / 2, left: -thick / 2 }[door.side] ??
        (along ? level.h : level.w) * cell + thick / 2,
      from = [(block.x + block.w / 2) * cell, (block.y + block.h / 2) * cell],
      to = along ? [middle, edge] : [edge, middle],
      { hand, tip } = makeHand(Math.round(cell)),
      // Keyframes place the fingertip on the point.
      at = ([x, y], scale = 1) =>
        `translate(${x - tip[0]}px, ${y - tip[1]}px) scale(${scale})`;
    hand.style.transform = at(from);
    board.append(hand);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    hand.animate(
      [
        { transform: at(from), opacity: 0, offset: 0 },
        { transform: at(from), opacity: 1, offset: 0.12 },
        { transform: at(from, 0.85), opacity: 1, offset: 0.2 },
        { transform: at(to, 0.85), opacity: 1, offset: 0.62 },
        { transform: at(to), opacity: 1, offset: 0.7 },
        { transform: at(to), opacity: 0, offset: 0.82 },
        { transform: at(to), opacity: 0, offset: 1 },
      ],
      { duration: 2600, iterations: Infinity, easing: "ease-in-out" },
    );
  }
  function load(n, m = mode) {
    clearTimeout(hintTimer);
    mode = progress.mode = m;
    level = generateLevel(n, m);
    blocks = cloneBlocks(level.blocks);
    history = [];
    drag = null;
    for (const el of elements.values()) el.remove();
    elements.clear();
    track().level = n;
    track().unlocked = Math.max(track().unlocked, n);
    saveProgress(KEY, progress);
    $(".game-title").textContent =
      m === "adult" ? `大人・第 ${n} 關` : `第 ${n} 關`;
    $(".game-hint").hidden = m === "adult" || n > 3;
    win.hidden = true;
    guide = m === "kids" && n <= 2;
    // The level's cats in a row above the board; each lights up at home.
    home.replaceChildren(
      ...level.blocks.map((block) => {
        const mini = document.createElement("span");
        mini.dataset.id = block.id;
        mini.style.setProperty("--fill", LOOK[block.color].fill);
        mini.innerHTML = cat(block, 30, 26, 26, LOOK[block.color].shape);
        return mini;
      }),
    );
    layout();
  }
  function point(e) {
    const rect = board.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / cell,
      y: (e.clientY - rect.top) / cell,
    };
  }
  // The block under the finger, counting the gaps and rounded corners around
  // it, so a finger that lands between blocks still picks one up.
  function blockAt({ x, y }) {
    return blocks.find(
      (b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h,
    );
  }
  function leave(el, door) {
    const [dx, dy] = OUT[door.side],
      block = blocks.find((b) => b.id === el.dataset.id),
      distance = (dx ? block.w : block.h) + 1;
    elements.delete(block.id);
    sounds.meow();
    el.classList.remove("dragging");
    el.classList.add("leaving");
    el.style.transform = `translate(${(block.x + dx * distance) * cell + gap()}px, ${(block.y + dy * distance) * cell + gap()}px)`;
    setTimeout(() => el.remove(), 300);
    // On the first levels the hand then shows the next cat the way home.
    if (level.n <= 2) {
      guide = true;
      clearTimeout(guideTimer);
      guideTimer = setTimeout(showHand, 600);
    }
  }
  function finish(moved) {
    if (!drag) return;
    const { el, pointer, before } = drag;
    if (moved || drag.moved) history.push(before);
    drag = null;
    el.classList.remove("dragging");
    if (el.hasPointerCapture(pointer)) el.releasePointerCapture(pointer);
    render();
    callHome();
    if (!blocks.length) {
      track().unlocked = Math.max(track().unlocked, level.n + 1);
      saveProgress(KEY, progress);
      // The cleared card shows the level's cats again, all home.
      $(".win-friends").replaceChildren(
        ...[...home.children].map((mini, i) => {
          const friend = mini.cloneNode(true);
          friend.removeAttribute("class");
          friend.style.setProperty("--i", i);
          return friend;
        }),
      );
      setTimeout(() => {
        win.hidden = false;
        celebrate(win);
        $(".game-next").focus();
      }, 320);
    }
  }
  board.addEventListener("pointerdown", (e) => {
    if (drag || !win.hidden || e.button !== 0) return;
    const p = point(e),
      block = blockAt(p);
    if (!block) return;
    const el = elements.get(block.id);
    el.setPointerCapture(e.pointerId);
    guide = false;
    showHand();
    drag = {
      el,
      id: block.id,
      pointer: e.pointerId,
      grab: { x: p.x - block.x, y: p.y - block.y },
      axis: null,
      before: cloneBlocks(blocks),
      moved: false,
    };
    el.classList.add("dragging");
    render();
    callHome();
  });
  board.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    const p = point(e),
      result = dragTo(
        level,
        blocks,
        drag.id,
        p.x - drag.grab.x,
        p.y - drag.grab.y,
        drag.axis,
      );
    if (result.exit) {
      leave(drag.el, result.exit);
      blocks = result.blocks;
      finish(true);
      return;
    }
    const was = blocks.find((b) => b.id === drag.id),
      now = result.blocks.find((b) => b.id === drag.id);
    drag.axis = result.axis;
    if (was.x !== now.x || was.y !== now.y) {
      blocks = result.blocks;
      drag.moved = true;
      drag.bumped = null;
      render();
    } else bump(p.x - drag.grab.x - now.x, p.y - drag.grab.y - now.y);
  });
  // A cat pulled almost a whole cell towards a wall or another cat bumps
  // into it once, with a soft sound, so the child sees it cannot go there.
  function bump(dx, dy) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 0.9) {
      drag.bumped = null;
      return;
    }
    const [sx, sy] =
        Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)],
      way = `${sx},${sy}`;
    if (drag.bumped === way) return;
    drag.bumped = way;
    sounds.bump();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    drag.el
      .querySelector(".blocks-cat")
      .animate(
        [
          { transform: "none" },
          { transform: `translate(${sx * 6}px, ${sy * 6}px)` },
          { transform: "none" },
        ],
        { duration: 180, easing: "ease-out" },
      );
  }
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    board.addEventListener(type, (e) => {
      if (!drag || e.pointerId !== drag.pointer) return;
      // Letting go of a block in front of its own door sends it out, so a
      // child need not push it past the edge.
      const door =
        type === "pointerup" &&
        doorAt(
          level,
          blocks.find((b) => b.id === drag.id),
        );
      if (door) {
        leave(drag.el, door);
        blocks = blocks.filter((b) => b.id !== drag.id);
      }
      finish(Boolean(door));
    });
  // The hint wiggles a cat that can go home now and lights its houses. When
  // none can, the child has jammed the board, so it wiggles undo (or
  // restart) instead.
  $(".blocks-help").onclick = () => {
    if (drag || !win.hidden) return;
    const block = nextHome(),
      el = block
        ? elements.get(block.id)
        : $(history.length ? ".game-undo" : ".game-restart");
    clearTimeout(hintTimer);
    el.classList.remove("nudge");
    void el.offsetWidth;
    el.classList.add("nudge");
    callHome(block?.color);
    hintTimer = setTimeout(() => {
      el.classList.remove("nudge");
      callHome();
    }, 1600);
  };
  $(".game-back").onclick = () => onBack();
  $(".game-undo").onclick = () => {
    if (drag || !history.length) return;
    blocks = history.pop();
    render();
  };
  $(".game-restart").onclick = () => {
    if (drag) return;
    load(level.n);
  };
  $(".game-next").onclick = () => load(level.n + 1);
  $(".game-again").onclick = () => load(level.n);
  // The level picker lists the children's or the grown-ups' levels; its
  // 小朋友／大人 switch changes the list, and picking a level plays it.
  const dialog = $(".game-levels-dialog");
  function pickLevels(m) {
    for (const button of $(".blocks-modes").children)
      button.setAttribute("aria-checked", String(button.dataset.mode === m));
    showLevelPicker(dialog, {
      unlocked: track(m).unlocked,
      current: m === mode ? level.n : track(m).level,
      onPick: (n) => load(n, m),
    });
  }
  $(".game-levels").onclick = () => pickLevels(mode);
  $(".blocks-modes").onclick = (e) => {
    const button = e.target.closest("[data-mode]");
    if (button) pickLevels(button.dataset.mode);
  };
  new ResizeObserver(layout).observe(stage);
  return {
    open() {
      if (!level) load(track().level);
      else layout();
    },
    close() {
      if (drag) finish(false);
      if (dialog.open) dialog.close();
    },
  };
}
