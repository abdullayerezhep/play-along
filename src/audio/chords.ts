// Chord recognition from a magnitude spectrum, via a 12-bin chromagram
// (how much of each note name C, C#, D… is present) matched against chord templates.

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS: Record<string, string> = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };

const QUALITIES: Record<string, number[]> = {
  '': [0, 4, 7],       // major
  m: [0, 3, 7],        // minor
  '7': [0, 4, 7, 10],  // dominant 7th
};

export type ChordGuess = { name: string; score: number };
export type ChordResult = { best: ChordGuess; ranked: ChordGuess[]; chroma: number[]; clarity: number };

/** "F#m" → { root: 6, quality: 'm' } */
export function parseChord(name: string): { root: number; quality: string } | null {
  const m = /^([A-G])([#b]?)(.*)$/.exec(name);
  if (!m) return null;
  let note = m[1] + m[2];
  note = FLATS[note] ?? note;
  const root = NOTE_NAMES.indexOf(note);
  if (root < 0 || !(m[3] in QUALITIES)) return null;
  return { root, quality: m[3] };
}

function template(root: number, quality: string): number[] {
  const t = new Array(12).fill(0);
  QUALITIES[quality].forEach((iv, i) => { t[(root + iv) % 12] = i === 0 ? 1.15 : 1; });
  return t;
}

const TEMPLATES: { name: string; t: number[] }[] = [];
for (let r = 0; r < 12; r++) for (const q of Object.keys(QUALITIES)) TEMPLATES.push({ name: NOTE_NAMES[r] + q, t: template(r, q) });

function cosine(a: number[], b: number[]) {
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < 12; i++) { ab += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
  return aa && bb ? ab / Math.sqrt(aa * bb) : 0;
}

/**
 * Build a chromagram from AnalyserNode-style dB magnitudes.
 * `before` (optional) is the spectrum captured right as the strum started, i.e.
 * mostly the previous chord still ringing; it's subtracted so only new notes count.
 * Only spectral peaks between ~70 Hz and ~1.6 kHz count (guitar fundamentals and
 * low harmonics); higher harmonics are down-weighted since they smear other notes.
 */
export function chromaFromSpectrum(after: Float32Array, sampleRate: number, before?: Float32Array): number[] {
  const binHz = sampleRate / (after.length * 2);
  const lo = Math.max(2, Math.floor(70 / binHz));
  const hi = Math.min(after.length - 2, Math.ceil(1600 / binHz));
  const mag = new Float32Array(hi + 2);
  for (let k = lo - 1; k <= hi + 1; k++) {
    const a = Math.pow(10, after[k] / 20);
    const b = before ? Math.pow(10, before[k] / 20) * 0.8 : 0;
    mag[k] = Math.max(0, a - b);
  }
  let max = 0;
  for (let k = lo; k <= hi; k++) if (mag[k] > max) max = mag[k];
  const chroma = new Array(12).fill(0);
  if (max === 0) return chroma;
  for (let k = lo; k <= hi; k++) {
    const v = mag[k];
    if (v < max * 0.006 || v <= mag[k - 1] || v < mag[k + 1]) continue; // peaks only, within ~45 dB
    // parabolic interpolation (in dB) for a more exact peak frequency
    const a = Math.log(mag[k - 1] + 1e-12), b = Math.log(v), c = Math.log(mag[k + 1] + 1e-12);
    const p = 0.5 * (a - c) / (a - 2 * b + c || 1);
    const f = (k + Math.max(-0.5, Math.min(0.5, p))) * binHz;
    const midi = 69 + 12 * Math.log2(f / 440);
    const nearest = Math.round(midi);
    if (Math.abs(midi - nearest) > 0.35) continue; // between notes: noise, not a string
    chroma[((nearest % 12) + 12) % 12] += (v / max) / (1 + f / 600);
  }
  const cmax = Math.max(...chroma);
  return cmax > 0 ? chroma.map((x) => x / cmax) : chroma;
}

export function classify(chroma: number[]): ChordResult {
  const ranked = TEMPLATES.map(({ name, t }) => ({ name, score: cosine(chroma, t) })).sort((a, b) => b.score - a.score);
  // clarity: how "chord-like" the sound is (a muted scratch gives a flat chroma)
  const sorted = [...chroma].sort((a, b) => b - a);
  const clarity = sorted.slice(0, 4).reduce((s, x) => s + x, 0) / (chroma.reduce((s, x) => s + x, 0) || 1);
  return { best: ranked[0], ranked, chroma, clarity };
}

/** Does what we heard count as the expected chord? A little forgiving: E counts for E7 and vice versa. */
export function matchesChord(result: ChordResult, expected: string, tolerance = 0.04): boolean {
  const target = parseChord(expected);
  if (!target || result.clarity < 0.55) return false;
  const same = (n: string) => {
    const p = parseChord(n);
    if (!p || p.root !== target.root) return false;
    const minorish = (q: string) => q === 'm';
    return minorish(p.quality) === minorish(target.quality);
  };
  const best = result.ranked[0].score;
  return result.ranked.some((g) => same(g.name) && g.score >= best - tolerance);
}
