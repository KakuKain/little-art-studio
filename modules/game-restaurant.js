// 動物餐廳 screen: customers at the counter on top, their plates and the
// 電鍋 in the middle, the ingredients below. A tapped ingredient flies where
// restaurant.js says it is needed, and the screen then plays what follows
// (cooking, eating, the next customer) one step after another. The
// pictures are made by scripts/build-game-art.cjs.
import {
  INGREDIENTS,
  DISHES,
  ANIMALS,
  COOKER,
  generateLevel,
  start,
  tap,
  destination,
  describeOrder,
  partName,
} from "./restaurant.js?v=1.0.0-beta.15";
import {
  loadProgress,
  saveProgress,
  showLevelPicker,
  celebrate,
  makeHand,
} from "./game-kit.js?v=1.0.0-beta.15";
import { sounds } from "./sound.js?v=1.0.0-beta.15";

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
<h2 class="game-title">動物餐廳</h2>
<div class="restaurant-stage">
  <div class="restaurant-guests"></div>
  <div class="restaurant-counter"></div>
  <div class="restaurant-kitchen"></div>
  <div class="restaurant-pantry" aria-label="食材"></div>
</div>
<p class="restaurant-said sr-only" role="status"></p>
<div class="game-win win-overlay" hidden>
  <div class="win-card">
    <div class="win-hero" aria-hidden="true">
      <div class="win-burst"></div>
      <img
        class="win-picture"
        src="assets/ui/game-restaurant.webp"
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
        <p class="win-title">客人都吃飽了！</p>
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
  <div class="game-modes" role="radiogroup" aria-label="關卡">
    <button role="radio" data-mode="kids">小朋友</button
    ><button role="radio" data-mode="adult">大人</button>
  </div>
  <p class="restaurant-endless" hidden>客人一直來，越做越難；下次回來接著做。</p>
  <div class="levels-grid"></div>
