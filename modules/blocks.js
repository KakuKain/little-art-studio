// 方塊出門 rules and levels. Pure logic: no DOM, so every rule is unit-tested.
//
// A level is a w × h grid with rectangular blocks and colored doors on its
// edges. A block slides one cell at a time through empty cells, in any
// direction the child drags it, and leaves the board when it is pushed out
// through a door of its own color that is at least as wide as the block.
import { seeded, shuffle } from "./random.js?v=1.0.0-beta.11";

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
    w: 3,
    h: 3,
    blocks: [{ id: "a", x: 1, y: 1, w: 1, h: 1, color: "pink" }],
    doors: [{ side: "top", at: 1, size: 1, color: "pink" }],
  },
  // 2: the yellow block is in the blue block's way; it must leave first.
  {
    w: 3,
    h: 3,
    blocks: [
      { id: "a", x: 1, y: 1, w: 1, h: 1, color: "blue" },
      { id: "b", x: 1, y: 0, w: 1, h: 1, color: "yellow" },
    ],
    doors: [
      { side: "top", at: 1, size: 1, color: "blue" },
      { side: "right", at: 0, size: 1, color: "yellow" },
    ],
  },
];

// Board size, block count, colors, chance of two-cell blocks and how many
// blocks must start without a way out. Children's levels grow slowly: 4×4
// until level 14, 5×5 until 45, then 6×6. The grown-ups' levels (大人) start
// at 6×6 and reach 8×8, with many more cats stuck at the start.
export function levelSpec(n, mode = "kids") {
  if (mode === "adult") {
    if (n <= 10)
      return { w: 6, h: 6, count: [8, 10], colors: 4, long: 0.5, blocked: 4 };
    if (n <= 30)
      return { w: 7, h: 7, count: [10, 13], colors: 5, long: 0.6, blocked: 5 };
    return { w: 8, h: 8, count: [13, 16], colors: 5, long: 0.6, blocked: 6 };
  }
  if (n <= 6)
    return { w: 4, h: 4, count: [2, 3], colors: 2, long: 0, blocked: 1 };
  if (n <= 14)
    return { w: 4, h: 4, count: [3, 4], colors: 3, long: 0.3, blocked: 1 };
  if (n <= 26)
    return { w: 5, h: 5, count: [4, 5], colors: 3, long: 0.4, blocked: 1 };
  if (n <= 45)
    return { w: 5, h: 5, count: [5, 7], colors: 4, long: 0.5, blocked: 2 };
  if (n <= 70)
    return { w: 6, h: 6, count: [6, 8], colors: 4, long: 0.5, blocked: 2 };
  return { w: 6, h: 6, count: [8, 10], colors: 5, long: 0.6, blocked: 3 };
}

function attempt(spec, rand) {
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const count =
    spec.count[0] + Math.floor(rand() * (spec.count[1] - spec.count[0] + 1));
  const palette = shuffle(COLORS, rand).slice(0, Math.min(spec.colors, count));
  const level = { w: spec.w, h: spec.h, blocks: [], doors: [] };
  for (let i = 0; i < count; i++) {
    const long = rand() < spec.long,
      wide = long && rand() < 0.5;
    const block = {
      id: String.fromCharCode(97 + i),
      w: wide ? 2 : 1,
      h: long && !wide ? 2 : 1,
      // Every chosen color is used at least once.
      color: i < palette.length ? palette[i] : pick(palette),
    };
    const cells = occupied(level, level.blocks);
    const spots = [];
    for (let y = 0; y < spec.h; y++)
      for (let x = 0; x < spec.w; x++)
        if (fits(level, cells, block, x, y)) spots.push([x, y]);
    if (!spots.length) return null;
    [block.x, block.y] = pick(spots);
    level.blocks.push(block);
  }
  for (const color of palette) {
    const own = level.blocks.filter((b) => b.color === color);
    const sides = shuffle(Object.keys(SIDES), rand);
    let placed = false;
    for (const side of sides) {
      const along = side === "top" || side === "bottom",
        length = along ? spec.w : spec.h,
        size = Math.max(...own.map((b) => (along ? b.w : b.h)));
      const free = [];
      for (let at = 0; at + size <= length; at++)
        if (
          !level.doors.some(
            (d) => d.side === side && at < d.at + d.size && d.at < at + size,
          )
        )
          free.push(at);
      if (!free.length) continue;
      level.doors.push({ side, at: pick(free), size, color });
      placed = true;
      break;
    }
    if (!placed) return null;
  }
  return level;
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
    for (let tries = 0; !level; tries++) {
      // Relax the "blocked at start" goal if a board refuses to cooperate.
      const goal = Math.max(1, spec.blocked - Math.floor(tries / 400));
      const candidate = attempt(spec, rand);
      if (candidate && exitOrder(candidate) && blockedCount(candidate) >= goal)
        level = candidate;
    }
  }
  cache.set(key, { ...level, n, mode });
  // Callers may move blocks around; never hand out the cached ones.
  return { ...level, n, mode, blocks: cloneBlocks(level.blocks) };
}
