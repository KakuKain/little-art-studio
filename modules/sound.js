// Sounds and speech for the games, made in the browser: there are no sound
// files to download, and the browser plays nothing before the child's
// first touch. Parents turn it all off in the about dialog; the choice is
// kept on this device.
const KEY = "little-playground.sound";
let context = null;

export function soundOn() {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}
export function setSoundOn(on) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Without storage the choice lasts until the page closes.
  }
  if (!on && "speechSynthesis" in window) speechSynthesis.cancel();
}

function audio() {
  if (!soundOn() || typeof AudioContext === "undefined") return null;
  context ??= new AudioContext();
  if (context.state === "suspended") context.resume();
  return context;
}
// One note that slides from `from` to `to` hertz, fading in and out so it
// never clicks.
function note(ac, { type = "sine", from, to = from, at = 0, length, loud }) {
  const start = ac.currentTime + at,
    osc = ac.createOscillator(),
    gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(to, start + length);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(loud, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + length + 0.02);
}

export const sounds = {
  // A food lands in the order.
  pop() {
    const ac = audio();
    if (ac) note(ac, { from: 520, to: 980, length: 0.12, loud: 0.2 });
  },
  // A food nobody ordered: a soft low bump, never a buzzer.
  bump() {
    const ac = audio();
    if (ac)
      note(ac, {
        type: "triangle",
        from: 220,
        to: 170,
        length: 0.15,
        loud: 0.12,
      });
  },
  // The canvas is cleared: a soft falling swish.
  swish() {
    const ac = audio();
    if (ac)
      note(ac, {
        type: "triangle",
        from: 900,
        to: 180,
        length: 0.28,
        loud: 0.12,
      });
  },
  // A cat gets home: a buzzy tone whose pitch and brightness rise and fall
  // like a meow.
  meow() {
    const ac = audio();
    if (!ac) return;
    const t = ac.currentTime,
      osc = ac.createOscillator(),
      filter = ac.createBiquadFilter(),
      gain = ac.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(620, t);
    osc.frequency.linearRampToValueAtTime(920, t + 0.12);
    osc.frequency.linearRampToValueAtTime(560, t + 0.42);
    filter.type = "bandpass";
    filter.Q.value = 3;
    filter.frequency.setValueAtTime(900, t);
    filter.frequency.linearRampToValueAtTime(1900, t + 0.12);
    filter.frequency.linearRampToValueAtTime(800, t + 0.42);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    osc.connect(filter).connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.5);
  },
  // A level is cleared: four rising notes.
  cheer() {
    const ac = audio();
    if (!ac) return;
    [523, 659, 784, 1047].forEach((from, i) =>
      note(ac, {
        type: "triangle",
        from,
        at: i * 0.11,
        length: i === 3 ? 0.45 : 0.14,
        loud: 0.18,
      }),
    );
  },
};

// Speaks Mandarin with a Chinese voice. A device without one stays quiet
// rather than read Chinese with another language's voice; while the voice
// list is still loading, the browser picks a voice for zh-TW itself.
export function say(text) {
  if (!soundOn() || !("speechSynthesis" in window)) return;
  const voices = speechSynthesis.getVoices(),
    voice =
      voices.find((v) => /^zh[-_]TW/i.test(v.lang)) ||
      voices.find((v) => /^(zh|cmn)/i.test(v.lang) && !/HK|yue/i.test(v.lang));
  if (voices.length && !voice) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = voice?.lang || "zh-TW";
  if (voice) utterance.voice = voice;
  utterance.rate = 0.9;
  utterance.pitch = 1.2;
  speechSynthesis.speak(utterance);
}
export function hush() {
  if ("speechSynthesis" in window) speechSynthesis.cancel();
}
// Chrome fills the voice list only after it is first asked for.
if (typeof speechSynthesis !== "undefined") speechSynthesis.getVoices();
