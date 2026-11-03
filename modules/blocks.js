// 方塊出門 rules and levels. Pure logic: no DOM, so every rule is unit-tested.
//
// A level is a w × h grid with rectangular blocks and colored doors on its
// edges. A block slides one cell at a time through empty cells, in any
// direction the child drags it, and leaves the board when it is pushed out
// through a door of its own color that is at least as wide as the block.
import { seeded, shuffle } from "./random.js?v=1.0.0-beta.15";

export const COLORS = ["pink", "yellow", "blue", "green", "purple"];

const SIDES = {
  top: [0, -1],
  bottom: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

export function cloneBlocks(blocks) {
  return blocks.map((block) => ({ ...block }));
}

function occupied(level, blocks, except) {
  const cells = new Uint8Array(level.w * level.h);
  for (const b of blocks)
    if (b.id !== except)
      for (let y = b.y; y < b.y + b.h; y++)
        for (let x = b.x; x < b.x + b.w; x++) cells[y * level.w + x] = 1;
  return cells;
}

function fits(level, cells, block, x, y) {
  if (x < 0 || y < 0 || x + block.w > level.w || y + block.h > level.h)
    return false;
  for (let cy = y; cy < y + block.h; cy++)
    for (let cx = x; cx < x + block.w; cx++)
      if (cells[cy * level.w + cx]) return false;
  return true;
}

// The door this block would leave through when pushed from (x, y) towards
// `side`, or null. The block must touch that edge, match the door's color
// and lie entirely within the door's span.
export function doorFor(level, block, x, y, side) {
  const along = side === "top" || side === "bottom";
  const touching =
    (side === "top" && y === 0) ||
    (side === "bottom" && y + block.h === level.h) ||
    (side === "left" && x === 0) ||
    (side === "right" && x + block.w === level.w);
  if (!touching) return null;
  const start = along ? x : y,
    size = along ? block.w : block.h;
  return (
    level.doors.find(
      (d) =>
        d.side === side &&
        d.color === block.color &&
        start >= d.at &&
        start + size <= d.at + d.size,
    ) || null
  );
}

// The door a block standing at (x, y) can leave through, on any side, or
// null. Letting go of a block here sends it out.
export function doorAt(level, block, x = block.x, y = block.y) {
  for (const side of Object.keys(SIDES)) {
    const door = doorFor(level, block, x, y, side);
    if (door) return door;
  }
  return null;
}

// One drag step by (dx, dy) ∈ {-1, 0, 1}². Returns the new position, an
// exit through a matching door, or null when the move is blocked.
export function moveStep(level, blocks, id, dx, dy) {
  const block = blocks.find((b) => b.id === id);
  if (!block || Math.abs(dx) + Math.abs(dy) !== 1) return null;
  const x = block.x + dx,
    y = block.y + dy;
  const leaving =
    x < 0 || y < 0 || x + block.w > level.w || y + block.h > level.h;
  if (leaving) {
    const side = Object.keys(SIDES).find(
      (s) => SIDES[s][0] === dx && SIDES[s][1] === dy,
    );
    const door = doorFor(level, block, block.x, block.y, side);
    return door ? { exit: true, door } : null;
  }
  return fits(level, occupied(level, blocks, id), block, x, y)
    ? { x, y }
    : null;
}

// How far (in cells) the finger must lead the block before it steps: more
// than half a cell along the way the block is going (before it has moved:
// the way the finger leads it most), more than three quarters to turn. So a
// finger that drifts sideways neither knocks the block into the next row nor
// slides a block pushed against the edge along it and out of a door beside
// it. Each step then shortens the distance to the finger, so dragTo()
// always ends (at exactly half a cell, stepping would only swing the block
// back and forth).
const STEP = 0.5,
  TURN = 0.75;

// Follows the child's finger: moves the block one cell at a time towards a
// target position (in cells, may be fractional or off the board), along the
// axis with the larger distance first and the other axis when that is
// blocked. `axis` ("x" or "y") is the way the block last moved, and comes
// back updated. Pushing a block past the edge through its door makes it
// leave; `from` is where it stood at the door, which may be a few steps
// past where it started (a block slid along the wall into its door).
export function dragTo(level, blocks, id, tx, ty, axis = null) {
  const moved = cloneBlocks(blocks),
    block = moved.find((b) => b.id === id);
  for (;;) {
    const dx = tx - block.x,
      dy = ty - block.y,
      way = axis ?? (Math.abs(dx) >= Math.abs(dy) ? "x" : "y");
    const steps = [
      ["x", Math.sign(dx), 0, Math.abs(dx)],
      ["y", 0, Math.sign(dy), Math.abs(dy)],
    ]
      .filter(([to, , , distance]) => distance > (to === way ? STEP : TURN))
      .sort((a, b) => b[3] - a[3]);
    let stepped = false;
    for (const [way, sx, sy] of steps) {
      const result = moveStep(level, moved, id, sx, sy);
      if (result?.exit)
        return {
          blocks: moved.filter((b) => b.id !== id),
          exit: result.door,
          from: { x: block.x, y: block.y },
          axis: way,
        };
      if (result) {
        block.x = result.x;
        block.y = result.y;
        axis = way;
        stepped = true;
        break;
      }
    }
    if (!stepped) return { blocks: moved, exit: null, axis };
  }
}

// Every position the block can reach with the other blocks left in place.
export function reachable(level, blocks, id) {
  const block = blocks.find((b) => b.id === id),
    cells = occupied(level, blocks, id),
    seen = new Set([block.y * level.w + block.x]),
    queue = [[block.x, block.y]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of Object.values(SIDES)) {
      const nx = x + dx,
        ny = y + dy,
        key = ny * level.w + nx;
      if (!seen.has(key) && fits(level, cells, block, nx, ny)) {
        seen.add(key);
        queue.push([nx, ny]);
      }
    }
  }
  return queue;
}

