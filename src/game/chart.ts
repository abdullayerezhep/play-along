import { NOTE_NAMES, parseChord } from '../audio/chords';
import { DEFAULT_SONG, SONGS, type Song } from './songs';
import { parseSong } from './songText';

export { normalizeChord, parseSong } from './songText';

export type Stroke = 'down' | 'up' | 'mute';

export type Note = {
  id: number;
  time: number; // seconds from song start (beat 1 of bar 1)
  beat: number; // absolute beat index (float)
  stroke: Stroke; // 'mute' = percussive chuck (✕)
  chord: string;
  chordChange: boolean;
  len?: number; // beats to let the chord ring (long note)
  endTime?: number;
  chop?: boolean; // strum then cut it short
  result?: 'perfect' | 'good' | 'miss' | 'wrong';
  awaitingChord?: boolean;
  offset?: number; // seconds, +late / -early
  onsetCtx?: number; // AudioContext time of the strum that hit it
  source?: 'mic' | 'key';
  hold?: 'holding' | 'broken' | 'done';
  holdPoints?: number;
  chopState?: 'ok' | 'rang';
};

type Hit = { b: number; s: Stroke; len?: number; chop?: boolean };
export type Pattern = { id: string; name: string; level: string; hits: Hit[] };

const d = (b: number, extra: Partial<Hit> = {}): Hit => ({ b, s: 'down', ...extra });
const u = (b: number, extra: Partial<Hit> = {}): Hit => ({ b, s: 'up', ...extra });
const x = (b: number): Hit => ({ b, s: 'mute' });

export const PATTERNS: Pattern[] = [
  { id: 'ring', name: 'Let it ring', level: 'Warm-up', hits: [d(0, { len: 3.5 })] },
  { id: 'half', name: 'Half notes, let ring', level: 'Easy', hits: [d(0, { len: 1.5 }), d(2, { len: 1.5 })] },
  { id: 'quarters', name: 'Quarter downs', level: 'Easy', hits: [d(0), d(1), d(2), d(3)] },
  { id: 'boom-chuck', name: 'Boom-chuck', level: 'Easy', hits: [d(0), x(1), d(2), x(3)] },
  { id: 'folk', name: 'Folk strum', level: 'Medium', hits: [d(0), d(1), u(1.5), u(2.5), d(3), u(3.5)] },
  { id: 'folk-chuck', name: 'Folk with chucks', level: 'Medium', hits: [d(0), x(1), u(1.5), u(2.5), x(3), u(3.5)] },
  { id: 'skank', name: 'Reggae skank', level: 'Medium', hits: [d(1, { chop: true }), d(3, { chop: true })] },
  { id: 'offbeat', name: 'Offbeat ups', level: 'Medium', hits: [u(0.5), u(1.5), u(2.5), u(3.5)] },
  {
    id: 'funk', name: 'Funk chops', level: 'Hard',
    hits: [d(0, { chop: true }), d(1), u(1.5, { chop: true }), x(2), d(3), u(3.5, { chop: true })],
  },
  { id: 'eighths', name: 'Straight eighths', level: 'Hard', hits: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((b) => (b % 1 ? u(b) : d(b))) },
];

/** A song as the game plays it: see Song in songs.ts for the library's extra details. */
export type Progression = Song;

export const CUSTOM_ID = 'custom';
/** Ids of songs the player saved start with this. */
export const MINE = 'my:';
export const BEATS_PER_BAR = 4;

/** A song the player typed in and kept. */
export type SavedSong = { id: string; name: string; chords: string; bpm: number; patternId: string };

export type SongSettings = {
  bpm: number;
  bars: number; // roughly how long; rounded to whole times through the song
  patternId: string;
  progressionId: string;
  customChords?: string;
  mySongs?: SavedSong[];
  ringOut?: boolean;
};

/** The song the settings point at: from the library, the player's saved songs, or what they are typing. */
export function getProgression(s: SongSettings): Progression {
  if (s.progressionId === CUSTOM_ID) {
    const parsed = parseSong(s.customChords ?? '');
    if ('bars' in parsed) return { id: CUSTOM_ID, name: 'Your song', bars: parsed.bars };
  } else if (s.progressionId.startsWith(MINE)) {
    const saved = s.mySongs?.find((m) => m.id === s.progressionId);
    const parsed = saved && parseSong(saved.chords);
    if (saved && parsed && 'bars' in parsed) return { id: saved.id, name: saved.name, bars: parsed.bars };
  }
  return SONGS.find((p) => p.id === s.progressionId) ?? SONGS.find((p) => p.id === DEFAULT_SONG)!;
}

// ---------- where we are in the song ----------

export function chordAtBeat(prog: Progression, beat: number): string {
  const b = Math.max(0, beat);
  const bar = prog.bars[Math.floor(b / BEATS_PER_BAR) % prog.bars.length];
  return bar[Math.min(bar.length - 1, Math.floor(((b % BEATS_PER_BAR) / BEATS_PER_BAR) * bar.length))];
}

/** The next beat (after `beat`, before `untilBeat`) where the chord becomes a different one. */
export function nextChange(prog: Progression, beat: number, untilBeat: number): { chord: string; beat: number } | null {
  const current = chordAtBeat(prog, beat);
  for (let b = Math.floor(Math.max(0, beat)) + 1; b < untilBeat; b++) {
    const c = chordAtBeat(prog, b);
    if (c !== current) return { chord: c, beat: b };
  }
  return null;
}

/**
 * Songs are played a whole number of times through, then (optionally) end with one
 * extra bar back on the home chord, left to ring.
 */
