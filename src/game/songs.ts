import { parseSong } from './songText';

export type Level = 'warmup' | 'easy' | 'medium' | 'hard';
export type Group = 'hit' | 'trad';

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
  /** A well-known recording, or a traditional tune. */
  group?: Group;
  /** Who made it famous or where it comes from, plus anything needed to match the record. */
  about?: string;
  /** A tempo and strum pattern that suit it. */
  bpm?: number;
  patternId?: string;
};

function song(level: Level, id: string, name: string, about: string, bpm: number, patternId: string, chart: string, home?: string): Song {
  const parsed = parseSong(chart);
  if ('error' in parsed) throw new Error(`Song "${name}": ${parsed.error}`);
  return { id, name, level, group: 'trad', about, bpm, patternId, bars: parsed.bars, ...(home ? { home } : {}) };
}

/** A well-known song: `artist` is who made it famous, plus a capo note where the record is in another key. */
const hit = (level: Level, id: string, name: string, artist: string, bpm: number, patternId: string, chart: string, home?: string): Song =>
  ({ ...song(level, id, name, artist, bpm, patternId, chart, home), group: 'hit' });

/**
 * Well-known songs, as chord charts only: no lyrics and no melodies.
 *
 * They are simplified to the major, minor and 7th chords the game can check, so a
 * sus or add9 chord on the record is written as its plain chord here. Most give the
 * main sections (verse, then chorus) as one loop rather than the full arrangement.
 */
const HITS: Song[] = [
  // ---- easy ----
  hit('easy', 'zombie', 'Zombie', 'The Cranberries', 84, 'folk', '| Em | C | G | D |'),
  hit('easy', 'riptide', 'Riptide', 'Vance Joy, capo 1 matches the record', 100, 'folk', '| Am | G | C | C |', 'C'),
  hit('easy', 'standbyme', 'Stand By Me', 'Ben E. King, capo 2 matches the record', 110, 'boom-chuck',
    '| G | G | Em | Em | C | D | G | G |'),
  hit('easy', 'whatsup', "What's Up?", '4 Non Blondes, capo 2 matches the record', 68, 'folk', '| G | Am | C | G |'),
  hit('easy', 'imyours', "I'm Yours", 'Jason Mraz, capo 4 matches the record', 75, 'folk', '| G | D | Em | C |'),
  hit('easy', 'wagonwheel', 'Wagon Wheel', 'Old Crow Medicine Show, capo 2 matches the record', 74, 'folk',
    '| G | D | Em | C | G | D | C | C |'),
  hit('easy', 'birds', 'Three Little Birds', 'Bob Marley', 76, 'offbeat',
    '| A | A | D | A | A | A | D | A | A | E | A | D | A | E | D | A |'),
  hit('easy', 'zvezda', 'Звезда по имени Солнце', 'Кино', 112, 'folk-chuck',
    '| Am | C | Dm | G | Am | C | Dm | G | Dm | Am |'),
  hit('easy', 'countryroads', 'Take Me Home, Country Roads', 'John Denver, capo 2 matches the record', 82, 'boom-chuck',
    '| G | G | Em | Em | D | D | C | G | G | G | D | D | Em | Em | C | C | G | G | D | D | C | C | G | G |'),
  hit('easy', 'vivalavida', 'Viva la Vida', 'Coldplay, capo 1 matches the record', 138, 'down-up', '| C | D | G | Em |', 'G'),

  // ---- medium ----
  hit('medium', 'knockin', "Knockin' on Heaven's Door", 'Bob Dylan', 70, 'folk', '| G D | Am | G D | C |'),
  hit('medium', 'sweethome', 'Sweet Home Alabama', 'Lynyrd Skynyrd', 98, 'folk', '| D C | G |'),
  hit('medium', 'letitbe', 'Let It Be', 'The Beatles', 72, 'down-up',
    '| C G | Am F | C G | F C | C G | Am F | C G | F C | Am G | F C | C G | F C |'),
  hit('medium', 'nowoman', 'No Woman, No Cry', 'Bob Marley', 78, 'offbeat', '| C G | Am F | C F | C G |'),
  hit('medium', 'wildthing', 'Wild Thing', 'The Troggs', 105, 'down-up', '| A D | E D |'),
  hit('medium', 'rain', 'Have You Ever Seen the Rain', 'Creedence Clearwater Revival', 116, 'folk',
    '| C | C | C | C | G | G | C | C | F | G | C | Am | F | G | C | C |'),
  hit('medium', 'badmoon', 'Bad Moon Rising', 'Creedence Clearwater Revival', 150, 'down-up',
    '| D | A G | D | D | D | A G | D | D | G | G | D | D | A | G | D | D |'),
  hit('medium', 'browneyed', 'Brown Eyed Girl', 'Van Morrison', 148, 'down-up',
    '| G | C | G | D | G | C | G | D | G | C | G | D | G | C | G | D | C | D | G | Em | C | D | G | D |'),
  hit('medium', 'wish', 'Wish You Were Here', 'Pink Floyd (the verse)', 60, 'folk', '| C | D | Am | G | D | C | Am | G |', 'G'),
  hit('medium', 'savetonight', 'Save Tonight', 'Eagle-Eye Cherry', 120, 'folk', '| Am F | C G |'),
  hit('medium', 'sweetchild', "Sweet Child o' Mine", "Guns N' Roses", 125, 'folk',
    '| D | D | C | C | G | G | D | D | D | D | C | C | G | G | D | D | A | C | D | D | A | C | D | D |'),
  hit('medium', 'someone', 'Someone You Loved', 'Lewis Capaldi, capo 1 matches the record', 110, 'half', '| C | G | Am | F |'),
  hit('medium', 'withorwithout', 'With or Without You', 'U2', 110, 'eighths', '| D | A | Bm | G |'),
  hit('medium', 'despacito', 'Despacito', 'Luis Fonsi', 89, 'folk', '| Bm | G | D | A |'),
  hit('medium', 'poplanu', 'Всё идёт по плану', 'Гражданская оборона', 132, 'eighths', '| Am | F | C | E |'),
  hit('medium', 'gruppakrovi', 'Группа крови', 'Кино, in Am (the record is in F#m)', 125, 'folk-chuck',
    '| Am | Am | Em | Em | Am | Am | G | G | Am | Am | Em | Em | Dm | Dm | G | G |'),

  // ---- hard ----
  hit('hard', 'shape', 'Shape of You', 'Ed Sheeran, capo 4 matches the record', 96, 'offbeat', '| Am Dm | F G |'),
  hit('hard', 'heyjoe', 'Hey Joe', 'Jimi Hendrix', 82, 'folk', '| C G | D A | E | E |', 'E'),
  hit('hard', 'boulevard', 'Boulevard of Broken Dreams', 'Green Day, capo 1 matches the record', 83, 'folk',
    '| Em G | D A | Em G | D A | Em G | D A | Em G | D A | C G | D Em | C G | D Em | C G | D Em | C G | B7 |'),
  hit('hard', 'creep', 'Creep', 'Radiohead', 92, 'folk', '| G | G | B | B | C | C | Cm | Cm |'),
  hit('hard', 'hotel', 'Hotel California', 'Eagles', 74, 'folk',
    '| Bm | F# | A | E | G | D | Em | F# | G | D | F# | Bm | G | D | Em | F# |'),
];

