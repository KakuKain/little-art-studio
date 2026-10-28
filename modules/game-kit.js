// Parts every game screen shares: progress remembered on this device and the
// level picker dialog.

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

// Lists levels 1..unlocked; the current one is highlighted.
export function showLevelPicker(dialog, { unlocked, current, onPick }) {
  const grid = dialog.querySelector(".levels-grid");
  grid.replaceChildren();
  for (let n = 1; n <= unlocked; n++) {
    const button = document.createElement("button");
    button.textContent = n;
    button.setAttribute("aria-label", `第 ${n} 關`);
    button.classList.toggle("current", n === current);
    button.onclick = () => {
      dialog.close();
      onPick(n);
    };
    grid.append(button);
  }
  dialog.showModal();
}
