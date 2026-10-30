// Parts every game screen shares: progress remembered on this device, the
// level picker dialog, the cheer for a cleared level and the hand that shows
// what to do.
import { sounds } from "./sound.js?v=1.0.0-beta.12";

// Progress is a convenience: private mode or blocked storage starts from the
// first level, and the game works without saving.
export function loadProgress(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (Number.isInteger(saved?.level) && Number.isInteger(saved?.unlocked))
      return saved;
  } catch {
    // Start from the first level.
  }
  return { level: 1, unlocked: 1 };
}
export function saveProgress(key, progress) {
  try {
    localStorage.setItem(key, JSON.stringify(progress));
  } catch {
    // Keep playing without saving.
  }
}

// A cleared level plays a little tune, and confetti falls unless the device
// asks for less motion. Each piece removes itself when it lands.
const CONFETTI = [
  "#ff7399",
  "#ffd54f",
  "#74b9ed",
  "#7ccca0",
  "#ac8bd8",
  "#ffae62",
];
export function celebrate(win) {
  // A level finished while its screen is hidden stays quiet.
  if (win.checkVisibility ? win.checkVisibility() : win.offsetParent)
    sounds.cheer();
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (let i = 0; i < 32; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti";
    piece.style.left = Math.random() * 100 + "%";
    piece.style.background = CONFETTI[i % CONFETTI.length];
    piece.style.setProperty("--drift", Math.random() * 80 - 40 + "px");
    piece.style.setProperty("--spin", Math.random() * 900 - 450 + "deg");
    piece.style.animationDelay = Math.random() * 500 + "ms";
    piece.addEventListener("animationend", () => piece.remove());
    win.append(piece);
  }
}

// A white hand `size` pixels wide that shows a small child what to do.
// Its transform origin is the fingertip, at `tip` inside the hand.
const HAND =
  '<svg viewBox="-2 -2 44 52" aria-hidden="true"><path d="M11 28V7a4 4 0 0 1 8 0V20a3.2 3.2 0 0 1 6.4 0V22a3.2 3.2 0 0 1 6.4 0V24a3 3 0 0 1 6 0V33c0 8-5 13-13 13h-3c-6 0-9-3-12-8l-5-8a3 3 0 0 1 4.6-3.8L11 29Z"/><path d="M19 20v5M25.4 22v4M31.8 24v4" fill="none"/></svg>';
export function makeHand(size) {
  const hand = document.createElement("div"),
    height = Math.round(size * 1.18),
    tip = [(17 / 44) * size, (8 / 52) * height];
  hand.className = "game-hand";
  hand.innerHTML = HAND;
  hand.style.width = size + "px";
  hand.style.height = height + "px";
  hand.style.transformOrigin = `${tip[0]}px ${tip[1]}px`;
  return { hand, tip };
}

// Lists levels 1..unlocked, twenty to a page, starting on the current
// level's page; the current one is highlighted and a button above jumps to
// the newest level. Clearing a level unlocks the next, so every level
// before `unlocked` has been cleared. Calling it again while the dialog is
// open shows another list (方塊出門's 小朋友／大人 switch).
const PAGE = 20;
export function showLevelPicker(dialog, { unlocked, current, onPick }) {
  const grid = dialog.querySelector(".levels-grid");
  let latest = dialog.querySelector(".levels-latest"),
    pages = dialog.querySelector(".levels-pages");
  if (!latest) {
    latest = document.createElement("button");
    latest.className = "levels-latest";
    grid.before(latest);
    pages = document.createElement("div");
    pages.className = "levels-pages";
    pages.innerHTML =
      '<button class="levels-prev" aria-label="上一頁">‹</button><span></span><button class="levels-next" aria-label="下一頁">›</button>';
    grid.after(pages);
  }
  const pick = (n) => {
    dialog.close();
    onPick(n);
  };
  latest.textContent = `繼續第 ${unlocked} 關`;
  latest.hidden = current === unlocked;
  latest.onclick = () => pick(unlocked);
  const last = Math.ceil(unlocked / PAGE);
  let page = Math.floor(((current || unlocked) - 1) / PAGE);
  function render() {
    const from = page * PAGE + 1,
      to = Math.min(unlocked, from + PAGE - 1);
    grid.replaceChildren();
    for (let n = from; n <= to; n++) {
      const button = document.createElement("button");
      button.textContent = n;
      button.setAttribute(
        "aria-label",
        `第 ${n} 關${n < unlocked ? "，已過關" : ""}`,
      );
      button.classList.toggle("current", n === current);
      button.classList.toggle("cleared", n < unlocked);
      button.onclick = () => pick(n);
      grid.append(button);
    }
    pages.hidden = last <= 1;
    pages.querySelector("span").textContent = `${from}–${to}`;
    pages.querySelector(".levels-prev").disabled = page === 0;
    pages.querySelector(".levels-next").disabled = page === last - 1;
  }
  pages.querySelector(".levels-prev").onclick = () => {
    page--;
    render();
  };
  pages.querySelector(".levels-next").onclick = () => {
    page++;
    render();
  };
  render();
  if (!dialog.open) dialog.showModal();
}
