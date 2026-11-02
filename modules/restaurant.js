// 動物餐廳 rules and levels. Pure logic: no DOM, so every rule is unit-tested.
//
// A level is one day at the restaurant. Animal customers sit at the counter,
// up to `seats` at a time, and each orders one dish. A dish is made from
// parts: 綠茶 is 杯子 + 茶葉 + 水. The child taps an ingredient and it goes
// where it is needed: onto the plate of a customer whose dish still lacks
// it, or into the 電鍋 when a dish needs 白飯 (米 + 水 cook into 白飯). A
// plate with every part becomes the dish, and the customer eats and leaves.
//
// The day's ingredients, exactly as many as it needs, are heaped in stacks.
// Only the top of a stack can be taken; one nobody needs yet waits on a
// small tray until someone does, and with the tray full it is handed back.
// With the tray full and nothing useful on top the day is stuck, so every
// level is checked solvable and the screen has undo. Children's days (kids)
// start easy enough to finish by tapping anything; grown-ups' (adult) days
// have more customers, a smaller tray and need planning.
import { seeded, shuffle } from "./random.js?v=1.0.0-beta.12";

// Each ingredient and dish has a picture named after its id in
// assets/games/restaurant/ (food-<id>.webp).
export const INGREDIENTS = {
  cup: { name: "杯子" },
  tea: { name: "茶葉" },
  water: { name: "水" },
  milk: { name: "牛奶" },
  rice: { name: "米" },
  salmon: { name: "鮭魚" },
  egg: { name: "蛋" },
  nori: { name: "海苔" },
  cucumber: { name: "小黃瓜" },
};
// The 電鍋 cooks 米 and 水 into 白飯 as soon as it has both. 白飯 is a dish
// of its own and a part of sushi.
export const COOKER = { makes: "cookedrice", parts: ["rice", "water"] };
// The unit is the measure word a child would hear: 一杯綠茶.
export const DISHES = {
  greentea: { name: "綠茶", unit: "杯", parts: ["cup", "tea", "water"] },
  milktea: { name: "奶茶", unit: "杯", parts: ["cup", "tea", "water", "milk"] },
  cookedrice: { name: "白飯", unit: "碗", parts: ["cookedrice"] },
  salmonsushi: {
    name: "鮭魚壽司",
    unit: "個",
    parts: ["cookedrice", "salmon"],
  },
  eggsushi: { name: "玉子壽司", unit: "個", parts: ["cookedrice", "egg"] },
  cucumberroll: {
    name: "小黃瓜捲",
    unit: "份",
    parts: ["cookedrice", "nori", "cucumber"],
  },
};
// The name of anything that can lie on a plate.
export function partName(id) {
  return (INGREDIENTS[id] ?? DISHES[id]).name;
}

export const ANIMALS = {
  rabbit: { name: "小兔子" },
  monkey: { name: "小猴子" },
  mouse: { name: "小老鼠" },
  bear: { name: "小熊" },
  cat: { name: "小貓" },
  chick: { name: "小雞" },
  dog: { name: "小狗" },
  panda: { name: "熊貓" },
  koala: { name: "無尾熊" },
  tiger: { name: "老虎" },
  lion: { name: "獅子" },
  pig: { name: "小豬" },
  frog: { name: "青蛙" },
  penguin: { name: "企鵝" },
  fox: { name: "狐狸" },
  cow: { name: "乳牛" },
  hamster: { name: "倉鼠" },
  unicorn: { name: "獨角獸" },
};

// 「小兔子想要一杯綠茶」, for screen readers when a customer sits down.
export function describeOrder({ animal, dish }) {
  const { name, unit } = DISHES[dish];
  return `${ANIMALS[animal].name}想要一${unit}${name}`;
}

