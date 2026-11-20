// AudioWorklet source, loaded from a Blob URL so it needs no separate build step.
//
// It reports a "strum" each time the mic's loudness jumps clearly above its recent
// peak, and posts a loudness reading every ~20 ms.
//
// How it listens:
// - In three bands (bass, middle, bright). When a chord is still ringing, its low
//   notes stay loud for a long time, so a new strum on top, especially a softer
//   upstroke, barely changes the overall loudness. But the bright part of a strum
//   (pick on strings, fresh upper harmonics) dies away within a moment, so every
//   new strum makes the bright band jump.
// - Against the held peak of a moment ago, per band. Ringing strings wobble and beat against each other;
//   that stays under the remembered peak, so it doesn't count as a new strum.
// - Deaf to the game's own metronome. The click is a narrow tone at CLICK_HZ, above
//   the bright band; a steep low-pass plus a notch at that exact pitch remove it, so
//   a click coming out of the speakers can't be mistaken for a strum.
export const DETECTOR_CUTOFF_HZ = 4000;
export const CLICK_HZ = 6500;

export const onsetWorkletSource = /* js */ `
const CUTOFF = ${DETECTOR_CUTOFF_HZ};
const CLICK_HZ = ${CLICK_HZ};

function biquad(type, freq, q) {
  const w0 = 2 * Math.PI * freq / sampleRate, cos = Math.cos(w0), alpha = Math.sin(w0) / (2 * q), a0 = 1 + alpha;
  const tail = { a1: -2 * cos / a0, a2: (1 - alpha) / a0, z1: 0, z2: 0 };
  if (type === 'notch') return { b0: 1 / a0, b1: -2 * cos / a0, b2: 1 / a0, ...tail };
  const k = type === 'low' ? (1 - cos) / 2 : (1 + cos) / 2;
  return { b0: k / a0, b1: (type === 'low' ? 2 : -2) * k / a0, b2: k / a0, ...tail };
}
function run(chain, x) {
  for (let k = 0; k < chain.length; k++) {
    const s = chain[k];
    const y = s.b0 * x + s.z1;
    s.z1 = s.b1 * x - s.a1 * y + s.z2;
    s.z2 = s.b2 * x - s.a2 * y;
    x = y;
  }
  return x;
}

const LAG = 8; // blocks

class OnsetDetector extends AudioWorkletProcessor {
  constructor() {
    super();
    // in front of everything: 8th-order low-pass, then two notches on the click's pitch
    this.pre = [
      biquad('low', CUTOFF, 0.5098), biquad('low', CUTOFF, 0.6013), biquad('low', CUTOFF, 0.9), biquad('low', CUTOFF, 2.5629),
      biquad('notch', CLICK_HZ, 4), biquad('notch', CLICK_HZ, 4),
    ];
    this.bands = [
      { chain: [biquad('low', 300, 0.5412), biquad('low', 300, 1.3066)], release: 0.15 },
      { chain: [biquad('high', 300, 0.7071), biquad('low', 1500, 0.7071)], release: 0.10 },
      { chain: [biquad('high', 1500, 0.5412), biquad('high', 1500, 1.3066)], release: 0.05 },
    ];
    // "past" remembers the held peak of the last ~20 ms, so a strum that builds up
    // string by string is measured against how things stood before it began
    for (const b of this.bands) { b.sum = 0; b.last = 0; b.hold = 0; b.past = new Float32Array(LAG); }
    this.slot = 0;
    this.lastTotal = 0;
    this.lastOnset = -1;
    this.peak = 0;
    this.blocks = 0;
    this.setSensitivity(0.6);
    this.port.onmessage = (e) => {
      if (e.data && e.data.type === 'sensitivity') this.setSensitivity(e.data.value);
    };
  }

  setSensitivity(s) {
    s = Math.min(1, Math.max(0, s));
    this.threshold = 1.3 - 0.9 * s;                 // required jump over the held peaks (log units, summed over bands)
    this.floor = 0.02 * Math.pow(1 - s, 2) + 0.002; // ignore anything quieter (RMS)
    this.eps = Math.pow(this.floor * 0.25, 2);       // keeps near-silent bands from counting
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    const bands = this.bands;
    let total = 0;
    for (let i = 0; i < ch.length; i++) {
      const x = run(this.pre, ch[i]);
      total += x * x;
      for (let b = 0; b < 3; b++) { const y = run(bands[b].chain, x); bands[b].sum += y * y; }
    }
    total /= ch.length;
    const eTotal = (total + this.lastTotal) / 2;
    this.lastTotal = total;

    // A strum = energy clearly above the recent peak, added up over the bands.
    const dt = ch.length / sampleRate;
    let rise = 0;
    for (let b = 0; b < 3; b++) {
      const band = bands[b];
      const cur = band.sum / ch.length;
      const e = (cur + band.last) / 2; // ~5 ms window
      band.last = cur; band.sum = 0;
      const before = band.past[this.slot]; // the held peak LAG blocks ago
      if (e > before) rise += 0.5 * Math.log((e + this.eps) / (before + this.eps));
      band.hold = Math.max(e, band.hold * Math.exp(-dt / band.release));
      band.past[this.slot] = band.hold;
    }
    this.slot = (this.slot + 1) % LAG;
    const now = currentTime;
    if (Math.sqrt(eTotal) > this.floor && rise > this.threshold && now - this.lastOnset > 0.1) {
      this.lastOnset = now;
      this.port.postMessage({ type: 'onset', time: now, level: Math.sqrt(eTotal) });
    }

    this.peak = Math.max(this.peak, Math.sqrt(total));
    if (++this.blocks >= 8) {
      this.port.postMessage({ type: 'level', value: this.peak, time: currentTime });
      this.peak = 0;
      this.blocks = 0;
    }
    return true;
  }
}
registerProcessor('onset-detector', OnsetDetector);
`;

export function onsetWorkletUrl(): string {
  return URL.createObjectURL(new Blob([onsetWorkletSource], { type: 'application/javascript' }));
}
