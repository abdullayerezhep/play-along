export type Stroke = 'down' | 'up';

export type Note = {
  id: number;
  time: number; // seconds from song start (beat 1 of bar 1)
  beat: number; // absolute beat index (float)
  stroke: Stroke;
  chord: string;
  chordChange: boolean;
  result?: 'perfect' | 'good' | 'miss';
  offset?: number; // seconds, +late / -early
};

export type Pattern = { id: string; name: string; level: string; hits: [number, Stroke][] };

export const PATTERNS: Pattern[] = [
  { id: 'one', name: 'Bar starts', level: 'Warm-up', hits: [[0, 'down']] },
  { id: 'half', name: 'Half notes', level: 'Easy', hits: [[0, 'down'], [2, 'down']] },
  { id: 'quarters', name: 'Quarter downs', level: 'Easy', hits: [[0, 'down'], [1, 'down'], [2, 'down'], [3, 'down']] },
  {
    id: 'folk', name: 'Folk strum  D·DU·UDU', level: 'Medium',
    hits: [[0, 'down'], [1, 'down'], [1.5, 'up'], [2.5, 'up'], [3, 'down'], [3.5, 'up']],
  },
  { id: 'offbeat', name: 'Offbeat ups (reggae)', level: 'Medium', hits: [[0.5, 'up'], [1.5, 'up'], [2.5, 'up'], [3.5, 'up']] },
  {
    id: 'eighths', name: 'Straight eighths', level: 'Hard',
    hits: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((b) => [b, b % 1 ? 'up' : 'down'] as [number, Stroke]),
  },
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

export type SongSettings = { bpm: number; bars: number; patternId: string; progressionId: string };

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
    pattern.hits.forEach(([b, stroke], i) => {
      const beat = bar * BEATS_PER_BAR + b;
      notes.push({
        id: notes.length, time: beat * spb, beat, stroke, chord,
        chordChange: i === 0 && chord !== prev,
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