export function canExit(level, blocks, id) {
  const block = blocks.find((b) => b.id === id);
  return reachable(level, blocks, id).some(([x, y]) =>
    doorAt(level, block, x, y),
  );
}

// Removing a block only frees space, so if some block can always leave next
// the level is solvable. Levels are only accepted when this holds, which
// guarantees a child can never reach a dead end by exiting blocks.
export function exitOrder(level, blocks = level.blocks) {
  let left = cloneBlocks(blocks);
  const order = [];
  while (left.length) {
    const next = left.find((b) => canExit(level, left, b.id));
    if (!next) return null;
    order.push(next.id);
    left = left.filter((b) => b.id !== next.id);
  }
  return order;
}

export function blockedCount(level) {
  return level.blocks.filter((b) => !canExit(level, level.blocks, b.id)).length;
}

const FIRST_LEVELS = [
  // 1: drag one block out of its door.
  {
    w: 6,
    h: 6,
    blocks: [{ id: "a", x: 2, y: 3, w: 1, h: 1, color: "pink" }],
    doors: [{ side: "top", at: 2, size: 1, color: "pink" }],
  },
  // 2: the yellow block is in the blue block's way; it must leave first.
  {
    w: 6,
    h: 6,
    blocks: [
      { id: "a", x: 2, y: 3, w: 1, h: 1, color: "blue" },
      { id: "b", x: 2, y: 0, w: 1, h: 1, color: "yellow" },
    ],
    doors: [
      { side: "top", at: 2, size: 1, color: "blue" },
      { side: "right", at: 0, size: 1, color: "yellow" },
    ],
  },
];

// Board size, block count, colors, chance of two-cell blocks and how deep
// the chain of "this cat must leave first" should run (fewest, most).
// Children's boards are 6×6 with a few cats, more of them and longer chains
// as the levels go on. The grown-ups' (大人) are 8×8 and packed: `fill` is
// the share of cells the cats cover, from three quarters to nine tenths.
export function levelSpec(n, mode = "kids") {
  if (mode === "adult")
    return {
      w: 8,
      h: 8,
      fill: n <= 10 ? 0.75 : n <= 30 ? 0.8 : n <= 60 ? 0.85 : 0.9,
      colors: 5,
      long: 0.6,
      depth: [n <= 10 ? 6 : n <= 30 ? 7 : 8, 99],
    };
  const board = { w: 6, h: 6 };
  if (n <= 6)
    return { ...board, count: [3, 4], colors: 2, long: 0, depth: [2, 2] };
  if (n <= 14)
    return { ...board, count: [4, 5], colors: 3, long: 0.3, depth: [2, 3] };
  if (n <= 26)
    return { ...board, count: [5, 6], colors: 3, long: 0.4, depth: [3, 3] };
  if (n <= 45)
    return { ...board, count: [6, 8], colors: 4, long: 0.5, depth: [3, 4] };
  if (n <= 70)
    return { ...board, count: [7, 9], colors: 4, long: 0.5, depth: [4, 5] };
  return { ...board, count: [8, 10], colors: 5, long: 0.6, depth: [5, 6] };
}

