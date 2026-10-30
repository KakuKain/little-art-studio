// 動物餐廳 screen: shows the day's customers one at a time and serves the
// foods the child taps. The rules live in restaurant.js; the pictures are
// made by scripts/build-game-art.cjs.
import {
  FOODS,
  ANIMALS,
  generateLevel,
  serve,
  describeOrder,
  spokenNumber,
} from "./restaurant.js?v=1.0.0-beta.11";
import {
  loadProgress,
  saveProgress,
  showLevelPicker,
  celebrate,
  makeHand,
} from "./game-kit.js?v=1.0.0-beta.11";
import { sounds, say, hush } from "./sound.js?v=1.0.0-beta.11";

// The screen's markup. It is added after the home screen the first time
// the game opens, so the page itself carries no game.
const MARKUP = `
<div class="game-top">
  <button class="game-back" aria-label="返回">
    <img src="assets/ui/back.svg" alt="" />
  </button>
  <div class="game-actions">
    <button class="game-levels" aria-label="選關卡">
      <img src="assets/ui/levels.svg" alt="" />
    </button>
  </div>
</div>
<h2 class="game-title">動物餐廳</h2>
<p class="game-hint">點動物想吃的食物</p>
<div class="restaurant-queue" aria-hidden="true"></div>
<div class="restaurant-stage">
  <div class="restaurant-counter"></div>
  <div class="restaurant-guest">
    <div class="restaurant-order" aria-hidden="true"></div>
    <div class="restaurant-animal" role="img"></div>
  </div>
  <div class="restaurant-shelf" aria-label="食物"></div>
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
  <div class="levels-grid"></div>
</dialog>
`;
const KEY = "little-playground.restaurant";
const ART = "assets/games/restaurant/";
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
// Milliseconds for a food to fly to the order, for the customer to enjoy it
// and to walk away. Without motion, the customer still pauses to say thanks.
const FLIGHT = 300,
  THANKS = 1100,
  WALK = 300;

function animate(el, keyframes, options) {
  return reducedMotion.matches ? null : el.animate(keyframes, options);
}
// The drawn picture of an animal or a food. Its container is labeled, so the
// picture itself stays silent.
function picture(kind, id) {
  const img = new Image();
  img.className = "restaurant-picture";
  img.src = `${ART}${kind}-${id}.webp`;
  img.alt = "";
  return img;
}

