import { GRADES, type Grade } from './game/judge';

/** The best grade the player has earned on each song, with a real guitar. Kept in this browser. */
export type Best = Record<string, { grade: Grade; accuracy: number }>;

const KEY = 'play-along:best';

export function loadBest(): Best {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Best; } catch { return {}; }
}

/** Records a result if it beats the old one. Returns the updated table and whether it was a new best. */
export function recordBest(best: Best, songId: string, g: Grade, accuracy: number): { best: Best; improved: boolean } {
  const old = best[songId];
  const better = !old || GRADES.indexOf(g) < GRADES.indexOf(old.grade) || (g === old.grade && accuracy > old.accuracy);
  if (!better) return { best, improved: false };
  const next = { ...best, [songId]: { grade: g, accuracy } };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  return { best: next, improved: true };
}
