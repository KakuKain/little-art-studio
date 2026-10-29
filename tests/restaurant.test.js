import test from "node:test";
import assert from "node:assert/strict";
import {
  FOODS,
  ANIMALS,
  serve,
  stillWanted,
  orderDone,
  describeOrder,
  spokenNumber,
  generateLevel,
  levelSpec,
} from "../modules/restaurant.js";

const order = [
  { food: "apple", count: 2 },
  { food: "banana", count: 1 },
];

test("only foods the customer still wants are taken", () => {
  let plate = [];
  let result = serve(order, plate, "milk");
  assert.deepEqual(result, { plate, taken: false, done: false }, "not ordered");
  result = serve(order, plate, "apple");
  assert.equal(result.taken, true);
  plate = result.plate;
  assert.equal(stillWanted(order, plate, "apple"), 1);
  plate = serve(order, plate, "apple").plate;
  result = serve(order, plate, "apple");
  assert.equal(result.taken, false, "a third apple is one too many");
  assert.equal(result.plate, plate);
  result = serve(order, plate, "banana");
  assert.deepEqual(result.plate, ["apple", "apple", "banana"]);
  assert.equal(result.done, true);
  assert.equal(orderDone(order, ["apple", "banana"]), false);
});

test("serving never changes the plate it was given", () => {
  const plate = ["apple"];
  serve(order, plate, "apple");
  assert.deepEqual(plate, ["apple"]);
});

test("orders are described with the right measure words", () => {
  assert.equal(describeOrder([{ food: "milk", count: 1 }]), "1 杯牛奶");
  assert.equal(describeOrder(order), "2 顆蘋果和 1 根香蕉");
  assert.equal(
    describeOrder([...order, { food: "fish", count: 3 }]),
    "2 顆蘋果、1 根香蕉和 3 條魚",
  );
  // Spoken aloud, numbers are words and two is 兩.
  assert.equal(
    describeOrder([...order, { food: "fish", count: 5 }], { spoken: true }),
    "兩顆蘋果、一根香蕉和五條魚",
  );
  // Counting a food as it is served.
  assert.deepEqual([1, 2, 3, 4, 5].map(spokenNumber), [
    "一",
    "兩",
    "三",
    "四",
    "五",
  ]);
});

test("the first days serve each animal its favorite food", () => {
  for (const n of [1, 2]) {
    const level = generateLevel(n);
    assert.equal(level.customers.length, 3);
    assert.equal(level.shelf.length, 3);
    for (const { animal, order } of level.customers)
      assert.deepEqual(order, [{ food: ANIMALS[animal].likes, count: 1 }]);
    assert.deepEqual(
      [...level.shelf].sort(),
      level.customers.map((c) => ANIMALS[c.animal].likes).sort(),
    );
  }
});

test("every level is well-formed and gets harder", () => {
  for (let n = 1; n <= 100; n++) {
    const level = generateLevel(n),
      spec = levelSpec(n);
    assert.equal(level.n, n);
    assert.equal(level.customers.length, spec.customers);
    assert.equal(level.shelf.length, spec.shelf);
    assert.equal(new Set(level.shelf).size, level.shelf.length, "no repeats");
    for (const food of level.shelf) assert.ok(FOODS[food], `${n}: ${food}`);
    level.customers.forEach(({ animal, order }, i) => {
      assert.ok(ANIMALS[animal], `${n}: ${animal}`);
      assert.notEqual(
        animal,
        level.customers[i - 1]?.animal,
        `${n}: the same animal twice in a row`,
      );
      const foods = order.map((item) => item.food),
        total = order.reduce((sum, item) => sum + item.count, 0);
      assert.equal(new Set(foods).size, foods.length, `${n}: repeated kind`);
      for (const food of foods)
        assert.ok(level.shelf.includes(food), `${n}: ${food} not on shelf`);
      assert.ok(
        order.length >= spec.kinds[0] && order.length <= spec.kinds[1],
        `${n}: kinds`,
      );
      for (const item of order)
        assert.ok(item.count >= 1 && item.count <= spec.most, `${n}: count`);
      assert.ok(
        total >= Math.max(spec.items[0], order.length) &&
          total <= Math.min(spec.items[1], order.length * spec.most),
        `${n}: ${total} items`,
      );
      // Every order can be served from the shelf, one tap at a time.
      let plate = [],
        done = false;
      for (const item of order)
        for (let k = 0; k < item.count; k++)
          ({ plate, done } = serve(order, plate, item.food));
      assert.ok(done, `${n}: order can be completed`);
    });
  }
  const items = (from, to) => {
    let sum = 0,
      orders = 0;
    for (let n = from; n <= to; n++)
      for (const { order } of generateLevel(n).customers) {
        sum += order.reduce((s, item) => s + item.count, 0);
        orders++;
      }
    return sum / orders;
  };
  assert.ok(items(1, 4) < items(5, 11));
  assert.ok(items(5, 11) < items(12, 24));
  assert.ok(items(12, 24) < items(25, 60));
  const counts = [];
  for (let n = 25; n <= 60; n++)
    for (const { order } of generateLevel(n).customers)
      for (const item of order) counts.push(item.count);
  assert.equal(Math.max(...counts), 5, "later days count up to five");
});

test("a level is the same every time and callers cannot change it", () => {
  const first = generateLevel(9);
  first.customers[0].order[0].count = 99;
  first.shelf.push("pizza");
  const again = generateLevel(9);
  assert.notEqual(again.customers[0].order[0].count, 99);
  assert.deepEqual(again, generateLevel(9));
  assert.equal(again.shelf.length, levelSpec(9).shelf);
});
