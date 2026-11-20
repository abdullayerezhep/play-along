import type { Note } from './chart';

export const PERFECT_WINDOW = 0.06;
export const GOOD_WINDOW = 0.13;

export type Stats = {
  score: number;
  combo: number;
  maxCombo: number;
  perfect: number;
  good: number;
  miss: number;
  wrong: number; // on time, but the wrong chord
  offsets: number[];
};

export const emptyStats = (): Stats => ({ score: 0, combo: 0, maxCombo: 0, perfect: 0, good: 0, miss: 0, wrong: 0, offsets: [] });

export const multiplier = (combo: number) => Math.min(4, 1 + Math.floor(combo / 8));

/**
 * Match a strum (in song seconds) to the closest unjudged note and grade its timing.
 * If `awaitChord` is set, points and combo wait for confirmChord/rejectChord.
 */
export function judgeStrum(notes: Note[], t: number, stats: Stats, awaitChord: boolean): Note | undefined {
  let best: Note | undefined;
  let bestDist = Infinity;
  for (const n of notes) {
    if (n.result) continue;
    const d = Math.abs(n.time - t);
    if (d < bestDist) { bestDist = d; best = n; }
    if (n.time - t > GOOD_WINDOW) break; // notes are sorted
  }
  if (!best || bestDist > GOOD_WINDOW) return undefined;
  best.offset = t - best.time;
  best.result = bestDist <= PERFECT_WINDOW ? 'perfect' : 'good';
  stats.offsets.push(best.offset);
  if (awaitChord) best.awaitingChord = true;
  else award(best, stats);
  return best;
}

function award(n: Note, stats: Stats) {
  const r = n.result as 'perfect' | 'good';
  stats[r]++;
  stats.combo++;
  stats.maxCombo = Math.max(stats.maxCombo, stats.combo);
  stats.score += (r === 'perfect' ? 100 : 50) * multiplier(stats.combo);
}

export function confirmChord(n: Note, stats: Stats) {
  if (!n.awaitingChord) return;
  n.awaitingChord = false;
  award(n, stats);
}

export function rejectChord(n: Note, stats: Stats) {
  if (!n.awaitingChord) return;
  n.awaitingChord = false;
  n.result = 'wrong';
  stats.wrong++;
  stats.combo = 0;
}

/** Mark notes the player let slip past. Returns newly missed notes. */
export function sweepMisses(notes: Note[], t: number, stats: Stats): Note[] {
  const missed: Note[] = [];
  for (const n of notes) {
    if (n.time > t - GOOD_WINDOW) break;
    if (!n.result) {
      n.result = 'miss';
      stats.miss++;
      stats.combo = 0;
      missed.push(n);
    }
  }
  return missed;
}

export function accuracy(s: Stats) {
  const total = s.perfect + s.good + s.miss + s.wrong;
  return total ? (s.perfect + s.good * 0.6) / total : 0;
}

export function grade(acc: number) {
  if (acc >= 0.95) return 'S';
  if (acc >= 0.85) return 'A';
  if (acc >= 0.7) return 'B';
  if (acc >= 0.5) return 'C';
  return 'D';
}

export function median(xs: number[]) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
