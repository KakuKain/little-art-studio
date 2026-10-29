// 動物餐廳 rules and levels. Pure logic: no DOM, so every rule is unit-tested.
//
// A level is one day at the restaurant: a shelf of foods and a line of animal
// customers. Each customer orders one to three kinds of food from the shelf,
// up to five of a kind, and the child taps foods to serve them. A food the
// customer didn't order, or one too many, is simply not taken, so there is
// nothing to lose: no timer, no wrong answers that count.
import { seeded, shuffle } from "./random.js?v=1.0.0-beta.7";

// Each food and animal has a picture named after its id in
// assets/games/restaurant/. The unit is the measure word a child would hear:
// 兩根香蕉, 一杯牛奶.
export const FOODS = {
  apple: { name: "蘋果", unit: "顆" },
  banana: { name: "香蕉", unit: "根" },
  grapes: { name: "葡萄", unit: "串" },
  strawberry: { name: "草莓", unit: "顆" },
  watermelon: { name: "西瓜", unit: "片" },
  carrot: { name: "紅蘿蔔", unit: "根" },
  corn: { name: "玉米", unit: "根" },
  cookie: { name: "餅乾", unit: "塊" },
  donut: { name: "甜甜圈", unit: "個" },
  cake: { name: "蛋糕", unit: "塊" },
  pizza: { name: "披薩", unit: "片" },
  burger: { name: "漢堡", unit: "個" },
  fries: { name: "薯條", unit: "份" },
  icecream: { name: "冰淇淋", unit: "支" },
  riceball: { name: "飯糰", unit: "個" },
  milk: { name: "牛奶", unit: "杯" },
  bread: { name: "麵包", unit: "個" },
  cheese: { name: "起司", unit: "塊" },
  honey: { name: "蜂蜜", unit: "罐" },
  fish: { name: "魚", unit: "條" },
};

// Some animals have a favorite food; the first days only serve those, so
// the very first orders make sense without reading anything.
export const ANIMALS = {
  rabbit: { name: "小兔子", likes: "carrot" },
  monkey: { name: "小猴子", likes: "banana" },
  mouse: { name: "小老鼠", likes: "cheese" },
  bear: { name: "小熊", likes: "honey" },
  cat: { name: "小貓", likes: "fish" },
  chick: { name: "小雞", likes: "corn" },
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

// How many of `food` the customer still wants, given what is on the plate.
export function stillWanted(order, plate, food) {
  const wanted = order.find((item) => item.food === food)?.count ?? 0;
  return wanted - plate.filter((f) => f === food).length;
}
export function orderDone(order, plate) {
  return order.every((item) => stillWanted(order, plate, item.food) === 0);
}
// Serving a food the customer still wants puts it on the plate; anything else
// is handed back. Returns the new plate, whether it was taken, and whether
// the order is complete.
export function serve(order, plate, food) {
  if (stillWanted(order, plate, food) <= 0)
    return { plate, taken: false, done: orderDone(order, plate) };
  const next = [...plate, food];
  return { plate: next, taken: true, done: orderDone(order, next) };
}

// 「2 顆蘋果和 1 根香蕉」, for screen readers, or spoken aloud as
// 「兩顆蘋果和一根香蕉」, the way a voice should read it.
const SPOKEN = ["零", "一", "兩", "三", "四", "五"];
export function describeOrder(order, { spoken = false } = {}) {
  const parts = order.map(({ food, count }) =>
    spoken
      ? `${SPOKEN[count]}${FOODS[food].unit}${FOODS[food].name}`
      : `${count} ${FOODS[food].unit}${FOODS[food].name}`,
  );
  return parts.length > 1
    ? `${parts.slice(0, -1).join("、")}和${spoken ? "" : " "}${parts.at(-1)}`
    : parts[0];
}

// Customers per day, shelf size, kinds of food per order, total items per
// order and the most of one kind. Counting goes up to five.
export function levelSpec(n) {
  if (n <= 2)
    return {
      customers: 3,
      shelf: 3,
      kinds: [1, 1],
      items: [1, 1],
      most: 1,
      favorites: true,
    };
  if (n <= 4)
    return { customers: 4, shelf: 4, kinds: [1, 1], items: [1, 2], most: 2 };
  if (n <= 7)
    return { customers: 4, shelf: 4, kinds: [1, 2], items: [1, 3], most: 2 };
  if (n <= 11)
    return { customers: 5, shelf: 5, kinds: [1, 2], items: [2, 4], most: 3 };
  if (n <= 16)
    return { customers: 5, shelf: 6, kinds: [2, 3], items: [3, 5], most: 3 };
  if (n <= 24)
    return { customers: 5, shelf: 6, kinds: [1, 3], items: [3, 6], most: 4 };
  return { customers: 5, shelf: 8, kinds: [1, 3], items: [4, 7], most: 5 };
}

function between([min, max], rand) {
  return min + Math.floor(rand() * (max - min + 1));
}
function makeOrder(spec, shelf, animal, rand) {
  const kinds = between(spec.kinds, rand),
    foods = shuffle(shelf, rand).slice(0, kinds),
    likes = ANIMALS[animal].likes;
  // An animal whose favorite is on the shelf usually orders it.
  if (likes && shelf.includes(likes) && !foods.includes(likes) && rand() < 0.6)
    foods[0] = likes;
  const total = Math.min(
      Math.max(between(spec.items, rand), kinds),
      kinds * spec.most,
    ),
    counts = foods.map(() => 1);
  for (let extra = total - kinds; extra > 0; extra--) {
    const open = counts.flatMap((c, i) => (c < spec.most ? [i] : []));
    counts[open[Math.floor(rand() * open.length)]]++;
  }
  return foods.map((food, i) => ({ food, count: counts[i] }));
}

const cache = new Map();
export function generateLevel(n) {
  let level = cache.get(n);
  if (!level) {
    const spec = levelSpec(n),
      rand = seeded(Math.imul(n, 2246822519) ^ 0x2545f491);
    let shelf, customers;
    if (spec.favorites) {
      const fans = shuffle(
        Object.keys(ANIMALS).filter((id) => ANIMALS[id].likes),
        rand,
      ).slice(0, spec.customers);
      shelf = shuffle(
        fans.map((id) => ANIMALS[id].likes),
        rand,
      );
      customers = fans.map((animal) => ({
        animal,
        order: [{ food: ANIMALS[animal].likes, count: 1 }],
      }));
    } else {
      shelf = shuffle(Object.keys(FOODS), rand).slice(0, spec.shelf);
      customers = [];
      const animals = Object.keys(ANIMALS);
      for (let i = 0; i < spec.customers; i++) {
        // Never the same animal twice in a row: it would look like nothing
        // happened after serving it.
        const choices = animals.filter((a) => a !== customers.at(-1)?.animal),
          animal = choices[Math.floor(rand() * choices.length)];
        customers.push({ animal, order: makeOrder(spec, shelf, animal, rand) });
      }
    }
    level = { n, shelf, customers };
    cache.set(n, level);
  }
  // Never hand out the cached orders.
  return structuredClone(level);
}