function count(list, item) {
  return list.filter((x) => x === item).length;
}
// Whether `have` holds fewer of `item` than `parts` asks for.
function lacks(parts, have, item) {
  return count(parts, item) > count(have, item);
}
export function plateDone(dish, plate) {
  return DISHES[dish].parts.every(
    (part) => !lacks(DISHES[dish].parts, plate, part),
  );
}
// The raw ingredients a dish takes, 白飯 counted as the 米 and 水 it is
// cooked from.
export function ingredientsOf(dish) {
  return DISHES[dish].parts.flatMap((part) =>
    part === COOKER.makes ? COOKER.parts : [part],
  );
}

// The day as it starts: the first customers sit down, the plates and the
// 電鍋 are empty. A seat is null once nobody is left to sit there.
export function start(level) {
  const seats = [];
  for (let i = 0; i < level.seats; i++)
    seats.push(i < level.customers.length ? { customer: i, plate: [] } : null);
  return {
    seats,
    next: Math.min(level.seats, level.customers.length),
    cooker: [],
    served: 0,
    stacks: level.stacks.map((stack) => [...stack]),
    tray: [],
  };
}

// Where an ingredient goes: the plate of the customer who has waited
// longest and still lacks it, or the 電鍋 when that customer is waiting for
// 白飯 and the 電鍋 lacks it. Null when nobody needs it now.
export function destination(level, state, item) {
  const dishOf = (seat) => level.customers[seat.customer].dish;
  const waiting = state.seats
    .map((seat, index) => ({ seat, index }))
    .filter(({ seat }) => seat)
    .sort((a, b) => a.seat.customer - b.seat.customer);
  for (const { seat, index } of waiting) {
    const parts = DISHES[dishOf(seat)].parts;
    if (lacks(parts, seat.plate, item)) return { seat: index };
    if (
      lacks(parts, seat.plate, COOKER.makes) &&
      lacks(COOKER.parts, state.cooker, item)
    )
      return { cooker: true };
  }
  return null;
}

// A state to change, leaving the one tapped on as it was (undo keeps it).
function copy(state) {
  return {
    ...state,
    seats: state.seats.map(
      (seat) => seat && { ...seat, plate: [...seat.plate] },
    ),
    cooker: [...state.cooker],
    stacks: state.stacks.map((stack) => [...stack]),
    tray: [...state.tray],
  };
}
function put(state, item, to) {
  if (to.seat !== undefined) state.seats[to.seat].plate.push(item);
  else if (to.cooker) state.cooker.push(item);
  else state.tray.push(item);
}

// Taps the top of a stack, `{stack}` being its index. Returns null when the
// ingredient is handed back, or the new state and what happened, in order,
// for the screen to show:
//   {type: "put", item, from, to}  an ingredient (or 白飯) moves to a seat's
//                                  plate, the 電鍋 or the tray;
//   {type: "cook"}                 the 電鍋 cooks its 米 and 水;
//   {type: "serve", seat, customer}  a plate is complete: the customer eats
//                                  and leaves;
//   {type: "arrive", seat, customer} the next customer sits down;
//   {type: "done"}                 everyone has eaten.
// `from` is the pick, `{cooker: true}` or `{tray: index}`.
export function tap(level, state, pick) {
  const item = state.stacks[pick.stack]?.at(-1);
  if (!item) return null;
  let to = destination(level, state, item);
  if (!to && state.tray.length < level.tray) to = { tray: true };
  if (!to) return null;
  const next = copy(state),
    events = [{ type: "put", item, from: pick, to }];
  next.stacks[pick.stack].pop();
  put(next, item, to);
  settle(level, next, events);
  return { state: next, events };
}

