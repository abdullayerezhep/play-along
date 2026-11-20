// AudioWorklet source, loaded from a Blob URL so it needs no separate build step.
// It watches the mic signal and reports a "strum" each time the loudness jumps
// suddenly (fast envelope rising well above the slow envelope).
const source = /* js */ `
class OnsetDetector extends AudioWorkletProcessor {
  constructor() {
    super();
    this.prev = 0;
    this.lastLo = 0; this.lastHi = 0;   // previous block energies (2-block window)
    this.holdLo = 0; this.holdHi = 0;   // peak-hold envelopes with slow release
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
    this.threshold = 0.9 - 0.6 * s;                // required jump over the held peak (log units)
    this.floor = 0.02 * Math.pow(1 - s, 2) + 0.002; // ignore anything quieter (RMS)
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    // Two "bands": the raw signal, and its first difference which emphasises
    // pick noise and string attacks over notes that are already ringing.
    let lo = 0, hi = 0, prev = this.prev;
    for (let i = 0; i < ch.length; i++) {
      const d = ch[i] - prev; prev = ch[i];
      lo += ch[i] * ch[i];
      hi += d * d;
    }
    this.prev = prev;
    lo /= ch.length; hi /= ch.length;
    const eLo = (lo + this.lastLo) / 2, eHi = (hi + this.lastHi) / 2;
    this.lastLo = lo; this.lastHi = hi;

    // A strum = energy clearly above the recent peak. Beating and decay of
    // ringing strings stay under the held peak, so they don't trigger.
    const eps = 1e-9;
    const rise = Math.max(0, 0.5 * Math.log((eLo + eps) / (this.holdLo + eps)))
               + Math.max(0, 0.5 * Math.log((eHi + eps) / (this.holdHi + eps)));
    const now = currentTime;
    if (Math.sqrt(eLo) > this.floor && rise > this.threshold && now - this.lastOnset > 0.1) {
      this.lastOnset = now;
      this.port.postMessage({ type: 'onset', time: now, level: Math.sqrt(eLo) });
    }

    const dt = ch.length / sampleRate;
    this.holdLo = Math.max(eLo, this.holdLo * Math.exp(-dt / 0.15));
    this.holdHi = Math.max(eHi, this.holdHi * Math.exp(-dt / 0.06)); // attacks fade fast

    this.peak = Math.max(this.peak, Math.sqrt(lo));
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
  return URL.createObjectURL(new Blob([source], { type: 'application/javascript' }));
}
