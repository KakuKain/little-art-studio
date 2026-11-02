import test from "node:test";
import assert from "node:assert/strict";
import {
  INGREDIENTS,
  DISHES,
  ANIMALS,
  COOKER,
  start,
  tap,
  destination,
  plateDone,
  ingredientsOf,
  describeOrder,
  partName,
  solve,
  luckyGames,
  oneStepAhead,
  generateLevel,
  levelSpec,
} from "../modules/restaurant.js";
import { seeded } from "../modules/random.js";

// A day with the given dishes; `tiles` become one-ingredient stacks unless
// stacks are given, so a test can take any of them.
const day = (dishes, { seats = 1, tray = 0, tiles = [], stacks } = {}) => ({
  seats,
  tray,
  customers: dishes.map((dish, i) => ({
    animal: Object.keys(ANIMALS)[i],
    dish,
  })),
  stacks: stacks ?? tiles.map((tile) => [tile]),
});
const take = (level, state, item) =>
  tap(level, state, {
    stack: state.stacks.findIndex((stack) => stack.at(-1) === item),
  });
const types = (events) => events.map((e) => e.type);

test("an ingredient goes onto the plate that still lacks it", () => {
  const level = day(["greentea"], {
    tiles: ["milk", "tea", "tea", "cup", "water"],
  });
  let state = start(level);
  assert.equal(take(level, state, "milk"), null, "nobody wants milk");
  let result = take(level, state, "tea");
  assert.deepEqual(result.events, [
    { type: "put", item: "tea", from: { stack: 1 }, to: { seat: 0 } },
  ]);
  state = result.state;
  assert.equal(take(level, state, "tea"), null, "tea is there");
  state = take(level, state, "cup").state;
  result = take(level, state, "water");
  assert.deepEqual(types(result.events), ["put", "serve", "done"]);
  assert.deepEqual(result.state.seats, [null]);
  assert.equal(result.state.served, 1);
});

test("tapping never changes the state it was given", () => {
  const level = day(["milktea", "greentea"], { tiles: ["tea"] });
  const state = start(level),
    before = structuredClone(state);
  take(level, state, "tea");
  assert.deepEqual(state, before);
});

test("the customer who has waited longest is served first", () => {
  const level = day(["greentea", "milktea", "greentea"], {
    seats: 2,
    tiles: ["tea", "tea", "cup", "water", "cup"],
  });
  let state = start(level);
  assert.deepEqual(destination(level, state, "tea"), { seat: 0 });
  assert.deepEqual(destination(level, state, "milk"), { seat: 1 });
  state = take(level, state, "tea").state;
  assert.deepEqual(destination(level, state, "tea"), { seat: 1 });
  state = take(level, state, "cup").state;
  // Customer 0 leaves and customer 2 takes seat 0, but customer 1 has
  // waited longer.
  const result = take(level, state, "water");
  assert.deepEqual(types(result.events), ["put", "serve", "arrive"]);
  assert.deepEqual(result.events[2], { type: "arrive", seat: 0, customer: 2 });
  assert.deepEqual(destination(level, result.state, "cup"), { seat: 1 });
});

test("米 and 水 cook into 白飯 in the 電鍋 for whoever needs it", () => {
  const level = day(["salmonsushi", "greentea"], {
    seats: 2,
    tiles: ["water", "rice", "rice"],
  });
  let state = start(level);
  // Customer 0 waits for 白飯, so the 電鍋 takes 水 before customer 1's tea
  // gets it, and only once.
  assert.deepEqual(destination(level, state, "water"), { cooker: true });
  state = take(level, state, "water").state;
  assert.deepEqual(state.cooker, ["water"]);
  assert.deepEqual(destination(level, state, "water"), { seat: 1 });
  const result = take(level, state, "rice");
  assert.deepEqual(result.events, [
    { type: "put", item: "rice", from: { stack: 1 }, to: { cooker: true } },
    { type: "cook" },
    {
      type: "put",
      item: "cookedrice",
      from: { cooker: true },
      to: { seat: 0 },
    },
  ]);
  assert.deepEqual(result.state.cooker, []);
  assert.deepEqual(result.state.seats[0].plate, ["cookedrice"]);
  assert.equal(destination(level, result.state, "rice"), null, "enough rice");
});

test("a bowl of 白飯 is a dish of its own", () => {
  const level = day(["cookedrice"], { tiles: ["rice", "water"] });
  const state = take(level, start(level), "rice").state;
  const result = take(level, state, "water");
  assert.deepEqual(types(result.events), [
    "put",
    "cook",
    "put",
    "serve",
    "done",
  ]);
  assert.ok(plateDone("cookedrice", ["cookedrice"]));
  assert.ok(!plateDone("cucumberroll", ["cookedrice", "nori"]));
});

