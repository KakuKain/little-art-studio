import test from "node:test";
import assert from "node:assert/strict";
import {
  moveStep,
  dragTo,
  reachable,
  canExit,
  exitOrder,
  blockedCount,
  generateLevel,
  levelSpec,
} from "../modules/blocks.js";

const board = (blocks, doors, w = 4, h = 4) => ({ w, h, blocks, doors });
const at = (id, x, y, color = "pink", w = 1, h = 1) => ({
  id,
  x,
  y,
  w,
  h,
  color,
});

test("blocks slide into empty cells and stop at other blocks and walls", () => {
  const level = board([at("a", 0, 0), at("b", 1, 0, "blue")], []);
  assert.equal(moveStep(level, level.blocks, "a", 1, 0), null, "blocked by b");
  assert.deepEqual(moveStep(level, level.blocks, "a", 0, 1), { x: 0, y: 1 });
  assert.equal(
    moveStep(level, level.blocks, "a", -1, 0),
    null,
    "wall, no door",
  );
  assert.equal(
    moveStep(level, level.blocks, "a", 1, 1),
    null,
    "no diagonal steps",
  );
});

test("a block leaves only through a door of its color that it fits", () => {
  const doors = [
    { side: "left", at: 0, size: 1, color: "pink" },
    { side: "top", at: 2, size: 1, color: "blue" },
    { side: "right", at: 0, size: 1, color: "green" },
  ];
  const level = board(
    [at("a", 0, 0), at("b", 2, 0, "blue", 2, 1), at("c", 3, 3, "green")],
    doors,
  );
  assert.ok(moveStep(level, level.blocks, "a", -1, 0).exit, "pink door");
  assert.equal(
    moveStep(level, level.blocks, "a", 0, -1),
    null,
    "no top door here",
  );
  assert.equal(
    moveStep(level, level.blocks, "b", 0, -1),
    null,
    "a 2-wide block cannot fit a 1-wide door",
  );
  assert.equal(
    moveStep(level, level.blocks, "c", 1, 0),
    null,
    "the green door is at row 0, not row 3",
  );
});

test("dragging follows the finger, goes around corners and exits", () => {
  const level = board(
    [at("a", 0, 3), at("wall", 1, 2, "blue", 3, 1)],
    [{ side: "right", at: 0, size: 1, color: "pink" }],
  );
  // The finger goes up the left column, then right along the top row.
  let { blocks } = dragTo(level, level.blocks, "a", 0, 0);
  assert.deepEqual([blocks[0].x, blocks[0].y], [0, 0]);
  const out = dragTo(level, blocks, "a", 4.6, 0);
  assert.equal(out.exit.color, "pink");
  assert.equal(out.blocks.length, 1);
  // A straight drag into the wall stops beside it.
  ({ blocks } = dragTo(level, level.blocks, "a", 3, 3));
  assert.deepEqual([blocks[0].x, blocks[0].y], [3, 3]);
  ({ blocks } = dragTo(level, level.blocks, "a", 0, 1.2));
  assert.deepEqual([blocks[0].x, blocks[0].y], [0, 1]);
});

test("reachability and exit order respect blocking blocks", () => {
  const level = generateLevel(2);
  assert.equal(
    canExit(level, level.blocks, "a"),
    false,
    "yellow is in the way",
  );
  assert.equal(canExit(level, level.blocks, "b"), true);
  assert.deepEqual(exitOrder(level), ["b", "a"]);
  assert.ok(reachable(level, level.blocks, "b").length >= 2);
});

test("every level is solvable, well-formed and gets harder", () => {
  for (let n = 1; n <= 80; n++) {
    const level = generateLevel(n);
    const cells = new Set();
    for (const b of level.blocks) {
      assert.ok(
        b.x >= 0 && b.y >= 0 && b.x + b.w <= level.w && b.y + b.h <= level.h,
      );
      for (let y = b.y; y < b.y + b.h; y++)
        for (let x = b.x; x < b.x + b.w; x++) {
          assert.ok(!cells.has(`${x},${y}`), `level ${n}: blocks overlap`);
          cells.add(`${x},${y}`);
        }
      const fitsADoor = level.doors.some(
        (d) =>
          d.color === b.color &&
          d.size >= (d.side === "top" || d.side === "bottom" ? b.w : b.h),
      );
      assert.ok(fitsADoor, `level ${n}: block ${b.id} has no door it fits`);
    }
    for (const d of level.doors)
      for (const e of level.doors)
        if (d !== e && d.side === e.side)
          assert.ok(
            d.at + d.size <= e.at || e.at + e.size <= d.at,
            `level ${n}: doors overlap`,
          );
    assert.ok(exitOrder(level), `level ${n} must be solvable`);
    if (n >= 2)
      assert.ok(blockedCount(level) >= 1, `level ${n} needs some thinking`);
    if (n > 2) {
      const spec = levelSpec(n);
      assert.deepEqual([level.w, level.h], [spec.w, spec.h]);
    }
  }
  const average = (from, to) => {
    let sum = 0;
    for (let n = from; n <= to; n++) sum += generateLevel(n).blocks.length;
    return sum / (to - from + 1);
  };
  assert.ok(average(3, 8) < average(9, 24) && average(9, 24) < average(25, 60));
});

test("a level is the same every time and callers cannot change it", () => {
  const first = generateLevel(17);
  first.blocks[0].x = 99;
  const again = generateLevel(17);
  assert.notEqual(again.blocks[0].x, 99);
  assert.deepEqual(again, generateLevel(17));
});
