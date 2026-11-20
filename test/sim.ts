/* eslint-disable @typescript-eslint/no-explicit-any -- the harness fakes the AudioWorklet globals */
// A small simulated guitar and a way to run the real strum detector on it, so the
// audio logic can be tested without a browser or a microphone.
import { LevelHistory } from '../src/audio/decay';
import { CLICK } from '../src/audio/engine';
import { onsetWorkletSource } from '../src/audio/onsetWorklet';
import type { Shape } from '../src/game/chart';

export const SR = 48000;
export const FFT = 8192;
const OPEN_STRINGS = [40, 45, 50, 55, 59, 64]; // MIDI notes, low E → high e

export function rng(seed = 1) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

export const silence = (seconds: number) => new Float32Array(Math.floor(seconds * SR));

export function addNoise(sig: Float32Array, amp: number, rnd: () => number) {
  for (let i = 0; i < sig.length; i++) sig[i] += (rnd() - 0.5) * 2 * amp;
}

export type Strum = {
  t: number;
  shape: Shape;
  amp?: number;
  up?: boolean;     // upstroke: only the four highest strings, raked the other way
  dead?: boolean;   // muted "chuck": strings don't ring
  muteAt?: number;  // seconds after the strum at which the hand mutes everything
  pick?: boolean;   // include the pick's click (default true)
};
type GuitarOpts = { rnd: () => number; tau?: number; harmonicDecay?: number; detuneCents?: number };

/**
 * Plays strums the way a guitar does: each string is a stack of decaying, slightly
 * inharmonic partials; strings are raked 3 ms apart; and a string that is struck
 * again stops its old note. Strings the new strum doesn't touch keep ringing.
 */
export function playStrums(sig: Float32Array, strums: Strum[], o: GuitarOpts) {
  const { rnd, tau = 0.8, harmonicDecay = 1, detuneCents = 20 } = o;
  const detune = OPEN_STRINGS.map(() => 2 ** ((detuneCents * (rnd() - 0.5)) / 1200));
  const struck = (e: Strum, s: number) => e.shape[s] !== null && (!e.up || s >= 2);
  const rake = (e: Strum, s: number) => e.t + (e.up ? 5 - s : s) * 0.003;
  strums.forEach((e, idx) => {
    const amp = e.amp ?? 0.12;
    for (let s = 0; s < 6; s++) {
      if (!struck(e, s)) continue;
      const next = strums.slice(idx + 1).find((n) => struck(n, s));
      const start = rake(e, s), st = Math.floor(start * SR);
      const cut = Math.min(next ? rake(next, s) - start : Infinity, e.muteAt ?? Infinity);
      const f0 = 440 * 2 ** ((OPEN_STRINGS[s] + (e.shape[s] as number) - 69) / 12) * detune[s];
      for (let h = 1; h <= 12; h++) {
        const fh = f0 * h * Math.sqrt(1 + 0.0001 * h * h);
        const ah = (amp / h ** 1.1) * (0.5 + rnd());
        const ph = rnd() * 6.28, th = e.dead ? 0.02 : tau / h ** harmonicDecay;
        for (let i = 0; st + i < sig.length; i++) {
          const tt = i / SR;
          let env = Math.exp(-tt / th);
          if (tt > cut) env *= Math.exp(-(tt - cut) / (next && cut === rake(next, s) - start ? 0.003 : 0.015));
          if (env < 1e-4) break;
          if (st + i >= 0) sig[st + i] += ah * env * Math.sin(ph + 2 * Math.PI * fh * tt);
        }
      }
    }
    if (e.pick !== false) {
      const st = Math.floor(e.t * SR);
      for (let i = 0; i < 300 && st + i < sig.length; i++) sig[st + i] += amp * 0.4 * (rnd() - 0.5) * Math.exp(-i / 96);
    }
  });
}