/**
 * Traditional songs and loops, easiest first within each level.
 *
 * Each is traditional or long out of copyright, written in a common, simple guitar
 * arrangement in 4/4 (folk songs have many versions; yours may differ).
 * Charts use bar lines: "| G | G D7 |" is one bar of G, then a bar shared by G and D7.
 */
const TRADITIONAL: Song[] = [
  // ---- warm-ups: chord loops ----
  song('warmup', 'em', 'Just Em', 'One chord, to learn the game', 70, 'ring', '| Em |'),
  song('warmup', 'two', 'Em to G', 'Two chords, two bars each', 70, 'half', '| Em | Em | G | G |'),
  song('warmup', 'folk', 'G, C and D', 'The three chords of countless folk songs', 80, 'down-up', '| G | C | D | G |'),
  song('warmup', 'pop', 'Four-chord loop', 'The loop behind a great many pop songs', 80, 'quarters', '| G | D | Em | C |'),
  song('warmup', 'minor', 'Minor loop', 'Three minor-key chords', 80, 'quarters', '| Am | Dm | E | Am |'),

  // ---- easy ----
  song('easy', 'skip', 'Skip to My Lou', 'American play-party song', 90, 'quarters',
    '| G | G | D7 | D7 | G | G | D7 | G |'),
  song('easy', 'world', "He's Got the Whole World in His Hands", 'Spiritual', 90, 'quarters',
    '| D | D | A7 | A7 | D | D | A7 | D |'),
  song('easy', 'dooley', 'Tom Dooley', 'Appalachian ballad', 90, 'boom-chuck',
    '| D | D | D | A7 | A7 | A7 | A7 | D |'),
  song('easy', 'sailor', 'Drunken Sailor', 'Sea shanty', 100, 'down-up',
    '| Dm | Dm | C | C | Dm | Dm | C | Dm |'),
  song('easy', 'wabash', 'Wabash Cannonball', 'American railroad song', 100, 'boom-chuck',
    '| G | G | C | C | D7 | D7 | G | G |'),
  song('easy', 'midnight', 'Midnight Special', 'American folk song', 100, 'down-up',
    '| C | C | G | G | D7 | D7 | G | G |', 'G'),
  song('easy', 'saints', 'When the Saints Go Marching In', 'New Orleans spiritual', 100, 'down-up',
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

export const SONGS: Song[] = [...HITS, ...TRADITIONAL];

export const DEFAULT_SONG = 'pop';
