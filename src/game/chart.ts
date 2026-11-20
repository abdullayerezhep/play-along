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
  { id: 'boom-chuck', name: 'Boom-chuck  D·X·D·X', level: 'Easy', hits: [d(0), x(1), d(2), x(3)] },
  { id: 'folk', name: 'Folk strum  D·DU·UDU', level: 'Medium', hits: [d(0), d(1), u(1.5), u(2.5), d(3), u(3.5)] },
  { id: 'folk-chuck', name: 'Folk with chucks  D·XU·UXU', level: 'Medium', hits: [d(0), x(1), u(1.5), u(2.5), x(3), u(3.5)] },
  { id: 'skank', name: 'Reggae skank', level: 'Medium', hits: [d(1, { chop: true }), d(3, { chop: true })] },
  { id: 'offbeat', name: 'Offbeat ups', level: 'Medium', hits: [u(0.5), u(1.5), u(2.5), u(3.5)] },
  {
    id: 'funk', name: 'Funk chops  D·DU·X·DU', level: 'Hard',
    hits: [d(0, { chop: true }), d(1), u(1.5, { chop: true }), x(2), d(3), u(3.5, { chop: true })],
  },
  { id: 'eighths', name: 'Straight eighths', level: 'Hard', hits: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((b) => (b % 1 ? u(b) : d(b))) },
];

export type Progression = { id: string; name: string; chords: string[] };

export const PROGRESSIONS: Progression[] = [
  { id: 'em', name: 'Just Em', chords: ['Em'] },
  { id: 'pop', name: 'Pop  G–D–Em–C', chords: ['G', 'D', 'Em', 'C'] },
  { id: 'ballad', name: 'Ballad  C–G–Am–F', chords: ['C', 'G', 'Am', 'F'] },
  { id: 'folk', name: 'Folk  G–C–D–G', chords: ['G', 'C', 'D', 'G'] },
  { id: 'minor', name: 'Minor  Am–Dm–E–Am', chords: ['Am', 'Dm', 'E', 'Am'] },
  { id: 'blues', name: '12-bar blues in E', chords: ['E7', 'E7', 'E7', 'E7', 'A7', 'A7', 'E7', 'E7', 'B7', 'A7', 'E7', 'B7'] },
];

export const BEATS_PER_BAR = 4;

export type SongSettings = { bpm: number; bars: number; patternId: string; progressionId: string; ringOut?: boolean };

export function chordForBar(prog: Progression, bar: number) {
  return prog.chords[bar % prog.chords.length];
}

export function buildChart(s: SongSettings): Note[] {
  const pattern = PATTERNS.find((p) => p.id === s.patternId) ?? PATTERNS[0];
  const prog = PROGRESSIONS.find((p) => p.id === s.progressionId) ?? PROGRESSIONS[0];
  const spb = 60 / s.bpm;
  const notes: Note[] = [];
  let prev = '';
  for (let bar = 0; bar < s.bars; bar++) {
    const chord = chordForBar(prog, bar);
    // finish the song on one big ringing chord, like the end of a real song
    const hits = s.ringOut !== false && bar === s.bars - 1 && s.bars > 1 ? [d(0, { len: 3.5 })] : pattern.hits;
    hits.forEach((h, i) => {
      const beat = bar * BEATS_PER_BAR + h.b;
      notes.push({
        id: notes.length, time: beat * spb, beat, stroke: h.s, chord,
        chordChange: i === 0 && chord !== prev,
        ...(h.len ? { len: h.len, endTime: (beat + h.len) * spb } : {}),
        ...(h.chop ? { chop: true } : {}),
      });
    });
    prev = chord;
  }
  return notes;
}

// Root frequencies (octave 2) for the optional bass line.
const ROOTS: Record<string, number> = { C: 65.41, D: 73.42, E: 82.41, F: 87.31, G: 98.0, A: 110.0, B: 61.74 };
export function rootFreq(chord: string): number {
  return ROOTS[chord[0]] ?? 82.41;
}

// Open-position shapes, low E → high e. x = muted.
export const CHORD_SHAPES: Record<string, string> = {
  G: '320003', C: 'x32010', D: 'xx0232', Em: '022000', Am: 'x02210', E: '022100',
  A: 'x02220', F: '133211', Dm: 'xx0231', E7: '020100', A7: 'x02020', B7: 'x21202',
};
