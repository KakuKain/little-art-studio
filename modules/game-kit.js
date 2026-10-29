// Parts every game screen shares: progress remembered on this device, the
// level picker dialog and the cheer for a cleared level.
import { sounds } from "./sound.js?v=1.0.0-beta.6";

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
  if (win.offsetParent) sounds.cheer();
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

// Lists levels 1..unlocked; the current one is highlighted. Clearing a level
// unlocks the next, so every level before `unlocked` has been cleared.
export function showLevelPicker(dialog, { unlocked, current, onPick }) {
  const grid = dialog.querySelector(".levels-grid");
  grid.replaceChildren();
  for (let n = 1; n <= unlocked; n++) {
    const button = document.createElement("button");
    button.textContent = n;
    button.setAttribute(
      "aria-label",
      `第 ${n} 關${n < unlocked ? "，已過關" : ""}`,
    );
    button.classList.toggle("current", n === current);
    button.classList.toggle("cleared", n < unlocked);
    button.onclick = () => {
      dialog.close();
      onPick(n);
    };
    grid.append(button);
  }
  dialog.showModal();
}
