import { PALETTE, QUICK_COLORS } from "./palette.js?v=1.0.0-beta.11";
const $ = (id) => document.getElementById(id);
let noticeTimer;
export function setStatus(message, { notify = false } = {}) {
  $("hint").textContent = message;
  if (!notify) return;
  $("notice").textContent = message;
  $("notice").hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(
    () => ($("notice").hidden = true),
    Math.max(4500, message.length * 180),
  );
}
// Parents' actions happen only after the element is held for two seconds,
// while it wears the class "holding"; the click that ends the hold does
// nothing else.
export function onHold(el, act) {
  let timer = 0,
    held = false;
  const stop = () => {
    clearTimeout(timer);
    el.classList.remove("holding");
  };
  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    held = false;
    el.classList.add("holding");
    timer = setTimeout(() => {
      stop();
      held = true;
      act();
    }, 2000);
  });
  for (const type of ["pointerup", "pointerleave", "pointercancel"])
    el.addEventListener(type, stop);
  el.addEventListener(
    "click",
    (e) => {
      if (!held) return;
      held = false;
      e.preventDefault();
      e.stopImmediatePropagation();
    },
    true,
  );
}
// Parents' settings open only after a two-second hold, so a child's tap
// does nothing but say so. A keyboard press (a click without a pointer)
// opens them at once.
export function holdToOpen(button, open) {
  onHold(button, open);
  button.addEventListener("click", (e) => {
    if (e.detail === 0) open();
    else setStatus("請家長按住 2 秒", { notify: true });
  });
}
// Three sizes, 細／中／粗, instead of a slider small hands cannot hold.
export function syncSizes(tool, size) {
  $("size").setAttribute(
    "aria-label",
    tool === "eraser" ? "橡皮擦粗細" : "鉛筆粗細",
  );
  for (const button of $("size").children) {
    button.disabled = tool === "fill";
    button.setAttribute("aria-checked", String(+button.dataset.size === size));
  }
}
export function installUI({ toolSizes, getTool, chooseColor, setTool }) {
  for (const { color: c, name } of PALETTE) {
    const b = document.createElement("button");
    b.dataset.color = c;
    b.style.background = c;
    b.setAttribute("aria-label", name);
    b.onclick = () => chooseColor(c);
    $("palette").append(b);
  }
  $("palette").firstChild.classList.add("active");
  // A long press on a picture or button must not open the browser's menu.
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  $("color-open").onclick = () => $("color-modal").showModal();
  // Dialogs close from their ✕ button or a tap outside them. Listening on
  // the document also covers the dialogs a game adds when it first opens.
  document.addEventListener("click", (e) => {
    const dismiss = e.target.closest(".dismiss");
    if (dismiss) {
      dismiss.closest("dialog").close();
      return;
    }
    const d = e.target;
    if (!(d instanceof HTMLDialogElement)) return;
    const r = d.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      d.close();
  });
  function mixedColor() {
    return `hsl(${$("hue").value} ${$("saturation").value}% ${$("lightness").value}%)`;
  }
  ["hue", "saturation", "lightness"].forEach(
    (id) =>
      ($(id).oninput = () => {
        $("mix-preview").style.background = mixedColor();
      }),
  );
  $("mix-preview").style.background = mixedColor();
  $("use-color").onclick = () => chooseColor(mixedColor());
  function positionTools() {
    const menu = $("tool-modal"),
      r = $("more").getBoundingClientRect();
    menu.style.left =
      Math.max(
        8,
        Math.min(innerWidth - menu.offsetWidth - 8, r.right - menu.offsetWidth),
      ) + "px";
    menu.style.top =
      Math.max(
        8,
        Math.min(
          innerHeight - menu.offsetHeight - 8,
          r.top - menu.offsetHeight - 8,
        ),
      ) + "px";
  }
  $("more").onclick = () => {
    const menu = $("tool-modal");
    if (menu.matches(":popover-open")) menu.hidePopover();
    else {
      menu.showPopover();
      positionTools();
    }
  };
  $("tool-modal").addEventListener("toggle", (e) => {
    $("more").setAttribute("aria-expanded", String(e.newState === "open"));
  });
  $("tool-modal").addEventListener("keydown", (e) => {
    const items = [...$("tool-modal").querySelectorAll("button")],
      index = items.indexOf(document.activeElement);
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      items[
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? items.length - 1
            : (index + (e.key === "ArrowDown" ? 1 : items.length - 1)) %
              items.length
      ].focus();
    }
  });
  window.addEventListener("resize", () => {
    if ($("tool-modal").matches(":popover-open")) positionTools();
  });
  holdToOpen($("about-open"), () => {
    $("tool-modal").hidePopover();
    $("about-modal").showModal();
  });
  for (const { color: c, name } of QUICK_COLORS) {
    const b = document.createElement("button");
    b.dataset.color = c;
    b.style.setProperty("--swatch", c);
    b.setAttribute("aria-label", "使用" + name);
    b.onclick = () => chooseColor(c);
    $("quick-colors").append(b);
  }
  const custom = document.createElement("button");
  custom.id = "rainbow-quick";
  custom.className = "custom-color";
  custom.setAttribute("aria-label", "彩虹筆");
  custom.setAttribute("aria-pressed", "false");
  custom.innerHTML = '<span class="rainbow-swatch"></span>';
  custom.onclick = () => setTool("rainbow");
  $("quick-colors").append(custom);
  $("fullscreen").onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen)
        await document.documentElement.requestFullscreen();
      else setStatus("這台手機請加入主畫面使用全螢幕", { notify: true });
    } catch {
      setStatus("此瀏覽器暫時無法進入全螢幕", { notify: true });
    }
  };
  document.querySelectorAll("[data-action]").forEach(
    (b) =>
      (b.onclick = () => {
        const action = b.dataset.action;
        $("tool-modal").hidePopover();
        $(action).click();
      }),
  );

  $("fill").onclick = () => setTool("fill");
  $("eraser").onclick = () => setTool("eraser");
  $("pen").onclick = () => setTool("pen");
  const sizeKey = () => (getTool() === "eraser" ? "eraser" : "pen");
  syncSizes(getTool(), toolSizes[sizeKey()]);
  $("size").onclick = (e) => {
    const button = e.target.closest("[data-size]");
    if (!button) return;
    toolSizes[sizeKey()] = +button.dataset.size;
    syncSizes(getTool(), toolSizes[sizeKey()]);
  };
  $("rainbow").onclick = () => {
    setTool("rainbow");
    $("color-modal").close();
  };
}