export function songLength(prog: Progression, requestedBars: number, ringOut: boolean) {
  const len = prog.bars.length;
  const playBars = Math.max(1, Math.round(requestedBars / len)) * len;
  return { playBars, totalBars: playBars + (ringOut ? 1 : 0) };
}

/** Length choices that fit this song (8/16/24/32 bars, rounded to whole loops; long songs can also go twice). */
export function lengthOptions(prog: Progression): number[] {
  const len = prog.bars.length;
  const options = [8, 16, 24, 32].map((b) => songLength(prog, b, false).playBars);
  if (len > 16) options.push(len * 2);
  return [...new Set(options)];
}

/** A good default length for a song: once through if it is long, a few loops if it is short. */
export function suggestedBars(prog: Progression): number {
  return prog.bars.length >= 12 ? prog.bars.length : 16;
}

/** Everything about the shape of one play-through: how long it is and which chord sounds when. */
export function songMap(s: SongSettings) {
  const prog = getProgression(s);
  const { playBars, totalBars } = songLength(prog, s.bars, s.ringOut !== false);
  const playBeats = playBars * BEATS_PER_BAR, totalBeats = totalBars * BEATS_PER_BAR;
  const home = prog.home ?? prog.bars[0][0];
  /** The ending bar sits on the home chord. */
  const chordAt = (beat: number) => (beat >= playBeats ? home : chordAtBeat(prog, beat));
  const upcoming = (beat: number): { chord: string; beat: number } | null => {
    const current = chordAt(beat);
    for (let b = Math.floor(Math.max(0, beat)) + 1; b < totalBeats; b++) {
      if (chordAt(b) !== current) return { chord: chordAt(b), beat: b };
    }
    return null;
  };
  return { prog, playBars, totalBars, playBeats, totalBeats, home, chordAt, upcoming };
}

export function buildChart(s: SongSettings): Note[] {
  const pattern = PATTERNS.find((p) => p.id === s.patternId) ?? PATTERNS[0];
  const { prog, playBars, totalBars, home, chordAt } = songMap(s);
  const spb = 60 / s.bpm;
  const notes: Note[] = [];
  let prev = '';
  for (let bar = 0; bar < totalBars; bar++) {
    const ending = bar >= playBars;
    const chords = ending ? [home] : prog.bars[bar % prog.bars.length];
    let hits: Hit[] = ending ? [d(0, { len: 3.5 })] : pattern.hits.map((h) => ({ ...h }));
    if (chords.length > 1) {
      const seg = BEATS_PER_BAR / chords.length;
      // a long note must not ring across a chord change
      for (const h of hits) {
        if (!h.len) continue;
        const room = (Math.floor(h.b / seg) + 1) * seg - h.b - 0.5;
        if (room < 0.5) delete h.len; else h.len = Math.min(h.len, room);
      }
      // every chord gets strummed at least once
      for (let i = 0; i < chords.length; i++) {
        if (!hits.some((h) => h.b >= i * seg && h.b < (i + 1) * seg)) hits.push(d(i * seg, seg >= 2 ? { len: seg - 0.5 } : {}));
      }
      hits = hits.sort((a, b) => a.b - b.b);
    }
    for (const h of hits) {
      const beat = bar * BEATS_PER_BAR + h.b;
      const chord = chordAt(beat);
      notes.push({
        id: notes.length, time: beat * spb, beat, stroke: h.s, chord,
        chordChange: chord !== prev,
        ...(h.len ? { len: h.len, endTime: (beat + h.len) * spb } : {}),
        ...(h.chop ? { chop: true } : {}),
      });
      prev = chord;
    }
  }
  return notes;
}

// ---------- sounds and shapes for any chord ----------

/** Bass note for a chord's root, between B1 and A#2 (just under the guitar). */
export function rootFreq(chord: string): number {
  const root = parseChord(chord)?.root ?? 4;
  const midi = 36 + root > 46 ? 24 + root : 36 + root;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Frets from the low E string to the high e string. null = don't play that string. */
export type Shape = (number | null)[];

// Open-position shapes, low E → high e. x = muted.
const OPEN_SHAPES: Record<string, string> = {
  G: '320003', C: 'x32010', D: 'xx0232', Em: '022000', Am: 'x02210', E: '022100', A: 'x02220',
  Dm: 'xx0231', E7: '020100', A7: 'x02020', B7: 'x21202', D7: 'xx0212', G7: '320001', C7: 'x32310',
};

const BARRE = {
  // offsets from the barre fret; root on the low E string…
  E: { '': [0, 2, 2, 1, 0, 0], m: [0, 2, 2, 0, 0, 0], '7': [0, 2, 0, 1, 0, 0] } as Record<string, number[]>,
  // …or on the A string
  A: { '': [null, 0, 2, 2, 2, 0], m: [null, 0, 2, 2, 1, 0], '7': [null, 0, 2, 0, 2, 0] } as Record<string, (number | null)[]>,
};

/** A playable shape for any major, minor or 7th chord: the open shape if there is one, else a barre chord. */
export function shapeFor(chord: string): Shape | null {
  const p = parseChord(chord);
  if (!p) return null;
  const open = OPEN_SHAPES[NOTE_NAMES[p.root] + p.quality];
  if (open) return open.split('').map((c) => (c === 'x' ? null : Number(c)));
  const fE = (p.root - 4 + 12) % 12, fA = (p.root - 9 + 12) % 12;
  return fE <= fA
    ? BARRE.E[p.quality].map((o) => o + fE)
    : BARRE.A[p.quality].map((o) => (o === null ? null : o + fA));
}
