// 方塊出門 screen: draws a level, turns finger drags into block moves and
// remembers the child's progress on this device. The rules live in blocks.js.
import { generateLevel, dragTo, cloneBlocks } from "./blocks.js?v=1.0.0-beta.1";

// Each color also carries a symbol, so colors are told apart without color.
const LOOK = {
  pink: { fill: "#ff7399", ink: "#ffffff", symbol: "♥", name: "粉紅" },
  yellow: { fill: "#ffd54f", ink: "#8a5a00", symbol: "★", name: "黃色" },
  blue: { fill: "#5aa9e6", ink: "#ffffff", symbol: "●", name: "藍色" },
  green: { fill: "#5cc28f", ink: "#ffffff", symbol: "▲", name: "綠色" },
  purple: { fill: "#a07ad6", ink: "#ffffff", symbol: "◆", name: "紫色" },
};
const ARROWS = { top: "▲", bottom: "▼", left: "◀", right: "▶" };
const OUT = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] };
const KEY = "little-playground.blocks";

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (Number.isInteger(saved?.level) && Number.isInteger(saved?.unlocked))
      return saved;
  } catch {
    // Private mode or blocked storage: start from the first level.
  }
  return { level: 1, unlocked: 1 };
}
function saveProgress(progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Progress is a convenience; the game works without it.
  }
}

