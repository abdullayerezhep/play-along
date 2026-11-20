import { parseChord } from '../audio/chords';

/** "em" → "Em", "bbm" → "Bbm", "Amin" → "Am", "Gmaj" → "G". Returns null if it isn't a chord the game can check. */
export function normalizeChord(token: string): string | null {
  const m = /^([a-gA-G])([#b♯♭]?)(.*)$/.exec(token.trim());
  if (!m) return null;
  const acc = m[2] === '♯' ? '#' : m[2] === '♭' ? 'b' : m[2];
  let q = m[3];
  if (/^(maj|M)$/.test(q)) q = '';
  else if (/^(min|mi|-)$/i.test(q)) q = 'm';
  const name = m[1].toUpperCase() + acc + q;
  return parseChord(name) ? name : null;
}

/**
 * Reads a song written as chords.
 *   "G D Em C"            → one chord per bar
 *   "| G | D | Em C |"    → bars between the lines; two or four chords can share a bar
 */
export function parseSong(text: string): { bars: string[][] } | { error: string } {
  const hasLines = text.includes('|');
  const groups = hasLines
    ? text.split('|').map((seg) => seg.trim().split(/[\s,]+/).filter(Boolean)).filter((g) => g.length)
    : text.split(/[\s,–—-]+/).filter(Boolean).map((t) => [t]);
  if (!groups.length) return { error: 'Type your chords, for example: G D Em C' };
  if (groups.length > 64) return { error: 'That is more than 64 bars. Shorten the loop.' };
  const bars: string[][] = [];
  for (const g of groups) {
    if (![1, 2, 4].includes(g.length)) return { error: `A bar can hold 1, 2 or 4 chords, but "${g.join(' ')}" has ${g.length}.` };
    const bar: string[] = [];
    for (const t of g) {
      const c = normalizeChord(t);
      if (!c) return { error: `Can't read "${t}". Use major, minor or 7th chords, like G, Am, F#m or B7.` };
      bar.push(c);
    }
    bars.push(bar);
  }
  return { bars };
}