test("only the top of a stack is taken; the tray holds the rest", () => {
  const level = day(["greentea", "milktea"], {
    tray: 1,
    stacks: [
      ["water", "tea", "cup"],
      ["milk", "water"],
      ["tea", "cup"],
    ],
  });
  let state = start(level);
  let result = tap(level, state, { stack: 0 });
  assert.deepEqual(result.events[0].to, { seat: 0 }, "the cup is wanted");
  state = result.state;
  // Water is wanted too; then milk (for the next customer) waits on the
  // tray, and with the tray full a second unwanted top is handed back.
  state = tap(level, state, { stack: 1 }).state;
  state = tap(level, state, { stack: 1 }).state;
  assert.deepEqual(state.tray, ["milk"]);
  assert.equal(tap(level, state, { stack: 2 }), null, "the tray is full");
  // The tea finishes the first plate; the next customer sits down and the
  // milk leaves the tray for its plate at once.
  result = tap(level, state, { stack: 0 });
  assert.deepEqual(types(result.events), ["put", "serve", "arrive", "put"]);
  assert.deepEqual(result.events[3], {
    type: "put",
    item: "milk",
    from: { tray: 0 },
    to: { seat: 0 },
  });
  assert.deepEqual(result.state.tray, []);
  assert.equal(tap(level, result.state, { stack: 1 }), null, "empty stack");
});

// Every level holds exactly the ingredients its customers need and can be
// finished by playing solve()'s moves.
function checkLevel(level, label) {
  assert.deepEqual(
    level.stacks.flat().sort(),
    level.customers.flatMap((c) => ingredientsOf(c.dish)).sort(),
    `${label}: the wrong ingredients`,
  );
  const moves = solve(level);
  assert.ok(moves, `${label} must be solvable`);
  let state = start(level);
  for (const stack of moves) state = tap(level, state, { stack }).state;
  assert.equal(state.served, level.customers.length);
  for (let i = 1; i < level.customers.length; i++)
    assert.notEqual(
      level.customers[i].animal,
      level.customers[i - 1].animal,
      `${label}: the same animal twice in a row`,
    );
}

test("every children's day can be finished, the first ones easily", () => {
  for (let n = 1; n <= 50; n++) {
    const level = generateLevel(n),
      spec = levelSpec(n);
    assert.equal(level.mode, "kids");
    assert.equal(level.customers.length, spec.customers);
    assert.equal(level.stacks.length, spec.stacks);
    assert.equal(
      level.cooker,
      spec.menu.some((dish) => ingredientsOf(dish).includes("rice")),
    );
    checkLevel(level, `level ${n}`);
  }
  // Tapping anything that is taken finishes the first days nearly always.
  for (const n of [1, 2])
    assert.ok(luckyGames(generateLevel(n), seeded(n), 20) >= 16);
});

test("each new dish is first ordered on the day it joins the menu", () => {
  assert.deepEqual(
    [1, 3, 6, 10, 15].map((n) => generateLevel(n).customers[0].dish),
    ["greentea", "milktea", "cookedrice", "salmonsushi", "eggsushi"],
  );
  assert.deepEqual(levelSpec(1).menu, ["greentea"]);
  assert.equal(levelSpec(30).menu.length, Object.keys(DISHES).length);
  assert.ok(levelSpec(50).seats > levelSpec(1).seats);
});

test("grown-ups' days need planning", () => {
  for (let n = 1; n <= 40; n++) {
    const level = generateLevel(n, "adult");
    assert.equal(level.mode, "adult");
    checkLevel(level, `adult level ${n}`);
    assert.ok(
      !oneStepAhead(level),
      `adult level ${n}: looking one tap ahead is enough`,
    );
  }
  // Harder than the children's days: more customers, a smaller tray and
  // far fewer random games that finish.
  const lucky = (mode) => {
    let wins = 0;
    for (let n = 25; n <= 34; n++)
      wins += luckyGames(generateLevel(n, mode), seeded(n), 20);
    return wins;
  };
  assert.ok(lucky("adult") * 3 < lucky("kids"));
  assert.ok(levelSpec(1, "adult").customers > levelSpec(1).customers);
  assert.ok(levelSpec(50, "adult").tray < levelSpec(50).tray);
  assert.deepEqual(generateLevel(33, "adult"), generateLevel(33, "adult"));
});

test("a level is the same every time and callers cannot change it", () => {
  const first = generateLevel(17);
  first.customers[0].dish = "nothing";
  first.stacks[0].pop();
  const again = generateLevel(17);
  assert.notEqual(again.customers[0].dish, "nothing");
  assert.deepEqual(again, generateLevel(17));
});

test("orders and parts have names", () => {
  assert.equal(
    describeOrder({ animal: "rabbit", dish: "greentea" }),
    "小兔子想要一杯綠茶",
  );
  assert.equal(
    describeOrder({ animal: "panda", dish: "cookedrice" }),
    "熊貓想要一碗白飯",
  );
  assert.equal(partName("cookedrice"), "白飯");
  assert.equal(partName("nori"), "海苔");
  assert.deepEqual(ingredientsOf("eggsushi"), [...COOKER.parts, "egg"]);
  for (const dish of Object.values(DISHES))
    for (const part of dish.parts)
      assert.ok(part === COOKER.makes || INGREDIENTS[part], part);
});
