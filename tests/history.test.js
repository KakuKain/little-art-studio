import test from "node:test";
import assert from "node:assert/strict";
import {
  createWork,
  record,
  moveCursor,
  canUndo,
  canRedo,
  addCheckpoint,
  replayStart,
} from "../modules/history.js";
test("history stays on its own work and branches after undo", () => {
  const a = createWork("anna-simple"),
    b = createWork("kitty");
  record(a, { type: "fill", region: "sky", color: "pink" });
  record(a, { type: "clear" });
  assert.ok(moveCursor(a, -1));
  assert.ok(canRedo(a));
  assert.equal(b.cursor, 0);
  record(a, { type: "fill", region: "group:cape", color: "orange" });
  assert.ok(!canRedo(a));
  assert.equal(a.actions.at(-1).region, "group:cape");
  assert.equal(a.scene, "anna-simple");
});
test("checkpoint compaction preserves the full undo window and current image", () => {
  const work = createWork("kitty");
  for (let i = 1; i <= 40; i++) {
    record(work, { type: "fill", region: "sky", color: String(i) });
    if (i % 20 === 0)
      addCheckpoint(work, {
        scene: "kitty",
        fills: [["sky", String(i)]],
        pixels: new Blob([String(i)]),
      });
  }
  assert.equal(work.actions.length, 20);
  assert.equal(work.cursor, 20);
  assert.equal(work.base.fills[0][1], "20");
  assert.equal(replayStart(work).cursor, 20);
  for (let i = 0; i < 20; i++) assert.ok(moveCursor(work, -1));
  assert.ok(!canUndo(work));
  assert.equal(replayStart(work).state.fills[0][1], "20");
  for (let i = 0; i < 20; i++) assert.ok(moveCursor(work, 1));
  assert.equal(replayStart(work).state.fills[0][1], "40");
});
test("replacement strokes cannot resurrect a discarded checkpoint", () => {
  const work = createWork("kitty");
  for (let i = 0; i < 20; i++) record(work, { type: "clear" });
  addCheckpoint(work, { scene: "kitty", fills: [], pixels: new Blob(["old"]) });
  moveCursor(work, -1);
  record(work, { type: "fill", region: "sky", color: "blue" });
  assert.equal(work.checkpoints.length, 0);
  assert.equal(replayStart(work).cursor, 0);
});
