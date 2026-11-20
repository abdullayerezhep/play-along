import { chromaFromSpectrum, classify, matchesChord } from '../src/audio/chords';
import { CHORD_SHAPES } from '../src/game/chart';

const SR = 48000, N = 8192;
const OPEN = [40, 45, 50, 55, 59, 64];
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function strum(shape: string, out: Float32Array, startSample: number, amp: number, detuneCents: number) {
  shape.split('').forEach((c, s) => {
    if (c === 'x') return;
    const f0 = hz(OPEN[s] + Number(c)) * Math.pow(2, (detuneCents * (rnd() - 0.5)) / 1200);
    const st = startSample + s * 150; // ~3ms rake per string
    for (let h = 1; h <= 12; h++) {
      const fh = f0 * h * Math.sqrt(1 + 0.0001 * h * h);
      const ah = amp / Math.pow(h, 1.1) * (0.5 + rnd());
      const ph = rnd() * 6.28, tau = 0.8 / h;
      for (let i = 0; i < out.length - st; i++) if (st + i >= 0) out[st + i] += ah * Math.exp(-i / SR / tau) * Math.sin(ph + 2 * Math.PI * fh * i / SR);
    }
  });
}

function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len; for (let i = 0; i < n; i += len) for (let k = 0; k < len / 2; k++) {
    const c = Math.cos(a * k), s = Math.sin(a * k), xr = re[i + k + len / 2] * c - im[i + k + len / 2] * s, xi = re[i + k + len / 2] * s + im[i + k + len / 2] * c;
    re[i + k + len / 2] = re[i + k] - xr; im[i + k + len / 2] = im[i + k] - xi; re[i + k] += xr; im[i + k] += xi; } }
}
function spectrumDb(sig: Float32Array) {
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[i] = sig[i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
  fft(re, im);
  const db = new Float32Array(N / 2);
  for (let k = 0; k < N / 2; k++) db[k] = 20 * Math.log10(Math.hypot(re[k], im[k]) / N + 1e-12);
  return db;
}

const names = Object.keys(CHORD_SHAPES);
const delay = Number(process.env.DELAY ?? 0.16);
const COMBINE = process.env.COMBINE === '1';
const USE_BEFORE = process.env.BEFORE === '1';
let correct = 0, falseAccept = 0, tests = 0, wrongTests = 0;
const misses: string[] = [];
for (let trial = 0; trial < 4; trial++) for (const played of names) {
  // window ends `delay` s after the strum; previous chord (random) still ringing underneath
  const prev = process.env.SAME === '1' ? played : names[Math.floor(rnd() * names.length)];
  const trialSeed = seed;
  const sig = new Float32Array(N);
  const strumAt = N - Math.floor(delay * SR);
  strum(CHORD_SHAPES[prev], sig, strumAt - Math.floor(0.4 * SR), 0.12, 20);
  strum(CHORD_SHAPES[played], sig, strumAt, 0.12, 20);
  for (let i = 0; i < N; i++) sig[i] += (rnd() - 0.5) * 0.004;
  // "before" = window ending ~15ms after the strum starts (when the onset message arrives)
  const sigB = new Float32Array(N);
  const bAt = N - Math.floor(0.015 * SR);
  strum(CHORD_SHAPES[prev], sigB, bAt - Math.floor((0.4 - delay + 0.015) * SR) , 0.12, 0);
  for (let i = 0; i < N; i++) sigB[i] += (rnd() - 0.5) * 0.004;
  // shift: build sigB as the true earlier slice of the same timeline instead
  const full = new Float32Array(N + Math.floor(delay * SR));
  seed = trialSeed;
  strum(CHORD_SHAPES[prev], full, full.length - Math.floor(delay * SR) - Math.floor(0.4 * SR), 0.12, 20);
  strum(CHORD_SHAPES[played], full, full.length - Math.floor(delay * SR), Number(process.env.AMP ?? 0.12), 20);
  for (let i = 0; i < full.length; i++) full[i] += (rnd() - 0.5) * 0.004;
  const endB = full.length - Math.floor(delay * SR) + Math.floor(0.015 * SR);
  const before = USE_BEFORE ? spectrumDb(full.subarray(endB - N, endB)) : undefined;
  const afterDb = spectrumDb(full.subarray(full.length - N));
  const res = classify(chromaFromSpectrum(afterDb, SR, before));
  const resPlain = classify(chromaFromSpectrum(afterDb, SR));
  tests++;
  if (matchesChord(res, played) || (COMBINE && matchesChord(resPlain, played))) correct++; else misses.push(`${played}→heard ${res.best.name} (prev ${prev})`);
  for (const other of names) {
    if (other === played || other[0] + (other.includes('m') ? 'm' : '') === played[0] + (played.includes('m') ? 'm' : '')) continue;
    wrongTests++;
    if (matchesChord(res, other) || (COMBINE && matchesChord(resPlain, other))) falseAccept++;
  }
}
console.log(`same=${process.env.SAME} amp=${process.env.AMP} combine=${COMBINE} before=${USE_BEFORE} delay ${delay}s  correct chord accepted: ${correct}/${tests}   wrong chord accepted: ${falseAccept}/${wrongTests}`);
console.log(misses.slice(0, 12).join('\n'));