export function createBlocksGame(root, { onBack }) {
  const $ = (selector) => root.querySelector(selector),
    board = $(".blocks-board"),
    stage = $(".game-stage"),
    win = $(".game-win"),
    elements = new Map(),
    progress = loadProgress();
  let level = null,
    blocks = [],
    history = [],
    drag = null,
    cell = 0;

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
        el.style.background = look.fill;
        el.style.color = look.ink;
        el.textContent = look.symbol;
        el.setAttribute("role", "img");
        el.setAttribute("aria-label", look.name + "方塊");
        board.append(el);
        elements.set(block.id, el);
      }
      el.style.width = block.w * cell - gap() * 2 + "px";
      el.style.height = block.h * cell - gap() * 2 + "px";
      el.style.fontSize = Math.round(cell * 0.36) + "px";
      el.style.transform = `translate(${block.x * cell + gap()}px, ${block.y * cell + gap()}px)`;
    }
    for (const [id, el] of elements)
      if (!blocks.some((b) => b.id === id)) {
        el.remove();
        elements.delete(id);
      }
    $(".game-undo").disabled = !history.length;
  }
  // Sizes the board to the space left on screen, with room for the doors.
  function layout() {
    if (!level) return;
    const rect = stage.getBoundingClientRect(),
      room = 26;
    const size = Math.floor(
      Math.min(
        (rect.width - room * 2) / level.w,
        (rect.height - room * 2) / level.h,
        96,
      ),
    );
    if (size <= 0) return;
    cell = size;
    board.style.width = level.w * cell + "px";
    board.style.height = level.h * cell + "px";
    board.style.backgroundImage =
      "linear-gradient(#eef3f6 2px, transparent 2px), linear-gradient(90deg, #eef3f6 2px, transparent 2px)";
    board.style.backgroundSize = `${cell}px ${cell}px`;
    board.style.backgroundPosition = "-1px -1px";
    board.querySelectorAll(".blocks-door").forEach((door) => door.remove());
    const thick = Math.max(12, Math.round(cell * 0.24)),
      offset = thick + 6;
    for (const door of level.doors) {
      const el = document.createElement("div"),
        along = door.side === "top" || door.side === "bottom";
      el.className = "blocks-door";
      el.style.background = LOOK[door.color].fill;
      el.style.color = LOOK[door.color].ink;
      el.style.fontSize = Math.round(thick * 0.75) + "px";
      el.textContent = ARROWS[door.side];
      el.setAttribute("aria-label", LOOK[door.color].name + "的門");
      const span = door.size * cell - 8,
        start = door.at * cell + 4;
      Object.assign(el.style, {
        width: (along ? span : thick) + "px",
        height: (along ? thick : span) + "px",
        left:
          (along
            ? start
            : door.side === "left"
              ? -offset
              : level.w * cell + 6) + "px",
        top:
          (along
            ? door.side === "top"
              ? -offset
              : level.h * cell + 6
            : start) + "px",
      });
      board.append(el);
    }
    render();
  }
  function load(n) {
    level = generateLevel(n);
    blocks = cloneBlocks(level.blocks);
    history = [];
    drag = null;
    for (const el of elements.values()) el.remove();
    elements.clear();
    progress.level = n;
    progress.unlocked = Math.max(progress.unlocked, n);
    saveProgress(progress);
    $(".game-title").textContent = `第 ${n} 關`;
    $(".game-hint").hidden = n > 3;
    win.hidden = true;
    layout();
  }
  function point(e) {
    const rect = board.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / cell,
      y: (e.clientY - rect.top) / cell,
    };
  }
  function leave(el, door) {
    const [dx, dy] = OUT[door.side],
      block = blocks.find((b) => b.id === el.dataset.id),
      distance = (dx ? block.w : block.h) + 1;
    elements.delete(block.id);
    el.classList.remove("dragging");
    el.classList.add("leaving");
    el.style.transform = `translate(${(block.x + dx * distance) * cell + gap()}px, ${(block.y + dy * distance) * cell + gap()}px)`;
    setTimeout(() => el.remove(), 300);
  }
  function finish(moved) {
    if (!drag) return;
    const { el, pointer, before } = drag;
    if (moved || drag.moved) history.push(before);
    drag = null;
    el.classList.remove("dragging");
    if (el.hasPointerCapture(pointer)) el.releasePointerCapture(pointer);
    render();
    if (!blocks.length) {
      progress.unlocked = Math.max(progress.unlocked, level.n + 1);
      saveProgress(progress);
      setTimeout(() => {
        win.hidden = false;
        $(".game-next").focus();
      }, 320);
    }
  }
  board.addEventListener("pointerdown", (e) => {
    const el = e.target.closest(".blocks-block");
    if (!el || drag || !win.hidden || e.button !== 0) return;
    const block = blocks.find((b) => b.id === el.dataset.id);
    if (!block) return;
    el.setPointerCapture(e.pointerId);
    const p = point(e);
    drag = {
      el,
      id: block.id,
      pointer: e.pointerId,
      grab: { x: p.x - block.x, y: p.y - block.y },
      before: cloneBlocks(blocks),
      moved: false,
    };
    el.classList.add("dragging");
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
      );
    if (result.exit) {
      leave(drag.el, result.exit);
      blocks = result.blocks;
      finish(true);
      return;
    }
    const was = blocks.find((b) => b.id === drag.id),
      now = result.blocks.find((b) => b.id === drag.id);
    if (was.x !== now.x || was.y !== now.y) {
      blocks = result.blocks;
      drag.moved = true;
      render();
    }
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    board.addEventListener(type, (e) => {
      if (drag && e.pointerId === drag.pointer) finish(false);
    });
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
  const dialog = $(".game-levels-dialog");
  $(".game-levels").onclick = () => {
    const grid = dialog.querySelector(".levels-grid");
    grid.replaceChildren();
    for (let n = 1; n <= progress.unlocked; n++) {
      const button = document.createElement("button");
      button.textContent = n;
      button.setAttribute("aria-label", `第 ${n} 關`);
      button.classList.toggle("current", n === level.n);
      button.onclick = () => {
        dialog.close();
        load(n);
      };
      grid.append(button);
    }
    dialog.showModal();
  };
  new ResizeObserver(layout).observe(stage);
  return {
    open() {
      if (!level) load(progress.level);
      else layout();
    },
    close() {
      if (drag) finish(false);
      if (dialog.open) dialog.close();
    },
  };
}