</dialog>
`;
const KEY = "little-playground.restaurant";
const ART = "assets/games/restaurant/";
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
// Thrown to stop the steps of a day that is no longer shown.
const STALE = Symbol("stale");
// Milliseconds for an ingredient to fly, for the 電鍋 to cook, for a
// finished dish to show on its plate, for the customer to enjoy it and to
// walk away or in. Without motion, only the pauses to look remain.
const FLIGHT = 300,
  COOK = 900,
  READY = 400,
  THANKS = 1000,
  WALK = 300;
// The most ingredients a stack shows: a children's stack is never taller.
const SHOWN = 7;

function animate(el, keyframes, options) {
  return reducedMotion.matches ? null : el.animate(keyframes, options);
}
// The drawn picture of an animal, a food or the 電鍋. Its container is
// labeled, so the picture itself stays silent.
function picture(kind, id) {
  const img = new Image();
  img.className = "restaurant-picture";
  img.src = `${ART}${kind}-${id}.webp`;
  img.alt = "";
  img.draggable = false;
  return img;
}
// A place for one part on a plate or in the 電鍋: the part's picture, faint
// until it is there.
function slot(part, filled) {
  const el = document.createElement("span");
  el.className = "restaurant-slot";
  el.classList.toggle("filled", filled);
  el.dataset.part = part;
  el.append(picture("food", part));
  return el;
}

export function createRestaurantGame({ onBack }) {
  const root = document.createElement("section");
  root.id = "game-restaurant";
  root.className = "game";
  root.setAttribute("aria-label", "動物餐廳");
  root.innerHTML = MARKUP;
  document.getElementById("home").after(root);
  const $ = (selector) => root.querySelector(selector),
    stage = $(".restaurant-stage"),
    guests = $(".restaurant-guests"),
    kitchen = $(".restaurant-kitchen"),
    pantry = $(".restaurant-pantry"),
    said = $(".restaurant-said"),
    win = $(".game-win"),
    dialog = $(".game-levels-dialog"),
    // Progress keeps the children's days at the top and the grown-ups'
    // (大人) in `adult`, with `mode` the ones being played. The grown-ups
    // play one day after another without levels: `adult.level` is the day
    // they are on, and each day is a little harder.
    progress = loadProgress(KEY);
  let mode = progress.mode === "adult" ? "adult" : "kids";
  function track(m = mode) {
    return m === "adult"
      ? (progress.adult ??= { level: 1, unlocked: 1 })
      : progress;
  }
  let level = null,
    state = null,
    // Taps can be taken back.
    history = [],
    // While the screen plays cooking, eating or a new customer, taps wait.
    busy = false,
    // Loading a day bumps this, so steps still playing from the last one
    // stop.
    epoch = 0,
    // Levels 1 and 2 show a hand until the child taps an ingredient.
    guide = false,
    guideTimer = 0,
    // The tray as shown, which lags the state while ingredients fly.
    shownTray = [];

  function pause(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  const seatEl = (i) => guests.children[i],
    plateEl = (i) =>
      kitchen.querySelector(`.restaurant-plate[data-seat="${i}"]`),
    cookerEl = () => kitchen.querySelector(".restaurant-cooker");
  const wantsRice = (seat) =>
    seat &&
    DISHES[level.customers[seat.customer].dish].parts.includes(COOKER.makes) &&
    !seat.plate.includes(COOKER.makes);

  // The day's places: a seat and a plate per customer at the counter, the
  // 電鍋 when the menu has 白飯, and the tray and stacks below.
  function build() {
    stage.style.setProperty("--cols", level.seats + (level.cooker ? 1 : 0));
    stage.classList.toggle("with-cooker", level.cooker);
    guests.replaceChildren();
    kitchen.replaceChildren();
    for (let i = 0; i < level.seats; i++) {
      const seat = document.createElement("div"),
        bubble = document.createElement("div"),
        animal = document.createElement("div"),
        plate = document.createElement("div");
      seat.className = "restaurant-seat";
      bubble.className = "restaurant-bubble";
      bubble.setAttribute("aria-hidden", "true");
      animal.className = "restaurant-animal";
      animal.setAttribute("role", "img");
      seat.append(bubble, animal);
      plate.className = "restaurant-plate";
      plate.dataset.seat = i;
      // The counter covers these rows too, so each seat and plate names its
      // column.
      seat.style.gridColumn = plate.style.gridColumn = i + 1;
      guests.append(seat);
      kitchen.append(plate);
    }
    if (level.cooker) {
      const cooker = document.createElement("div"),
        parts = document.createElement("div");
      cooker.className = "restaurant-cooker";
      cooker.setAttribute("role", "img");
      cooker.setAttribute("aria-label", "電鍋");
      parts.className = "restaurant-cooker-parts";
      cooker.append(parts, picture("tool", "cooker"));
      kitchen.append(cooker);
    }
    const tray = document.createElement("div"),
      stacks = document.createElement("div");
    tray.className = "restaurant-tray";
    tray.setAttribute("aria-label", "托盤");
    stacks.className = "restaurant-stacks";
    pantry.replaceChildren(tray, stacks);
  }

  // Shows the state as it is, without animation.
  function render() {
    state.seats.forEach((seat, i) => showSeat(i, seat));
    showCooker();
    shownTray = [...state.tray];
    showTray();
    showStacks();
    $(".game-undo").disabled = busy || !history.length;
  }
  function showSeat(i, seat) {
    const box = seatEl(i),
      animal = box.querySelector(".restaurant-animal"),
      bubble = box.querySelector(".restaurant-bubble"),
      plate = plateEl(i);
    box.classList.toggle("empty", !seat);
    plate.classList.toggle("empty", !seat);
    plate.classList.remove("ready");
    if (!seat) {
      animal.replaceChildren();
      bubble.replaceChildren();
      plate.replaceChildren();
      animal.removeAttribute("aria-label");
      return;
    }
    const customer = level.customers[seat.customer],
      have = [...seat.plate];
    animal.replaceChildren(picture("animal", customer.animal));
    animal.setAttribute("aria-label", describeOrder(customer));
    bubble.replaceChildren(picture("food", customer.dish));
    // Each part the dish takes, faint until it is on the plate.
    plate.replaceChildren(
      ...DISHES[customer.dish].parts.map((part) => {
        const at = have.indexOf(part);
        if (at >= 0) have.splice(at, 1);
        return slot(part, at >= 0);
      }),
    );
    plate.setAttribute(
      "aria-label",
      `${DISHES[customer.dish].name}：${DISHES[customer.dish].parts.map(partName).join("、")}`,
    );
  }
  // The 電鍋 shows what it takes while someone waits for 白飯.
  function showCooker() {
    const cooker = cookerEl();
    if (!cooker) return;
    const wanted = state.cooker.length > 0 || state.seats.some(wantsRice);
    cooker.classList.toggle("wanted", wanted);
    cooker
      .querySelector(".restaurant-cooker-parts")
      .replaceChildren(
        ...COOKER.parts.map((part) => slot(part, state.cooker.includes(part))),
      );
  }
  function showTray() {
    const tray = pantry.querySelector(".restaurant-tray");
    tray.replaceChildren();
    for (let i = 0; i < level.tray; i++) {
      const place = document.createElement("span");
      place.className = "restaurant-tray-place";
      if (shownTray[i]) place.append(picture("food", shownTray[i]));
      tray.append(place);
    }
  }
  // Each stack is a column, its top first; only the top can be taken,
  // but the ingredients under it show, so the player can plan. A
  // children's stack shows whole; a grown-ups' runs on for days, so its top
  // SHOWN show and the next comes up from below as one is taken.
  function showStacks() {
    pantry.querySelector(".restaurant-stacks").replaceChildren(
      ...state.stacks.map((stack, i) => {
        const button = document.createElement("button");
        button.className = "restaurant-stack";
        button.dataset.stack = i;
        fillStack(button, stack);
        return button;
      }),
    );
  }
  function fillStack(button, stack) {
    button.disabled = !stack.length;
    button.setAttribute(
      "aria-label",
      stack.length ? INGREDIENTS[stack.at(-1)].name : "空的",
    );
    button.replaceChildren(
      ...stack
        .slice(-SHOWN)
        .reverse()
        .map((item, i) => {
          const tile = document.createElement("span");
          tile.className = "restaurant-tile";
          tile.style.zIndex = SHOWN - i;
          tile.append(picture("food", item));
          return tile;
        }),
    );
  }

  // On levels 1 and 2 a hand taps the top that is needed next (or, when
  // none is, the first top, which goes to the tray), over and over, until
  // the child taps one; it comes back for the next customer.
  function showHand() {
    clearTimeout(guideTimer);
    pantry.querySelector(".game-hand")?.remove();
    if (!guide || busy || !win.hidden) return;
    let index = state.stacks.findIndex(
      (stack) => stack.length && destination(level, state, stack.at(-1)),
    );
    if (index < 0) index = state.stacks.findIndex((stack) => stack.length);
    const tile = pantry.querySelector(
      `[data-stack="${index}"]`,
    )?.firstElementChild;
    if (!tile) return;
    const { hand, tip } = makeHand(Math.round(tile.offsetWidth * 0.8)),
      x = tile.offsetLeft + tile.offsetWidth / 2 - tip[0],
      y = tile.offsetTop + tile.offsetHeight / 2 - tip[1],
      at = (dy, scale = 1) => `translate(${x}px, ${y + dy}px) scale(${scale})`;
    hand.style.transform = at(0);
    pantry.querySelector(".restaurant-stacks").append(hand);
    if (reducedMotion.matches) return;
    hand.animate(
      [
        { transform: at(-30), opacity: 0, offset: 0 },
        { transform: at(0), opacity: 1, offset: 0.2 },
        { transform: at(0, 0.85), opacity: 1, offset: 0.3 },
        { transform: at(0), opacity: 1, offset: 0.4 },
        { transform: at(0), opacity: 0, offset: 0.7 },
        { transform: at(0), opacity: 0, offset: 1 },
      ],
      { duration: 1800, iterations: Infinity, easing: "ease-in-out" },
    );
  }

  function load(n, m = mode) {
    epoch++;
    busy = false;
    clearTimeout(guideTimer);
    document
      .querySelectorAll(".restaurant-flying")
      .forEach((el) => el.remove());
    mode = progress.mode = m;
    level = generateLevel(n, m);
    state = start(level);
    history = [];
    track().level = n;
    track().unlocked = Math.max(track().unlocked, n);
    saveProgress(KEY, progress);
    $(".game-title").textContent = `第 ${n} 關`;
    $(".game-title").hidden = m === "adult";
    win.hidden = true;
    build();
    render();
    state.seats.forEach((seat, i) => seat && walkIn(i));
    said.textContent = state.seats
      .filter(Boolean)
      .map((seat) => describeOrder(level.customers[seat.customer]))
      .join("，");
    guide = m === "kids" && n <= 2;
    guideTimer = setTimeout(showHand, 1200);
  }

  // The flying copy of a picture, from one place to another, sized to each.
  function fly(from, to, id, toScale = 1) {
    if (reducedMotion.matches || !from || !to) return Promise.resolve();
    const a = from.getBoundingClientRect(),
      b = to.getBoundingClientRect(),
      size = Math.min(a.width, a.height) * 0.8,
      el = document.createElement("span");
    el.className = "restaurant-flying";
    el.append(picture("food", id));
    el.style.width = el.style.height = size + "px";
    el.style.left = a.left + a.width / 2 + "px";
    el.style.top = a.top + a.height / 2 + "px";
    // On body: a fading-in game screen is transformed, which would move a
    // fixed element.
    document.body.append(el);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2),
      dy = b.top + b.height / 2 - (a.top + a.height / 2),
      scale = (Math.min(b.width, b.height) * 0.8 * toScale) / size;
    return el
      .animate(
        [
          { transform: "translate(-50%, -50%)" },
          {
            transform: `translate(calc(${dx}px - 50%), calc(${dy}px - 50%)) scale(${scale})`,
          },
        ],
        { duration: FLIGHT, easing: "cubic-bezier(0.3, 0, 0.2, 1)" },
      )
      .finished.catch(() => {})
      .finally(() => el.remove());
  }
  function walkIn(i) {
    return animate(
      seatEl(i),
      [
        { transform: "translateX(40%)", opacity: 0 },
        { transform: "none", opacity: 1 },
      ],
      { duration: WALK, easing: "ease-out" },
    )?.finished.catch(() => {});
  }
  function refuse(button) {
    animate(
      button,
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-8px)" },
        { transform: "translateX(8px)" },
        { transform: "translateX(-4px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 320 },
    );
  }
  // Where an ingredient (or 白飯) lands: the first empty place for it.
  function target(to, item) {
    if (to.seat !== undefined)
      return plateEl(to.seat).querySelector(
        `.restaurant-slot[data-part="${item}"]:not(.filled)`,
      );
    if (to.cooker)
      return cookerEl().querySelector(
        `.restaurant-slot[data-part="${item}"]:not(.filled)`,
      );
    return pantry.querySelectorAll(".restaurant-tray-place")[shownTray.length];
  }

  // Plays one step of what a tap set off (see tap() in restaurant.js). A
  // day loaded meanwhile stops it at its next pause.
  async function step(event, button, mine) {
    const wait = async (promise) => {
      await promise;
      if (epoch !== mine) throw STALE;
    };
    if (event.type === "put") {
      const { item, from, to } = event;
      let source = button;
      if (from.stack !== undefined) {
        source = button.firstElementChild;
        const stack = state.stacks[from.stack];
        setTimeout(() => fillStack(button, stack));
      } else if (from.cooker) source = cookerEl();
      else if (from.tray !== undefined) {
        source = pantry.querySelectorAll(".restaurant-tray-place")[from.tray];
        shownTray.splice(from.tray, 1);
        setTimeout(showTray);
      }
      const place = target(to, item);
      if (to.tray) shownTray.push(item);
      await wait(fly(source, place, item));
      if (to.tray) showTray();
      else place?.classList.add("filled");
    } else if (event.type === "cook") {
      const cooker = cookerEl();
      cooker.classList.add("cooking");
      sounds.swish();
      await wait(pause(COOK));
      cooker.classList.remove("cooking");
      cooker
        .querySelectorAll(".restaurant-slot")
        .forEach((el) => el.classList.remove("filled"));
    } else if (event.type === "serve") {
      const plate = plateEl(event.seat),
        box = seatEl(event.seat),
        { animal, dish } = level.customers[event.customer];
      // The parts become the dish, which goes to the customer.
      plate.classList.add("ready");
      plate.replaceChildren(picture("food", dish));
      sounds.pop();
      await wait(pause(READY));
      const bubble = box.querySelector(".restaurant-bubble");
      await wait(
        fly(plate, box.querySelector(".restaurant-animal"), dish, 0.5),
      );
      plate.replaceChildren();
      plate.classList.remove("ready");
      const thanks = document.createElement("p");
      thanks.className = "restaurant-thanks";
      thanks.textContent = "謝謝！";
      bubble.replaceChildren(thanks);
      said.textContent = `${ANIMALS[animal].name}吃飽了，謝謝！`;
      animate(
        box.querySelector(".restaurant-animal"),
        [
          { transform: "none" },
          { transform: "translateY(-18%) scale(1.1)" },
          { transform: "none" },
          { transform: "translateY(-10%)" },
          { transform: "none" },
        ],
        { duration: 700, easing: "ease-out" },
      );
      await wait(pause(THANKS));
      await wait(
        animate(
          box,
          [
            { transform: "none", opacity: 1 },
            { transform: "translateX(-40%)", opacity: 0 },
          ],
          { duration: WALK, easing: "ease-in" },
        )?.finished.catch(() => {}),
      );
      showSeat(event.seat, null);
    } else if (event.type === "arrive") {
      const seat = { customer: event.customer, plate: [] };
      showSeat(event.seat, seat);
      showCooker();
      await wait(walkIn(event.seat));
      said.textContent = describeOrder(level.customers[event.customer]);
      if (guide) guideTimer = setTimeout(showHand, 1200);
    } else if (event.type === "done") {
      // The grown-ups' days ran out (they run on for weeks): more follow.
      if (mode === "adult") {
        load(track().level);
        return;
      }
      track().unlocked = Math.max(track().unlocked, level.n + 1);
      saveProgress(KEY, progress);
      // The cleared card shows the day's customers, all fed.
      $(".win-friends").replaceChildren(
        ...level.customers.map(({ animal }, i) => {
          const friend = document.createElement("span");
          friend.append(picture("animal", animal));
          friend.style.setProperty("--i", i);
          return friend;
        }),
      );
      win.hidden = false;
      celebrate(win);
      $(".game-next").focus();
    }
  }
  // A single ingredient flying plays alongside the next tap; anything
  // more (cooking, eating, a new customer) makes taps wait until it ends.
  async function play(events, button) {
    const mine = epoch,
      long = events.length > 1;
    if (long) {
      busy = true;
      $(".game-undo").disabled = true;
    }
    try {
      for (const event of events) await step(event, button, mine);
    } catch (error) {
      if (error === STALE) return;
      throw error;
    }
    if (long) {
      busy = false;
      render();
      if (guide) showHand();
    }
  }

  pantry.addEventListener("click", (e) => {
    const button = e.target.closest("[data-stack]");
    if (!button || busy || !win.hidden) return;
    guide = false;
    showHand();
    const pick = { stack: Number(button.dataset.stack) },
      result = tap(level, state, pick);
    if (!result) {
      sounds.bump();
      refuse(button);
      return;
    }
    sounds.pop();
    history.push(state);
    state = result.state;
    $(".game-undo").disabled = false;
    const left = state.stacks[pick.stack];
    button.disabled = !left.length;
    button.setAttribute(
      "aria-label",
      left.length ? INGREDIENTS[left.at(-1)].name : "空的",
    );
    // A grown-ups' day is over once its customers have eaten: the next
    // visit starts from the day after.
    if (mode === "adult") {
      const day = level.n + Math.floor(state.served / level.perDay);
      if (day > track().level) {
        track().level = day;
        track().unlocked = Math.max(track().unlocked, day);
        saveProgress(KEY, progress);
      }
    }
    play(result.events, button);
  });
  $(".game-back").onclick = () => onBack();
  $(".game-undo").onclick = () => {
    if (busy || !history.length) return;
    state = history.pop();
    document
      .querySelectorAll(".restaurant-flying")
      .forEach((el) => el.remove());
    render();
  };
  // The grown-ups start again from the start of the day they are on.
  $(".game-restart").onclick = () =>
    load(mode === "adult" ? track().level : level.n);
  $(".game-next").onclick = () => load(level.n + 1);
  $(".game-again").onclick = () => load(level.n);
  // The level picker lists the children's days, and picking one plays it.
  // The grown-ups' days have no levels, so with 大人 chosen it holds only
  // the 小朋友／大人 switch and a line saying how it goes. The switch plays
  // the other side at once, from the day it was left on.
  function pickLevels(m) {
    for (const button of $(".game-modes").children)
      button.setAttribute("aria-checked", String(button.dataset.mode === m));
    const endless = m === "adult";
    $(".restaurant-endless").hidden = !endless;
    for (const part of dialog.querySelectorAll(
      ".levels-grid, .levels-latest, .levels-pages",
    ))
      part.hidden = endless;
    if (endless) {
      if (!dialog.open) dialog.showModal();
      return;
    }
    showLevelPicker(dialog, {
      unlocked: track(m).unlocked,
      current: m === mode ? level.n : track(m).level,
      onPick: (n) => load(n, m),
    });
  }
  $(".game-levels").onclick = () => pickLevels(mode);
  $(".game-modes").onclick = (e) => {
    const button = e.target.closest("[data-mode]");
    if (!button) return;
    const m = button.dataset.mode;
    if (m !== mode) load(track(m).level, m);
    // 大人 has no levels to pick, so the dialog closes on it.
    if (m === "adult") dialog.close();
    else pickLevels(m);
  };
  return {
    open() {
      if (!level) load(track().level);
    },
    close() {
      // A customer in the middle of eating carries on while hidden; only
      // an ingredient still in the air is cleared away.
      document
        .querySelectorAll(".restaurant-flying")
        .forEach((el) => el.remove());
      if (dialog.open) dialog.close();
    },
  };
}
