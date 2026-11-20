import { parseSong } from './songText';

export type Level = 'warmup' | 'easy' | 'medium' | 'hard';

export const LEVELS: { id: Level; name: string; about: string }[] = [
  { id: 'warmup', name: 'Warm-ups', about: 'Short chord loops for getting your hands moving.' },
  { id: 'easy', name: 'Easy', about: 'Two or three open chords, with a whole bar or more to change.' },
  { id: 'medium', name: 'Medium', about: 'More chords, minor keys, and some changes in the middle of a bar.' },
  { id: 'hard', name: 'Hard', about: 'Barre chords and fast changes.' },
];

/** A song is a loop of bars; each bar holds 1, 2 or 4 chords that share it evenly. */
export type Song = {
  id: string;
  name: string;
  bars: string[][];
  /** The chord the song comes to rest on, if that isn't its first chord. */
  home?: string;
  level?: Level;
  /** Where it comes from. */
  about?: string;
  /** A tempo and strum pattern that suit it. */
  bpm?: number;
  patternId?: string;
};

function song(level: Level, id: string, name: string, about: string, bpm: number, patternId: string, chart: string, home?: string): Song {
  const parsed = parseSong(chart);
  if ('error' in parsed) throw new Error(`Song "${name}": ${parsed.error}`);
  return { id, name, level, about, bpm, patternId, bars: parsed.bars, ...(home ? { home } : {}) };
}

/**
 * The built-in library, easiest first within each level.
 *
 * Every song here is traditional or long out of copyright, written in a common,
 * simple guitar arrangement in 4/4 (folk songs have many versions; yours may differ).
 * Charts use bar lines: "| G | G D7 |" is one bar of G, then a bar shared by G and D7.
 */
