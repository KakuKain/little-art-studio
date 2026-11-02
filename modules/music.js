// Soft background music, made in the browser like the sounds: a music box
// plays a little waltz over a quiet broken-chord accompaniment, round and
// round. Browsers play nothing before the child's first touch, so it starts
// then, and it rests while the app is hidden. Parents set its volume in the
// about dialog, where 0 turns it off; the volume is kept on this device.
import { audioContext } from "./sound.js?v=1.0.0-beta.13";

const KEY = "little-playground.music";
export const DEFAULT_VOLUME = 50;
// Three beats to a bar at 88 beats a minute; times below are in eighths.
const EIGHTH = 60 / 88 / 2;
export const BAR = 6;

// The waltz in C, one bar a line: its chord, then the music box's notes,
// each with its length in eighths.
export const BARS = [
  ["C", "G4 2 C5 2 E5 2"],
  ["G", "D5 4 B4 2"],
  ["Am", "C5 2 E5 2 A5 2"],
  ["Em", "G5 4 E5 2"],
  ["F", "F5 2 E5 2 D5 2"],
  ["C", "E5 2 C5 2 G4 2"],
  ["F", "A4 2 C5 2 D5 2"],
  ["G", "D5 6"],
  ["C", "G4 2 C5 2 E5 2"],
  ["G", "D5 4 B4 2"],
  ["Am", "C5 2 E5 2 A5 2"],
  ["Em", "G5 4 E5 2"],
  ["F", "A5 2 G5 2 F5 2"],
  ["C", "E5 2 G5 2 C5 2"],
  ["G", "D5 4 B4 2"],
  ["C", "C5 6"],
  ["F", "A5 3 G5 1 F5 2"],
  ["C", "E5 3 D5 1 C5 2"],
  ["Dm", "D5 2 F5 2 A5 2"],
  ["G", "G5 6"],
  ["F", "A5 3 G5 1 F5 2"],
  ["C", "E5 2 G5 2 C6 2"],
  ["G", "B5 2 G5 2 D5 2"],
  ["C", "C5 6"],
];
// A chord is broken over the bar's three beats: its root, then two more of
// its notes; a soft bass an octave below the root holds the bar.
export const CHORDS = {
  C: ["C3", "G3", "E4"],
  Dm: ["D3", "A3", "F4"],
  Em: ["E3", "B3", "G4"],
  F: ["F3", "C4", "A3"],
  G: ["G3", "D4", "B3"],
  Am: ["A3", "E4", "C4"],
};
const SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function frequency(name) {
  const [, letter, octave] = /^([A-G])(\d)$/.exec(name);
  const midi = SEMITONES[letter] + 12 * (Number(octave) + 1);
  return 440 * 2 ** ((midi - 69) / 12);
}
const lower = (name) => name[0] + (Number(name[1]) - 1);

// Every note of the tune, sorted by when it starts, and the tune's length.
export function score() {
  const notes = [];
  BARS.forEach(([chord, melody], bar) => {
    const start = bar * BAR,
      parts = melody.split(" ");
    for (let i = 0, at = start; i < parts.length; i += 2) {
      const length = Number(parts[i + 1]);
      notes.push({ voice: "melody", note: parts[i], at, length });
      at += length;
    }
    CHORDS[chord].forEach((note, i) =>
      notes.push({ voice: "chord", note, at: start + i * 2, length: 2 }),
    );
    notes.push({
      voice: "bass",
      note: lower(CHORDS[chord][0]),
      at: start,
      length: BAR,
    });
  });
  return {
    notes: notes.sort((a, b) => a.at - b.at),
    length: BARS.length * BAR,
  };
}

export function musicVolume() {
  try {
    const saved = localStorage.getItem(KEY),
      volume = saved === null ? DEFAULT_VOLUME : Number(saved);
    return Number.isFinite(volume)
      ? Math.min(100, Math.max(0, Math.round(volume)))
      : DEFAULT_VOLUME;
  } catch {
    return DEFAULT_VOLUME;
  }
}
// The slider is even to the ear: the gain grows with the square of it.
const gainFor = (volume) => (volume / 100) ** 2;