// How many rounds it takes if every cat that can leave does so at once:
// the length of the longest "must leave first" chain.
export function depthOf(level) {
  let left = cloneBlocks(level.blocks),
    rounds = 0;
  while (left.length) {
    const free = left.filter((b) => canExit(level, left, b.id));
    if (!free.length) return Infinity;
    left = left.filter((b) => !free.includes(b));
    rounds++;
  }
  return rounds;
}

// How many cats on average could leave at each step, letting the first one
// that can go each time.
function choices(level) {
  let left = cloneBlocks(level.blocks),
    sum = 0;
  while (left.length) {
    const free = left.filter((b) => canExit(level, left, b.id));
    sum += free.length;
    left = left.filter((b) => b !== free[0]);
  }
  return sum / level.blocks.length;
}

// A board is built backwards: its doors first, then the cats in the reverse
// of the order they can leave. Each new cat must be able to leave past the
// cats already there, which keeps the board solvable, and is put where it
// blocks as many of them as it can, which makes the chains long.
// A door of each color, one or two cells wide, where no other door is.
function placeDoors(level, palette, spec, rand) {
  const pick = (list) => list[Math.floor(rand() * list.length)];
  for (const color of palette) {
    const size = spec.long && rand() < 0.6 ? 2 : 1;
    const spots = [];
    for (const side of Object.keys(SIDES)) {
      const length = side === "top" || side === "bottom" ? spec.w : spec.h;
      for (let at = 0; at + size <= length; at++)
        if (
          !level.doors.some(
            (d) => d.side === side && at < d.at + d.size && d.at < at + size,
          )
        )
          spots.push([side, at]);
    }
    const [side, at] = pick(spots);
    level.doors.push({ side, at, size, color });
  }
}
function build(spec, rand) {
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const count =
    spec.count[0] + Math.floor(rand() * (spec.count[1] - spec.count[0] + 1));
  const palette = shuffle(COLORS, rand).slice(0, Math.min(spec.colors, count));
  const level = { w: spec.w, h: spec.h, blocks: [], doors: [] };
  placeDoors(level, palette, spec, rand);
  for (let i = 0; i < count; i++) {
    const free = level.blocks.filter((b) => canExit(level, level.blocks, b.id));
    let best = null,
      most = -1;
    for (let tries = 0; tries < 30 && most < 2; tries++) {
      const long = rand() < spec.long,
        wide = long && rand() < 0.5;
      const block = {
        id: String.fromCharCode(97 + i),
        w: wide ? 2 : 1,
        h: long && !wide ? 2 : 1,
        // Every chosen color is used at least once.
        color: i < palette.length ? palette[i] : pick(palette),
      };
      const cells = occupied(level, level.blocks),
        spots = [];
      for (let y = 0; y < spec.h; y++)
        for (let x = 0; x < spec.w; x++)
          if (fits(level, cells, block, x, y)) spots.push([x, y]);
      if (!spots.length) continue;
      [block.x, block.y] = pick(spots);
      const blocks = [...level.blocks, block];
      if (!canExit(level, blocks, block.id)) continue;
      const blocked = free.filter((b) => !canExit(level, blocks, b.id)).length;
      if (blocked > most) [best, most] = [block, blocked];
    }
    if (!best) return null;
    level.blocks.push(best);
  }
  return level;
}