export const SONGS: Song[] = [
  // ---- warm-ups: chord loops ----
  song('warmup', 'em', 'Just Em', 'One chord, to learn the game', 70, 'ring', '| Em |'),
  song('warmup', 'two', 'Em to G', 'Two chords, two bars each', 70, 'half', '| Em | Em | G | G |'),
  song('warmup', 'folk', 'G, C and D', 'The three chords of countless folk songs', 80, 'quarters', '| G | C | D | G |'),
  song('warmup', 'pop', 'Four-chord loop', 'The loop behind a great many pop songs', 80, 'quarters', '| G | D | Em | C |'),
  song('warmup', 'minor', 'Minor loop', 'Three minor-key chords', 80, 'quarters', '| Am | Dm | E | Am |'),

  // ---- easy ----
  song('easy', 'skip', 'Skip to My Lou', 'American play-party song', 90, 'quarters',
    '| G | G | D7 | D7 | G | G | D7 | G |'),
  song('easy', 'world', "He's Got the Whole World in His Hands", 'Spiritual', 90, 'quarters',
    '| D | D | A7 | A7 | D | D | A7 | D |'),
  song('easy', 'dooley', 'Tom Dooley', 'Appalachian ballad', 90, 'boom-chuck',
    '| D | D | D | A7 | A7 | A7 | A7 | D |'),
  song('easy', 'sailor', 'Drunken Sailor', 'Sea shanty', 100, 'quarters',
    '| Dm | Dm | C | C | Dm | Dm | C | Dm |'),
  song('easy', 'wabash', 'Wabash Cannonball', 'American railroad song', 100, 'boom-chuck',
    '| G | G | C | C | D7 | D7 | G | G |'),
  song('easy', 'midnight', 'Midnight Special', 'American folk song', 100, 'quarters',
    '| C | C | G | G | D7 | D7 | G | G |', 'G'),
  song('easy', 'saints', 'When the Saints Go Marching In', 'New Orleans spiritual', 100, 'quarters',
    '| G | G | G | G | G | G | D7 | D7 | G | G7 | C | C | G | D7 | G | G |'),
  song('easy', 'circle', 'Will the Circle Be Unbroken', 'Hymn, 1907', 90, 'boom-chuck',
    '| G | G | C | G | G | G | G D7 | G |'),
  song('easy', 'ohio', 'Banks of the Ohio', 'American ballad', 90, 'folk',
    '| G | D7 | D7 | G | G | C | G D7 | G |'),

  // ---- medium ----
  song('medium', 'sloop', 'Sloop John B', 'Bahamian folk song', 100, 'folk',
    '| G | G | G | G | G | G | D7 | D7 | G | G7 | C | C | G | D7 | G | G |'),
  song('medium', 'redriver', 'Red River Valley', 'Cowboy song', 90, 'folk',
    '| G | G | G | D7 | G G7 | C | D7 | G |'),
  song('medium', 'swing', 'Swing Low, Sweet Chariot', 'Spiritual', 80, 'folk',
    '| D | G D | D | A7 | D | G D | D A7 | D |'),
  song('medium', 'susanna', 'Oh! Susanna', 'Stephen Foster, 1848', 100, 'folk',
    '| G | G D7 | G | D7 G | G | G D7 | G | D7 G | C | G D7 | G | D7 G |'),
  song('medium', 'jingle', 'Jingle Bells', 'James Pierpont, 1857 (the chorus)', 110, 'folk',
    '| G | G | G | G | C | G | A7 | D7 | G | G | G | G | C | G | D7 | G |'),
  song('medium', 'auld', 'Auld Lang Syne', 'Scottish song', 80, 'half',
    '| G | D7 | G | C | G | D7 | C D7 | G |'),
  song('medium', 'ode', 'Ode to Joy', 'Beethoven, 1824', 100, 'quarters',
    '| G | D7 | G | D7 | G | D7 | G D7 | G |'),
  song('medium', 'bella', 'Bella Ciao', 'Italian folk song', 110, 'folk',
    '| Am | Am | Am | Am | Dm | Am | E7 | Am |'),
  song('medium', 'whiskey', 'Whiskey in the Jar', 'Irish folk song', 110, 'folk',
    '| G | G | Em | Em | C | C | G | G | G | G | Em | Em | C | C | G | G | D | D | G | G | C | C | G D | G |'),
  song('medium', 'blues', '12-bar blues in E', 'The basic blues form', 90, 'folk',
    '| E7 | E7 | E7 | E7 | A7 | A7 | E7 | E7 | B7 | A7 | E7 | B7 |'),
  song('medium', 'ballad', 'Ballad loop with F', 'Four chords, one of them the first barre chord most people learn', 70, 'half',
    '| C | G | Am | F |'),
  song('medium', 'wayfaring', 'Wayfaring Stranger', 'American spiritual', 70, 'half',
    '| Am | Am | Dm | Am | Am | Am | Dm | Am | F | C | F | E7 | Am | Am | Dm | Am |'),
  song('medium', 'wellerman', 'Wellerman', 'New Zealand sea shanty', 100, 'boom-chuck',
    '| Am | Am | Dm | Am | Am | Am | E7 | Am | F | C | Dm | Am | F | C | E7 | Am |'),
  song('medium', 'minorblues', 'Minor blues in Am', 'The blues form in a minor key', 90, 'folk',
    '| Am | Am | Am | Am | Dm | Dm | Am | Am | E7 | Dm | Am | E7 |'),

  // ---- hard ----
  song('hard', 'andalusian', 'Andalusian cadence', 'The falling flamenco progression', 110, 'eighths',
    '| Am | G | F | E |', 'E'),
  song('hard', 'korobeiniki', 'Korobeiniki', 'Russian folk tune, known from Tetris', 130, 'folk',
    '| E | Am | E | Am | Dm | Am | E | Am |', 'Am'),
  song('hard', 'stjames', 'St. James Infirmary', 'American blues ballad', 90, 'folk',
    '| Am E7 | Am | Am F | E7 | Am E7 | Am | F E7 | Am |'),
  song('hard', 'quickblues', 'Quick-change blues in A', 'Blues with an early change and a turnaround', 110, 'folk',
    '| A7 | D7 | A7 | A7 | D7 | D7 | A7 | A7 | E7 | D7 | A7 D7 | A7 E7 |'),
  song('hard', 'ragtime', 'Ragtime turnaround', 'Four dominant chords, two to a bar', 100, 'folk',
    '| C A7 | D7 G7 |'),
  song('hard', 'bamba', 'La Bamba', 'Mexican folk song', 130, 'eighths',
    '| C F | G7 F |'),
  song('hard', 'canon', 'Canon in D', 'Pachelbel, around 1680', 80, 'folk',
    '| D | A | Bm | F#m | G | D | G | A |'),
];

export const DEFAULT_SONG = 'pop';
