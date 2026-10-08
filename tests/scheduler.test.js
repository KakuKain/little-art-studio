import test from "node:test";
import assert from "node:assert/strict";
import { createScheduler } from "../modules/scheduler.js";

function deferred() {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
}

test("undo taps made during a replay join it instead of being dropped", async () => {
  const scheduler = createScheduler(),
    counts = [],
    gate = deferred();
  scheduler.onTravel(async (count) => {
    counts.push(count);
    if (counts.length === 1) await gate.promise;
  });
  const first = scheduler.travel(-1);
  scheduler.travel(-1);
  scheduler.travel(-1);
  assert.equal(scheduler.busy, true);
  gate.resolve();
  await first;
  assert.deepEqual(counts, [-1, -2]);
  assert.equal(scheduler.busy, false);
});

test("a user task drops other taps instead of running them late", async () => {
  const scheduler = createScheduler(),
    gate = deferred(),
    ran = [];
  scheduler.onTravel(async (count) => ran.push(count));
  const first = scheduler.run(async () => {
    ran.push("open");
    await gate.promise;
  });
  assert.equal(await scheduler.run(async () => ran.push("second")), false);
  scheduler.travel(-1);
  gate.resolve();
  assert.equal(await first, true);
  assert.deepEqual(ran, ["open"]);
});

test("a refit requested while busy runs afterwards, once per settled size", async () => {
  const scheduler = createScheduler(),
    gate = deferred();
  let refits = 0;
  scheduler.onRefit(async () => {
    refits++;
  });
  scheduler.onTravel(() => gate.promise);
  const travel = scheduler.travel(1);
  scheduler.refit();
  scheduler.refit();
  assert.equal(refits, 0);
  gate.resolve();
  await travel;
  assert.equal(refits, 1);
  await scheduler.run(async () => {});
  assert.equal(refits, 2, "every user task re-checks the layout");
});

test("errors are reported and never leave the editor locked", async () => {
  const errors = [];
  const scheduler = createScheduler({ onError: (e) => errors.push(e.message) });
  scheduler.onTravel(async () => {
    throw new Error("replay failed");
  });
  await scheduler.travel(-1);
  assert.deepEqual(errors, ["replay failed"]);
  assert.equal(scheduler.busy, false);
  assert.equal(await scheduler.run(async () => {}), true);
});

test("nothing starts while a stroke blocks the editor", async () => {
  let blocked = true,
    travels = 0;
  const scheduler = createScheduler({ blocked: () => blocked });
  scheduler.onTravel(async () => travels++);
  assert.equal(await scheduler.run(async () => {}), false);
  await scheduler.travel(-1);
  blocked = false;
  await scheduler.drain();
  assert.equal(travels, 0, "taps during a stroke are not replayed afterwards");
});