// Everything that follows by itself: the 電鍋 cooks, complete plates are
// eaten, new customers sit down and the tray hands out what they need.
function settle(level, state, events) {
  for (let changed = true; changed; ) {
    changed = false;
    if (
      COOKER.parts.every((part) => !lacks(COOKER.parts, state.cooker, part))
    ) {
      state.cooker = [];
      events.push({ type: "cook" });
      const to = destination(level, state, COOKER.makes);
      put(state, COOKER.makes, to);
      events.push({
        type: "put",
        item: COOKER.makes,
        from: { cooker: true },
        to,
      });
      changed = true;
    }
    state.seats.forEach((seat, index) => {
      if (!seat || !plateDone(level.customers[seat.customer].dish, seat.plate))
        return;
      events.push({ type: "serve", seat: index, customer: seat.customer });
      state.served++;
      if (state.next < level.customers.length) {
        state.seats[index] = { customer: state.next++, plate: [] };
        events.push({ type: "arrive", seat: index, customer: state.next - 1 });
      } else state.seats[index] = null;
      changed = true;
    });
    for (let i = 0; i < state.tray.length; i++) {
      const item = state.tray[i],
        to = destination(level, state, item);
      if (!to) continue;
      state.tray.splice(i, 1);
      put(state, item, to);
      events.push({ type: "put", item, from: { tray: i }, to });
      changed = true;
      break;
    }
  }
  if (state.served === level.customers.length) events.push({ type: "done" });
}

// Customers per day, how many sit at once, the dishes on the menu, how
// many stacks hold the ingredients and how many places the tray has. A day
// is also tried with 20 games of random taps: the children's first days
// must be finished by at least `easy` of them, later days by at most
// `lucky`, so they need some thought. The children's menu grows one idea
// at a time: drinks, then 白飯 from the 電鍋, then sushi made from that 白飯.
// Grown-ups' days have the whole menu, more customers, two seats and a
// two-place tray; random taps hardly ever finish them, and neither does
// looking one tap ahead (oneStepAhead()).
export function levelSpec(n, mode = "kids") {
  const all = Object.keys(DISHES);
  if (mode === "adult") {
    if (n <= 10)
      return {
        customers: 8,
        seats: 2,
        menu: all,
        stacks: 5,
        tray: 2,
        lucky: 2,
      };
    if (n <= 30)
      return {
        customers: 10,
        seats: 2,
        menu: all,
        stacks: 6,
        tray: 2,
        lucky: 1,
      };
    return { customers: 12, seats: 2, menu: all, stacks: 6, tray: 2, lucky: 0 };
  }
  const drinks = ["greentea", "milktea"],
    rice = [...drinks, "cookedrice"];
  if (n <= 2)
    return {
      customers: 3,
      seats: 1,
      menu: ["greentea"],
      stacks: 3,
      tray: 3,
      easy: 16,
    };
  if (n <= 5)
    return {
      customers: 4,
      seats: 1,
      menu: drinks,
      stacks: 3,
      tray: 3,
      easy: 14,
    };
  if (n <= 9)
    return { customers: 4, seats: 2, menu: rice, stacks: 4, tray: 3, easy: 12 };
  if (n <= 14)
    return {
      customers: 5,
      seats: 2,
      menu: [...rice, "salmonsushi"],
      stacks: 4,
      tray: 3,
      lucky: 14,
    };
  if (n <= 24)
    return { customers: 6, seats: 2, menu: all, stacks: 4, tray: 3, lucky: 10 };
  if (n <= 45)
    return { customers: 8, seats: 2, menu: all, stacks: 5, tray: 3, lucky: 10 };
  return { customers: 10, seats: 3, menu: all, stacks: 6, tray: 3, lucky: 10 };
}

// Customers in order. The first one orders the newest dish on the menu, so
// a level that brings one in always shows it. No animal sits twice at once,
// nor comes right back.
function makeCustomers(spec, rand, newest) {
  const animals = Object.keys(ANIMALS),
    customers = [];
  for (let i = 0; i < spec.customers; i++) {
    const recent = customers.slice(-spec.seats).map((c) => c.animal),
      choices = animals.filter((a) => !recent.includes(a)),
      animal = choices[Math.floor(rand() * choices.length)],
      dish =
        i === 0 && newest
          ? newest
          : spec.menu[Math.floor(rand() * spec.menu.length)];
    customers.push({ animal, dish });
  }
  return customers;
}

