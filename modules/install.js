// Parents install the studio from the about dialog. Chrome's own install
// banner is suppressed, so a child cannot trigger it while drawing.
const $ = (id) => document.getElementById(id);
export function runningInstalled() {
  return ["standalone", "fullscreen", "minimal-ui"].some(
    (mode) => matchMedia(`(display-mode: ${mode})`).matches,
  );
}
export function installAppSupport() {
  let prompt = null,
    installed = false;
  function update() {
    $("install-controls").hidden = runningInstalled();
    $("install-app").hidden = !prompt;
    $("install-status").textContent = installed
      ? "已安裝，請從主畫面開啟小小畫家。"
      : prompt
        ? "安裝後從主畫面開啟，全螢幕使用，也能離線畫畫。"
        : "請在 Chrome 右上角選單（⋮）選擇「安裝應用程式」或「加到主畫面」。";
  }
  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    prompt = e;
    update();
  });
  addEventListener("appinstalled", () => {
    prompt = null;
    installed = true;
    update();
  });
  $("install-app").onclick = async () => {
    const event = prompt;
    if (!event) return;
    // A prompt can be shown once; Chrome fires a new event if it may ask again.
    prompt = null;
    await event.prompt();
    await event.userChoice.catch(() => null);
    update();
  };
  update();
}