export function createRestaurantGame({ onBack }) {
  const root = document.createElement("section");
  root.id = "game-restaurant";
  root.className = "game";
  root.setAttribute("aria-label", "動物餐廳");
  root.innerHTML = MARKUP;
  document.getElementById("home").after(root);
  const $ = (selector) => root.querySelector(selector),
    guest = $(".restaurant-guest"),
    animal = $(".restaurant-animal"),
    bubble = $(".restaurant-order"),
    shelf = $(".restaurant-shelf"),
    queue = $(".restaurant-queue"),
    said = $(".restaurant-said"),
    win = $(".game-win"),
    dialog = $(".game-levels-dialog"),
    progress = loadProgress(KEY),
    timers = new Set();
  let level = null,
    index = 0,
    plate = [],
    serving = false,
    // Levels 1 and 2 show a hand until the child taps the shelf.
    guide = false,
    // The customer walking away stays out of sight until the next arrives.
    exit = null;

  // Loading a level cancels whatever the previous one still had scheduled,
  // so an old customer never shows up late.
  function later(fn, ms) {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  }
  function flight() {
    return reducedMotion.matches ? 0 : FLIGHT;
  }

  function renderQueue() {
    queue.replaceChildren(
      ...level.customers.map((_, i) => {
        const dot = document.createElement("span");
        if (i < index) dot.className = "served";
        else if (i === index) dot.className = "current";
        return dot;
      }),
    );
  }
  function renderGuest() {
    const { animal: id, order } = level.customers[index],
      look = ANIMALS[id];
    exit?.cancel();
    exit = null;
    animal.replaceChildren(picture("animal", id));
    animal.setAttribute("aria-label", look.name);
    // One row per kind, one slot per item, so the child can count them.
    bubble.replaceChildren(
      ...order.map(({ food, count }) => {
        const row = document.createElement("div");
        row.className = "restaurant-row";
        for (let i = 0; i < count; i++) {
          const slot = document.createElement("span");
          slot.className = "restaurant-slot";
          slot.dataset.food = food;
          slot.append(picture("food", food));
          row.append(slot);
        }
        // The row's number, so the child links how many to the digit.
        const number = document.createElement("span");
        number.className = "restaurant-count";
        number.textContent = count;
        row.append(number);
        return row;
      }),
    );
    said.textContent = `${look.name}想吃 ${describeOrder(order)}`;
    sayOrder({ queue: true });
    guide = level.n <= 2;
    later(showHand, 1200);
    animate(
      guest,
      [
        { transform: "translateX(40%)", opacity: 0 },
        { transform: "none", opacity: 1 },
      ],
      { duration: 320, easing: "ease-out" },
    );
  }
  // Customers keep coming while the screen is hidden, but only speak on it.
  function speak(text, options) {
    if (root.offsetParent) say(text, options);
  }
  // The customer says what it wants, after anything still being said (the
  // hub card's name); tapping it says it again at once.
  function sayOrder(options) {
    const { animal: id, order } = level.customers[index];
    speak(
      `${ANIMALS[id].name}想吃${describeOrder(order, { spoken: true })}`,
      options,
    );
  }
  // On levels 1 and 2 a hand taps the food the customer still wants, over
  // and over, until the child taps the shelf; it comes back for the next
  // customer.
  function showHand() {
    shelf.querySelector(".game-hand")?.remove();
    if (!guide || serving || !win.hidden) return;
    const wanted = level.customers[index].order.find(
        ({ food, count }) => plate.filter((f) => f === food).length < count,
      ),
      button = wanted && shelf.querySelector(`[data-food="${wanted.food}"]`);
    if (!button) return;
    const { hand, tip } = makeHand(Math.round(button.offsetWidth * 0.7)),
      x = button.offsetLeft + button.offsetWidth / 2 - tip[0],
      y = button.offsetTop + button.offsetHeight / 2 - tip[1],
      at = (dy, scale = 1) => `translate(${x}px, ${y + dy}px) scale(${scale})`;
    hand.style.transform = at(0);
    shelf.append(hand);
    if (reducedMotion.matches) return;
    hand.animate(
      [
        { transform: at(-30), opacity: 0, offset: 0 },
        { transform: at(0), opacity: 1, offset: 0.2 },
        { transform: at(0, 0.85), opacity: 1, offset: 0.3 },
        { transform: at(0), opacity: 1, offset: 0.4 },
        { transform: at(0, 0.85), opacity: 1, offset: 0.5 },
        { transform: at(0), opacity: 1, offset: 0.6 },
        { transform: at(0), opacity: 0, offset: 0.8 },
        { transform: at(0), opacity: 0, offset: 1 },
      ],
      { duration: 2200, iterations: Infinity, easing: "ease-in-out" },
    );
  }
  function load(n) {
    for (const id of timers) clearTimeout(id);
    timers.clear();
    level = generateLevel(n);
    index = 0;
    plate = [];
    serving = false;
    progress.level = n;
    progress.unlocked = Math.max(progress.unlocked, n);
    saveProgress(KEY, progress);
    $(".game-title").textContent = `第 ${n} 關`;
    $(".game-hint").hidden = n > 2;
    win.hidden = true;
    shelf.style.setProperty(
      "--columns",
      level.shelf.length <= 4
        ? level.shelf.length
        : Math.ceil(level.shelf.length / 2),
    );
    shelf.replaceChildren(
      ...level.shelf.map((food) => {
        const button = document.createElement("button");
        button.dataset.food = food;
        button.append(picture("food", food));
        button.setAttribute("aria-label", FOODS[food].name);
        return button;
      }),
    );
    renderQueue();
    renderGuest();
  }

  // The tapped food flies from the shelf into its slot in the order.
  function fly(from, to) {
    if (reducedMotion.matches) return;
    const a = from.getBoundingClientRect(),
      b = to.getBoundingClientRect(),
      size = parseFloat(getComputedStyle(from).fontSize),
      el = document.createElement("span");
    el.className = "restaurant-flying";
    el.append(from.firstChild.cloneNode());
    el.style.fontSize = size + "px";
    el.style.left = a.left + a.width / 2 + "px";
    el.style.top = a.top + a.height / 2 + "px";
    // On body: a fading-in game screen is transformed, which would move a
    // fixed element.
    document.body.append(el);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2),
      dy = b.top + b.height / 2 - (a.top + a.height / 2),
      scale = parseFloat(getComputedStyle(to).fontSize) / size;
    el.animate(
      [
        { transform: "translate(-50%, -50%)" },
        {
          transform: `translate(calc(${dx}px - 50%), calc(${dy}px - 50%)) scale(${scale})`,
        },
      ],
      { duration: FLIGHT, easing: "cubic-bezier(0.3, 0, 0.2, 1)" },
    ).finished.finally(() => el.remove());
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
  function thank() {
    const look = ANIMALS[level.customers[index].animal],
      thanks = document.createElement("p");
    thanks.className = "restaurant-thanks";
    thanks.textContent = "❤️ 謝謝！";
    bubble.replaceChildren(thanks);
    said.textContent = `${look.name}吃飽了，謝謝！`;
    speak("謝謝！", { queue: true });
    animate(
      animal,
      [
        { transform: "none" },
        { transform: "translateY(-18%) scale(1.1)" },
        { transform: "none" },
        { transform: "translateY(-10%)" },
        { transform: "none" },
      ],
      { duration: 700, easing: "ease-out" },
    );
    later(walkAway, THANKS);
  }
  function walkAway() {
    exit = animate(
      guest,
      [
        { transform: "none", opacity: 1 },
        { transform: "translateX(-40%)", opacity: 0 },
      ],
      { duration: WALK, easing: "ease-in", fill: "forwards" },
    );
    index++;
    renderQueue();
    later(nextGuest, WALK);
  }
  function nextGuest() {
    plate = [];
    if (index < level.customers.length) {
      serving = false;
      renderGuest();
      return;
    }
    progress.unlocked = Math.max(progress.unlocked, level.n + 1);
    saveProgress(KEY, progress);
    // The cleared card shows the day's customers, all fed.
    $(".win-friends").replaceChildren(
      ...level.customers.map(({ animal: id }, i) => {
        const friend = document.createElement("span");
        friend.append(picture("animal", id));
        friend.style.setProperty("--i", i);
        return friend;
      }),
    );
    win.hidden = false;
    celebrate(win);
    $(".game-next").focus();
  }

  shelf.addEventListener("click", (e) => {
    const button = e.target.closest("button");
    if (!button || serving || !win.hidden) return;
    guide = false;
    showHand();
    const food = button.dataset.food,
      result = serve(level.customers[index].order, plate, food);
    if (!result.taken) {
      sounds.bump();
      refuse(button);
      return;
    }
    sounds.pop();
    // Each food is counted as it lands: 一、兩、三.
    const nth = plate.filter((f) => f === food).length,
      slot = bubble.querySelectorAll(`[data-food="${food}"]`)[nth];
    speak(spokenNumber(nth + 1));
    plate = result.plate;
    fly(button, slot);
    later(() => slot.classList.add("served"), flight());
    if (result.done) {
      serving = true;
      later(thank, flight() + 150);
    }
  });
  animal.addEventListener("click", () => {
    if (!serving && win.hidden) sayOrder();
  });
  $(".game-back").onclick = () => onBack();
  $(".game-next").onclick = () => load(level.n + 1);
  $(".game-again").onclick = () => load(level.n);
  $(".game-levels").onclick = () =>
    showLevelPicker(dialog, {
      unlocked: progress.unlocked,
      current: level.n,
      onPick: load,
    });
  return {
    open() {
      if (!level) load(progress.level);
      else if (!serving && win.hidden) sayOrder();
    },
    close() {
      // A customer in the middle of thanking carries on while hidden; only
      // a food still in the air is cleared away.
      document
        .querySelectorAll(".restaurant-flying")
        .forEach((el) => el.remove());
      hush();
      if (dialog.open) dialog.close();
    },
  };
}