// Plays a level to the end if it can be done, trying every top
// of a stack in turn. Returns the stacks picked, in order, or null. States
// already found to be stuck are remembered, so this stays quick; with a
// `budget`, it gives up (null) after trying that many states.
export function solve(level, budget = Infinity) {
  const stuck = new Set();
  let tried = 0;
  function play(state, moves) {
    if (state.served === level.customers.length) return moves;
    const key = JSON.stringify(state);
    if (stuck.has(key) || ++tried > budget) return null;
    for (let i = 0; i < state.stacks.length; i++) {
      const result = tap(level, state, { stack: i });
      if (!result) continue;
      const found = play(result.state, [...moves, i]);
      if (found) return found;
    }
    stuck.add(key);
    return null;
  }
  return play(start(level), []);
}
// How many of `tries` games of someone tapping any top that is taken, at
// random, reach the end. A level that most of them finish needs no
// planning.
export function luckyGames(level, rand, tries) {
  let wins = 0;
  for (let game = 0; game < tries; game++) {
    let state = start(level);
    for (;;) {
      if (state.served === level.customers.length) {
        wins++;
        break;
      }
      const room = state.tray.length < level.tray,
        moves = state.stacks.flatMap((stack, i) =>
          stack.length && (room || destination(level, state, stack.at(-1)))
            ? [i]
            : [],
        );
      if (!moves.length) break;
      state = tap(level, state, {
        stack: moves[Math.floor(rand() * moves.length)],
      }).state;
    }
  }
  return wins;
}

// Whether someone who looks only one tap ahead finishes the day: a top
// someone needs if there is one, else the top that uncovers one someone
// needs, else the first. Every grown-ups' day defeats this.
export function oneStepAhead(level) {
  let state = start(level);
  const wanted = (stack, depth) =>
    stack.length >= depth && destination(level, state, stack.at(-depth));
  while (state.served < level.customers.length) {
    let pick = state.stacks.findIndex((stack) => wanted(stack, 1));
    if (pick < 0) pick = state.stacks.findIndex((stack) => wanted(stack, 2));
    if (pick < 0) pick = state.stacks.findIndex((stack) => stack.length);
    const result = tap(level, state, { stack: pick });
    if (!result) return false;
    state = result.state;
  }
  return true;
}

function stacksFor(customers, count, rand) {
  const tiles = shuffle(
      customers.flatMap((c) => ingredientsOf(c.dish)),
      rand,
    ),
    stacks = Array.from({ length: count }, () => []);
  tiles.forEach((tile, i) => stacks[i % count].push(tile));
  return stacks;
}

// Level n of the children's ("kids") or the grown-ups' ("adult") days. The
// same every time, on every device.
const cache = new Map();
export function generateLevel(n, mode = "kids") {
  const key = `${mode}:${n}`;
  let level = cache.get(key);
  if (!level) {
    const spec = levelSpec(n, mode),
      rand = seeded(
        Math.imul(n, 2246822519) ^ (mode === "adult" ? 0x6c078965 : 0x2545f491),
      );
    const previous = n > 1 ? levelSpec(n - 1, mode).menu : [],
      newest = spec.menu.find((dish) => !previous.includes(dish));
    for (let tries = 0; !level; tries++) {
      const customers = makeCustomers(spec, rand, newest),
        candidate = {
          seats: spec.seats,
          tray: spec.tray,
          customers,
          stacks: stacksFor(customers, spec.stacks, rand),
        };
      // A finished game shows the day can be done; without one, solve()
      // has to make sure, and a day it cannot settle quickly is skipped.
      // Give up on the luck rule if a day refuses to cooperate.
      const wins = luckyGames(candidate, rand, 20),
        fits = spec.easy
          ? wins >= spec.easy
          : wins <= spec.lucky && (mode === "kids" || !oneStepAhead(candidate));
      if ((fits || tries > 300) && (wins > 0 || solve(candidate, 3000)))
        level = candidate;
    }
    level = {
      n,
      mode,
      ...level,
      cooker: spec.menu.some((dish) => ingredientsOf(dish).includes("rice")),
    };
    cache.set(key, level);
  }
  // Never hand out the cached level.
  return structuredClone(level);
}
