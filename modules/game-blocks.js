// 方塊出門 screen: draws a level, turns finger drags into block moves and
// remembers the child's progress on this device. The rules live in blocks.js.
import {
  generateLevel,
  dragTo,
  doorAt,
  canExit,
  cloneBlocks,
} from "./blocks.js?v=1.0.0-beta.10";
import {
  loadProgress,
  saveProgress,
  showLevelPicker,
  celebrate,
  makeHand,
} from "./game-kit.js?v=1.0.0-beta.10";
import { sounds } from "./sound.js?v=1.0.0-beta.10";

// Cats and their doors are told apart by color alone. The fills match the
// cats in the pictures.
const LOOK = {
  pink: { fill: "#fc9cb9", name: "粉紅" },
  yellow: { fill: "#f9d87c", name: "黃色" },
  blue: { fill: "#91c5e6", name: "藍色" },
  green: { fill: "#9cddc1", name: "綠色" },
  purple: { fill: "#bca2e4", name: "紫色" },
};
// A block's cat picture: a round cat for one cell, a lying cat for two side
// by side (looking either way) and a sitting cat for two one above the
// other.
function catPicture(block) {
  const pose =
      block.w > block.h ? "lying" : block.h > block.w ? "sitting" : "head",
    flip = pose === "lying" && block.id.charCodeAt(0) % 2 ? " flip" : "";
  return `<img class="blocks-cat${flip}" src="assets/games/blocks/cat-${block.color}-${pose}.webp" alt="" draggable="false" />`;
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
    fence = 0,
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
        el.innerHTML = catPicture(block);
        board.append(el);
        elements.set(block.id, el);
      }
      const width = block.w * cell - gap() * 2,
        height = block.h * cell - gap() * 2;
      el.style.width = width + "px";
      el.style.height = height + "px";
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
  // Sizes the board to the space left on screen, with room for the fence
  // round it. The fence picture's wood is 89 of its 1600 pixels on each
  // side, so the fence is 89/1422 of the board wide. The doors lie on the
  // fence, in the middle of their span.
  function layout() {
    if (!level) return;
    const rect = stage.getBoundingClientRect(),
      fenceFor = (size) => (size * level.w * 89) / 1422,
      fit = (room) =>
        Math.floor(
          Math.min(
            (rect.width - room * 2) / level.w,
            (rect.height - room * 2) / level.h,
            96,
          ),
        );
    // The fence grows with the cells, so fit once more with the room it needs.
    const size = fit(fenceFor(fit(20)) + 4);
    if (size <= 0) return;
    cell = size;
    fence = fenceFor(cell);
    board.style.width = level.w * cell + "px";
    board.style.height = level.h * cell + "px";
    board.style.setProperty("--cell", cell + "px");
    board.style.setProperty("--fence", fence + "px");
    board.querySelectorAll(".blocks-door").forEach((door) => door.remove());
    const thick = Math.round(Math.max(14, fence * 0.85));
    for (const door of level.doors) {
      const el = document.createElement("div"),
        look = LOOK[door.color],
        along = door.side === "top" || door.side === "bottom",
        length = Math.round(door.size * cell - cell * 0.2),
        start = door.at * cell + (door.size * cell - length) / 2,
        across =
          (door.side === "top" || door.side === "left"
            ? -fence / 2
            : (along ? level.h : level.w) * cell + fence / 2) -
          thick / 2;
      el.className = `blocks-door ${door.side}`;
      el.dataset.color = door.color;
      el.style.setProperty("--fill", look.fill);
      el.setAttribute("aria-label", look.name + "貓咪的家");
      Object.assign(el.style, {
        width: (along ? length : thick) + "px",
        height: (along ? thick : length) + "px",
        left: (along ? start : across) + "px",
        top: (along ? across : start) + "px",
      });
      board.append(el);
    }
    render();
    callHome();
    if (guide) showHand();
  }
  // While a cat is held (or shown by the hint), its own doors bounce and
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
  // door, over and over, until the child touches the board; it comes back
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
        { top: -fence / 2, left: -fence / 2 }[door.side] ??
        (along ? level.h : level.w) * cell + fence / 2,
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
        mini.innerHTML = catPicture({ ...block, w: 1, h: 1 });
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
  // The cat goes out through its door from `from`, where it stood at the
  // door; a drag can carry it there and out at once, before it was drawn
  // there, so it is put there first.
  function leave(el, door, from) {
    const [dx, dy] = OUT[door.side],
      block = { ...blocks.find((b) => b.id === el.dataset.id), ...from },
      distance = (dx ? block.w : block.h) + 1;
    elements.delete(block.id);
    sounds.meow();
    el.classList.remove("dragging");
    el.style.transition = "none";
    el.style.transform = `translate(${block.x * cell + gap()}px, ${block.y * cell + gap()}px)`;
    void el.offsetWidth;
    el.style.transition = "";
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
      leave(drag.el, result.exit, result.from);
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
  // The hint wiggles a cat that can go home now and lights its doors. When
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