// Each voice: its wave, how loud it starts and how long it rings. The music
// box adds a short bright ting two octaves up, and echoes.
const VOICES = {
  melody: { type: "sine", loud: 0.22, ring: 1.6, ting: 0.05, echo: true },
  chord: { type: "triangle", loud: 0.08, ring: 1.1 },
  bass: { type: "sine", loud: 0.08, ring: 2 },
};
const tune = score();
let ac = null,
  master = null,
  echo = null,
  timer = 0,
  index = 0,
  loopStart = 0;

function connect() {
  ac = audioContext();
  if (!ac) return false;
  master = ac.createGain();
  master.gain.value = 0;
  master.connect(ac.destination);
  // A soft echo: a delay that feeds back through a gentle low-pass.
  echo = ac.createGain();
  const delay = ac.createDelay(1),
    tone = ac.createBiquadFilter(),
    feedback = ac.createGain(),
    wet = ac.createGain();
  delay.delayTime.value = EIGHTH * 1.5;
  tone.type = "lowpass";
  tone.frequency.value = 2400;
  feedback.gain.value = 0.3;
  wet.gain.value = 0.3;
  echo.connect(delay).connect(tone).connect(feedback).connect(delay);
  tone.connect(wet).connect(master);
  return true;
}
function ring(type, hz, start, loud, length, echoed) {
  const osc = ac.createOscillator(),
    gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = hz;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(loud, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(master);
  if (echoed) gain.connect(echo);
  osc.start(start);
  osc.stop(start + length + 0.05);
}
function play({ voice, note }, start) {
  const v = VOICES[voice],
    hz = frequency(note);
  ring(v.type, hz, start, v.loud, v.ring, v.echo);
  if (v.ting) ring("sine", hz * 4, start, v.ting, 0.15, v.echo);
}
const startOf = (i) => loopStart + tune.notes[i].at * EIGHTH;
// Notes are scheduled a little ahead, so a busy moment never stutters. After
// a longer stall the tune carries on from where it was rather than rushing
// the missed notes.
function tick() {
  if (ac.state !== "running") return;
  const now = ac.currentTime;
  if (startOf(index) < now) loopStart += now + 0.1 - startOf(index);
  while (startOf(index) < now + 0.6) {
    play(tune.notes[index], startOf(index));
    if (++index === tune.notes.length) {
      index = 0;
      loopStart += tune.length * EIGHTH;
    }
  }
}

function start() {
  if (timer || document.hidden || !musicVolume()) return;
  if (!master && !connect()) return;
  if (ac.state === "suspended") ac.resume();
  master.gain.cancelScheduledValues(ac.currentTime);
  master.gain.setTargetAtTime(gainFor(musicVolume()), ac.currentTime, 0.05);
  index = 0;
  loopStart = ac.currentTime + 0.1;
  timer = setInterval(tick, 200);
  tick();
}
function stop() {
  if (!timer) return;
  clearInterval(timer);
  timer = 0;
  master.gain.cancelScheduledValues(ac.currentTime);
  master.gain.setTargetAtTime(0, ac.currentTime, 0.08);
}

export function setMusicVolume(volume) {
  try {
    localStorage.setItem(KEY, String(volume));
  } catch {
    // Without storage the volume lasts until the page closes.
  }
  if (!volume) return stop();
  if (!timer) return start();
  master.gain.cancelScheduledValues(ac.currentTime);
  master.gain.setTargetAtTime(gainFor(volume), ac.currentTime, 0.05);
}

// Every touch or key may start the music, or wake it after the system
// paused the audio; while the app is hidden it is suspended.
export function installMusic() {
  for (const type of ["pointerup", "keydown"])
    document.addEventListener(
      type,
      () => {
        start();
        if (timer && ac.state !== "running") ac.resume();
      },
      { capture: true },
    );
  document.addEventListener("visibilitychange", () => {
    if (!ac) return;
    if (document.hidden) ac.suspend();
    else if (timer) ac.resume();
  });
}
