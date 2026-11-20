// Pitch of a single plucked string, for the tuner.

/** The six open strings in standard tuning, low to high. */
export const GUITAR_STRINGS = [
  { name: 'E', label: '6th string, low E', freq: 82.41 },
  { name: 'A', label: '5th string, A', freq: 110.0 },
  { name: 'D', label: '4th string, D', freq: 146.83 },
  { name: 'G', label: '3rd string, G', freq: 196.0 },
  { name: 'B', label: '2nd string, B', freq: 246.94 },
  { name: 'E', label: '1st string, high E', freq: 329.63 },
];

const MIN_HZ = 65, MAX_HZ = 420;

/**
 * Finds the pitch by looking for the delay at which the waveform best matches a
 * shifted copy of itself (normalised autocorrelation, as in the McLeod pitch method).
 * Returns null when the sound is too quiet or has no clear pitch.
 */
export function detectPitch(buf: Float32Array, sampleRate: number): number | null {
  const maxLag = Math.floor(sampleRate / MIN_HZ), minLag = Math.floor(sampleRate / MAX_HZ);
  const n = Math.min(buf.length - maxLag - 1, 3000);
  if (n < 512) return null;
  let energy = 0;
  for (let i = 0; i < n; i++) energy += buf[i] * buf[i];
  if (Math.sqrt(energy / n) < 0.004) return null;

  const nsdf = new Float32Array(maxLag + 2);
  for (let lag = minLag - 1; lag <= maxLag + 1; lag++) {
    let ac = 0, m = 0;
    for (let i = 0; i < n; i++) { const a = buf[i], b = buf[i + lag]; ac += a * b; m += a * a + b * b; }
    nsdf[lag] = m > 0 ? (2 * ac) / m : 0;
  }
  // local peaks; take the first one nearly as high as the highest, which avoids picking an octave below
  let best = 0;
  const peaks: number[] = [];
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (nsdf[lag] > 0 && nsdf[lag] > nsdf[lag - 1] && nsdf[lag] >= nsdf[lag + 1]) { peaks.push(lag); if (nsdf[lag] > best) best = nsdf[lag]; }
  }
  if (best < 0.6) return null;
  const lag = peaks.find((p) => nsdf[p] >= best * 0.9)!;
  const a = nsdf[lag - 1], b = nsdf[lag], c = nsdf[lag + 1];
  const shift = a - 2 * b + c !== 0 ? (0.5 * (a - c)) / (a - 2 * b + c) : 0;
  return sampleRate / (lag + shift);
}

/** The string a pitch is closest to, and how far off it is in cents (+ = sharp, tune down). */
export function nearestString(freq: number) {
  let index = 0, cents = Infinity;
  GUITAR_STRINGS.forEach((s, i) => {
    const c = 1200 * Math.log2(freq / s.freq);
    if (Math.abs(c) < Math.abs(cents)) { cents = c; index = i; }
  });
  return { index, cents };
}
