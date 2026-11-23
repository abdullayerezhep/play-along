import { NOTE_NAMES, parseChord } from '../audio/chords';
import { shapeFor, type Shape } from './chart';
import { SONGS } from './songs';

/** Which finger frets each string, low E → high e. 1 = index … 4 = little finger, 0 = open, null = not played. */
export type Fingers = (number | null)[];

export type ChordGuide = {
  name: string;
  /** "G major", "A minor", "B seventh" */
  fullName: string;
  /** The notes the chord is made of. */
  notes: string[];
  shape: Shape;
  fingers: Fingers;
  barre: boolean;
  /** One instruction per finger, then which strings to strum. */
  steps: string[];
  /** What usually goes wrong, and how to fix it. */
  tip: string;
  /** A few songs from the library that use it. */
  songs: string[];
};

const STRINGS = ['low E', 'A', 'D', 'G', 'B', 'high E'];
const FINGER = ['', 'Index finger', 'Middle finger', 'Ring finger', 'Little finger'];
const ORDINAL = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th', '13th'];

// Fingerings for the open shapes in chart.ts
const OPEN_FINGERS: Record<string, string> = {
  G: '210003', C: 'x32010', D: 'xx0132', Em: '023000', Am: 'x02310', E: '023100', A: 'x01230',
  Dm: 'xx0231', E7: '020100', A7: 'x02030', B7: 'x21304', D7: 'xx0213', G7: '320001', C7: 'x32410',
};
const BARRE_FINGERS = {
  E: { '': '134211', m: '134111', '7': '131211' } as Record<string, string>,
  A: { '': 'x12341', m: 'x13421', '7': 'x13141' } as Record<string, string>,
};

const TIPS: Record<string, string> = {
  Em: 'The easiest chord there is: two fingers, all six strings. Use it to practise strumming without worrying about your left hand.',
  G: 'A wide stretch at first. Arch your fingers so the tips come straight down and the open D, G and B strings can ring between them.',
  C: 'The usual problem is the ring finger leaning on the D string or the index finger muting the high E. Curl your fingers and check each string on its own.',
  D: 'Only the four thinnest strings. Hitting the low E or A makes it sound muddy, so start your strum from the D string.',
  Am: 'Same shape as E, moved one string towards the floor. Keep the index finger arched so the high E string rings.',
  E: 'A full, loud chord on all six strings. It is also the shape that barre chords like F are built from.',
  A: 'Three fingers squeezed into one fret. Line them up diagonally, and make sure the last one does not mute the high E string.',
  Dm: 'Like D, but the high E string moves down to the 1st fret. Strum from the D string.',
  E7: 'E with the ring finger lifted off. The open D string is what gives it the bluesy sound.',
  A7: 'A with the middle of the three fingers lifted. The open G string must ring.',
  D7: 'A small triangle pointing the other way from D. Strum from the D string.',
  G7: 'Like G stretched out, with the index finger on the 1st fret of the high E. It pulls strongly towards C.',
  B7: 'Four fingers and an open B string in the middle. Place the middle finger first and build the rest around it.',
  C7: 'C with the little finger added on the G string. Keep the low E string out of the strum.',
};
const BARRE_TIP = 'A barre chord: the index finger lies flat across the strings and does the job of the nut. Keep your thumb behind the neck, opposite the index finger, and roll that finger slightly onto its bony edge. Press close to the fret. If a string buzzes, that is where the finger is not flat yet. These take weeks, not days.';

const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const parseFingers = (s: string): Fingers => s.split('').map((c) => (c === 'x' ? null : Number(c)));

/** Everything a beginner needs to play one chord. Works for any major, minor or 7th chord. */
export function chordGuide(chord: string): ChordGuide | null {
  const p = parseChord(chord);
  const shape = shapeFor(chord);
  if (!p || !shape) return null;
  const key = NOTE_NAMES[p.root] + p.quality;
  const lowest = Math.min(...shape.filter((f): f is number => f !== null));
  const barre = lowest > 0;
  const fingers = OPEN_FINGERS[key]
    ? parseFingers(OPEN_FINGERS[key])
    : parseFingers(shape[0] === null ? BARRE_FINGERS.A[p.quality] : BARRE_FINGERS.E[p.quality]);

  const steps: string[] = [];
  for (let finger = 1; finger <= 4; finger++) {
    const on = fingers.map((f, s) => (f === finger ? s : -1)).filter((s) => s >= 0);
    if (!on.length) continue;
    const fret = shape[on[0]] as number;
    if (on.length > 1) {
      steps.push(`${FINGER[finger]}: lay it flat across the ${ORDINAL[fret]} fret, from the ${STRINGS[on[0]]} string to the ${STRINGS[on[on.length - 1]]} string.`);
    } else {
      steps.push(`${FINGER[finger]}: ${ORDINAL[fret]} fret of the ${STRINGS[on[0]]} string.`);
    }
  }
  const open = shape.map((f, s) => (f === 0 ? STRINGS[s] : '')).filter(Boolean);
  if (open.length) steps.push(`The ${list(open)} ${open.length > 1 ? 'strings ring' : 'string rings'} open, with no finger on ${open.length > 1 ? 'them' : 'it'}.`);
  const skipped = shape.map((f, s) => (f === null ? STRINGS[s] : '')).filter(Boolean);
  const first = shape.findIndex((f) => f !== null);
  steps.push(skipped.length
    ? `Strum from the ${STRINGS[first]} string down. Leave out the ${list(skipped)} ${skipped.length > 1 ? 'strings' : 'string'}.`
    : 'Strum all six strings.');

  const intervals = p.quality === 'm' ? [0, 3, 7] : p.quality === '7' ? [0, 4, 7, 10] : [0, 4, 7];
  const root = chord.replace(/(m|7)$/, '');
  return {
    name: chord,
    fullName: `${root} ${p.quality === 'm' ? 'minor' : p.quality === '7' ? 'seventh' : 'major'}`,
    notes: intervals.map((i) => NOTE_NAMES[(p.root + i) % 12]),
    shape, fingers, barre, steps,
    tip: barre ? BARRE_TIP : TIPS[key] ?? '',
    songs: SONGS.filter((s) => s.level !== 'warmup' && s.bars.flat().includes(chord)).slice(0, 4).map((s) => s.name),
  };
}

/** The chords in the order a beginner should meet them. */
export const CHORD_GROUPS: { title: string; about: string; chords: string[] }[] = [
  {
    title: 'First chords',
    about: 'Open chords: some strings ring without a finger on them. These eight are enough for most of the Easy songs.',
    chords: ['Em', 'G', 'C', 'D', 'Am', 'E', 'A', 'Dm'],
  },
  {
    title: 'Seventh chords',
    about: 'One note added to a major chord. They sound unsettled, as if they want to move on, which is why blues and folk use them just before a chord change.',
    chords: ['E7', 'A7', 'D7', 'G7', 'B7', 'C7'],
  },
  {
    title: 'Barre chords',
    about: 'One finger presses several strings at once, so the same hand shape can be moved up the neck to make any chord. Hard at first for everyone.',
    chords: ['F', 'Bm', 'F#m', 'B', 'F#', 'Cm'],
  },
];