/** The metronome click exactly as engine.click() makes it, scaled by how loudly it reaches the mic. */
export function clickInto(sig: Float32Array, t: number, accent: boolean, level: number) {
  const peak = level * (accent ? 1 : 0.5), st = Math.floor((t - CLICK.length / 2) * SR);
  for (let i = 0; i < CLICK.length * SR; i++) {
    const tt = i / SR - CLICK.length / 2;
    if (st + i >= 0 && st + i < sig.length) sig[st + i] += peak * Math.exp(-(tt * tt) / (2 * CLICK.sigma ** 2)) * Math.sin(2 * Math.PI * CLICK.freq * tt);
  }
}

/** The bass line note as engine.bass() makes it (a soft triangle wave). */
export function bassInto(sig: Float32Array, t: number, freq: number, dur: number, level: number) {
  const st = Math.floor(t * SR);
  for (let i = 0; i < dur * SR && st + i < sig.length; i++) {
    const tt = i / SR;
    const env = tt < 0.01 ? (level * tt) / 0.01 : level * (0.0001 / level) ** ((tt - 0.01) / (dur - 0.01));
    let v = 0;
    for (let h = 1, sign = 1; h <= 7; h += 2, sign = -sign) v += (sign * Math.sin(2 * Math.PI * freq * h * tt)) / (h * h);
    sig[st + i] += env * v * 0.81;
  }
}

let Detector: any;
const posted: any[] = [];
function loadDetector() {
  if (Detector) return;
  const g = globalThis as any;
  g.sampleRate = SR;
  g.currentTime = 0;
  g.AudioWorkletProcessor = class { port = { postMessage: (m: any) => posted.push(m) }; };
  g.registerProcessor = (_name: string, cls: any) => { Detector = cls; };
  (0, eval)(onsetWorkletSource);
}

/** Feed a signal through the real detector. `onLevel` is called after each loudness reading. */
export function runDetector(sig: Float32Array, sensitivity = 0.6, onLevel?: (time: number, history: LevelHistory) => void) {
  loadDetector();
  posted.length = 0;
  const proc = new Detector();
  proc.setSensitivity(sensitivity);
  const onsets: { time: number; level: number }[] = [];
  const history = new LevelHistory();
  for (let i = 0; i + 128 <= sig.length; i += 128) {
    (globalThis as any).currentTime = i / SR;
    proc.process([[sig.subarray(i, i + 128)]]);
    while (posted.length) {
      const m = posted.shift();
      if (m.type === 'onset') onsets.push({ time: m.time, level: m.level });
      else { history.push(m.time, m.value); onLevel?.(m.time, history); }
    }
  }
  return { onsets, history };
}

function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let b = n >> 1;
    for (; j & b; b >>= 1) j ^= b;
    j ^= b;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) for (let k = 0; k < len / 2; k++) {
      const c = Math.cos(a * k), s = Math.sin(a * k), j = i + k + len / 2;
      const xr = re[j] * c - im[j] * s, xi = re[j] * s + im[j] * c;
      re[j] = re[i + k] - xr; im[j] = im[i + k] - xi; re[i + k] += xr; im[i + k] += xi;
    }
  }
}

/** What an AnalyserNode (fftSize 8192, Blackman window) would report for the samples ending at `endTime`. */
export function spectrumDb(sig: Float32Array, endTime: number): Float32Array {
  const end = Math.floor(endTime * SR);
  const re = new Float64Array(FFT), im = new Float64Array(FFT);
  for (let i = 0; i < FFT; i++) {
    const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / FFT) + 0.08 * Math.cos((4 * Math.PI * i) / FFT);
    const k = end - FFT + i;
    re[i] = (k >= 0 && k < sig.length ? sig[k] : 0) * w;
  }
  fft(re, im);
  const db = new Float32Array(FFT / 2);
  for (let k = 0; k < FFT / 2; k++) db[k] = 20 * Math.log10(Math.hypot(re[k], im[k]) / FFT + 1e-12);
  return db;
}