// A packed board can't be built that way: once a cat sits in front of a
// door, no cat placed after it could leave by that door. So it is filled
// first and colored after. Cats of random shapes cover `fill` of the cells;
// then, again and again, one cat that can reach a door past the cats still
// there is taken out and gets that door's color. Taking them out in that
// order clears the board, so it is solvable. When no cat can reach a door,
// one in front of a door is left out of the board, to make room.
function pack(spec, rand) {
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const palette = shuffle(COLORS, rand).slice(0, spec.colors);
  const level = { w: spec.w, h: spec.h, blocks: [], doors: [] };
  placeDoors(level, palette, spec, rand);
  const cells = new Uint8Array(spec.w * spec.h),
    room = Math.round(spec.fill * spec.w * spec.h);
  let filled = 0;
  for (const at of shuffle([...cells.keys()], rand)) {
    if (filled >= room) break;
    const long = rand() < spec.long,
      wide = long && rand() < 0.5;
    let block = { x: at % spec.w, y: Math.floor(at / spec.w), w: 1, h: 1 };
    if (
      long &&
      fits(level, cells, { w: wide ? 2 : 1, h: wide ? 1 : 2 }, block.x, block.y)
    )
      block = { ...block, w: wide ? 2 : 1, h: wide ? 1 : 2 };
    else if (!fits(level, cells, block, block.x, block.y)) continue;
    for (let y = block.y; y < block.y + block.h; y++)
      for (let x = block.x; x < block.x + block.w; x++)
        cells[y * spec.w + x] = 1;
    filled += block.w * block.h;
    block.id = String.fromCharCode(97 + (level.blocks.length % 26));
    if (level.blocks.length >= 26) block.id += level.blocks.length;
    level.blocks.push(block);
  }
  // Every cat gets the color of a door it can reach once the cats before it
  // have gone: the first in a shuffled order that can reach one, and of the
  // doors it can reach, the one with the fewest cats so far, so every color
  // gets its share.
  const share = new Map(level.doors.map((d) => [d, 0]));
  let left = [...level.blocks];
  while (left.length) {
    let found = null;
    for (const block of shuffle(left, rand)) {
      const spots = reachable(level, left, block.id),
        doors = level.doors.filter((door) =>
          spots.some(([x, y]) =>
            doorFor(level, { ...block, color: door.color }, x, y, door.side),
          ),
        );
      if (doors.length) {
        const fewest = Math.min(...doors.map((d) => share.get(d)));
        found = [block, pick(doors.filter((d) => share.get(d) === fewest))];
        break;
      }
    }
    if (!found) {
      const blocking = left.filter((b) =>
          level.doors.some((d) => inFront(level, b, d)),
        ),
        out = pick(blocking.length ? blocking : left);
      level.blocks = level.blocks.filter((b) => b !== out);
      left = left.filter((b) => b !== out);
      continue;
    }
    const [block, door] = found;
    block.color = door.color;
    share.set(door, share.get(door) + 1);
    left = left.filter((b) => b !== block);
  }
  // A door no cat came out of would only puzzle the player.
  level.doors = level.doors.filter((d) =>
    level.blocks.some((b) => b.color === d.color),
  );
  return level;
}
// Whether a block stands against the edge in front of a door, even partly.
function inFront(level, block, door) {
  const along = door.side === "top" || door.side === "bottom",
    start = along ? block.x : block.y,
    size = along ? block.w : block.h,
    edge =
      door.side === "top"
        ? block.y === 0
        : door.side === "bottom"
          ? block.y + block.h === level.h
          : door.side === "left"
            ? block.x === 0
            : block.x + block.w === level.w;
  return edge && start < door.at + door.size && door.at < start + size;
}

// Level n of the children's ("kids") or the grown-ups' ("adult") levels.
const cache = new Map();
export function generateLevel(n, mode = "kids") {
  const key = `${mode}:${n}`;
  let level = cache.get(key) || (mode === "kids" && FIRST_LEVELS[n - 1]);
  if (!level) {
    const spec = levelSpec(n, mode),
      rand = seeded(
        Math.imul(n, 2654435761) ^ (mode === "adult" ? 0x2c1b3c6d : 0x5bd1e995),
      );
    // Of a few boards, one whose chain is as deep as asked and that leaves
    // few cats to choose from along the way.
    let best = null,
      score = -Infinity;
    // A packed board takes longer to make and is hard anyway: fewer tries.
    const make = spec.fill ? pack : build,
      boards = spec.fill ? 5 : 12;
    for (let tries = 0; tries < boards && score < 997.5; tries++) {
      const candidate = make(spec, rand);
      if (!candidate) continue;
      const depth = depthOf(candidate),
        [fewest, most] = spec.depth,
        off = depth < fewest ? fewest - depth : Math.max(0, depth - most),
        value = (off ? -10 * off : 1000) - choices(candidate);
      if (value > score) [best, score] = [candidate, value];
    }
    // A crowded board can refuse a few times; keep going until one fits.
    while (!best) best = make(spec, rand);
    level = best;
  }
  cache.set(key, { ...level, n, mode });
  // Callers may move blocks around; never hand out the cached ones.
  return { ...level, n, mode, blocks: cloneBlocks(level.blocks) };
}
