import { BEATS_PER_BAR, type Hit, type Note } from './chart';

/** One eighth-note of a bar: a strum, or nothing. */
export type Slot = Hit | null;

/** One bar as eight eighth-note slots, from a pattern's strums… */
export function slotsFromHits(hits: Hit[]): Slot[] {
  return Array.from({ length: 8 }, (_, i) => hits.find((h) => Math.abs(h.b - i / 2) < 0.01) ?? null);
}

/** …or from the notes the song really has in that bar. */
export function slotsFromNotes(notes: Note[], bar: number): Slot[] {
  const hits = notes
    .filter((n) => Math.floor(n.beat / BEATS_PER_BAR + 1e-6) === bar)
    .map((n) => ({ b: n.beat - bar * BEATS_PER_BAR, s: n.stroke, len: n.len, chop: n.chop }));
  return slotsFromHits(hits);
}
