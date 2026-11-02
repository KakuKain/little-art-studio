import test from "node:test";
import assert from "node:assert/strict";
import {
  BAR,
  BARS,
  CHORDS,
  DEFAULT_VOLUME,
  frequency,
  musicVolume,
  score,
} from "../modules/music.js";

test("every bar of the waltz is full and the tune comes home to C", () => {
  const { notes, length } = score();
  assert.equal(length, BARS.length * BAR);
  for (let bar = 0; bar < BARS.length; bar++) {
    const melody = notes.filter(
      (n) => n.voice === "melody" && Math.floor(n.at / BAR) === bar,
    );
    assert.equal(
      melody.reduce((sum, n) => sum + n.length, 0),
      BAR,
      `bar ${bar + 1}`,
    );
    for (const n of melody)
      assert.ok(n.at + n.length <= (bar + 1) * BAR, `bar ${bar + 1} overflows`);
    assert.ok(CHORDS[BARS[bar][0]], `bar ${bar + 1}: unknown chord`);
  }
  assert.deepEqual(BARS.at(-1), ["C", "C5 6"]);
  assert.ok(notes.every((n, i) => i === 0 || notes[i - 1].at <= n.at));
});

test("notes are tuned to A 440", () => {
  assert.equal(frequency("A4"), 440);
  assert.ok(Math.abs(frequency("C4") - 261.63) < 0.01);
  assert.equal(frequency("A5"), 880);
});

test("the volume is kept between 0 and 100", () => {
  const saved = new Map();
  globalThis.localStorage = {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, String(value)),
  };
  try {
    assert.equal(musicVolume(), DEFAULT_VOLUME);
    for (const [stored, volume] of [
      ["0", 0],
      ["70", 70],
      ["250", 100],
      ["-5", 0],
      ["loud", DEFAULT_VOLUME],
    ]) {
      saved.set("little-playground.music", stored);
      assert.equal(musicVolume(), volume, stored);
    }
  } finally {
    delete globalThis.localStorage;
  }
  assert.equal(musicVolume(), DEFAULT_VOLUME, "without storage");
});
