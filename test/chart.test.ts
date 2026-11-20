import { describe, expect, test } from 'vitest';
import {
  buildChart, chordAtBeat, getProgression, lengthOptions, nextChange, parseSong, rootFreq, shapeFor, songLength,
} from '../src/game/chart';
import { SONGS } from '../src/game/songs';

const prog = (id: string) => SONGS.find((p) => p.id === id)!;
const song = (o: Partial<Parameters<typeof buildChart>[0]>) => buildChart({ bpm: 120, bars: 8, patternId: 'quarters', progressionId: 'pop', ...o });

describe('typing your own song', () => {
  test('plain chords are one bar each, in any common spelling', () => {
    expect(parseSong('G D Em C')).toEqual({ bars: [['G'], ['D'], ['Em'], ['C']] });
    expect(parseSong('g - d - em - c')).toEqual({ bars: [['G'], ['D'], ['Em'], ['C']] });
    expect(parseSong('Amin, F#m, bb, B7, Gmaj')).toEqual({ bars: [['Am'], ['F#m'], ['Bb'], ['B7'], ['G']] });
  });

  test('bar lines let two or four chords share a bar', () => {
    expect(parseSong('| G | D | Em C |')).toEqual({ bars: [['G'], ['D'], ['Em', 'C']] });
    expect(parseSong('| G D Em |')).toHaveProperty('error');
  });

  test('chords the game cannot check are refused with a reason', () => {
    const r = parseSong('G Dsus4 C');
    expect(r).toHaveProperty('error');
    expect('error' in r && r.error).toContain('Dsus4');
    expect(parseSong('   ')).toHaveProperty('error');
  });

  test('an unreadable custom song falls back to a built-in one', () => {
    expect(getProgression({ bpm: 80, bars: 8, patternId: 'ring', progressionId: 'custom', customChords: 'H J K' }).id).toBe('pop');
    expect(getProgression({ bpm: 80, bars: 8, patternId: 'ring', progressionId: 'custom', customChords: 'A D E' }).bars).toHaveLength(3);
  });
});

describe('song length and ending', () => {
  test('songs are played a whole number of times through', () => {
    expect(lengthOptions(prog('pop'))).toEqual([8, 16, 24, 32]);
    expect(lengthOptions(prog('blues'))).toEqual([12, 24, 36]);
    expect(songLength(prog('blues'), 16, true)).toEqual({ playBars: 12, totalBars: 13 });
  });

  test('the ending is one extra bar on the home chord, left to ring', () => {
    const notes = song({ ringOut: true });
    const last = notes[notes.length - 1];
    expect(last).toMatchObject({ chord: 'G', beat: 32, len: 3.5 });
    expect(song({ progressionId: 'blues', bars: 12, ringOut: true }).at(-1)).toMatchObject({ chord: 'E7', beat: 48 });
    expect(song({ ringOut: false }).at(-1)).toMatchObject({ chord: 'C', beat: 31 });
  });
});

describe('bars shared by two chords', () => {
  const settings = { progressionId: 'custom', customChords: '| G | Em C |', bars: 2, ringOut: false };

  test('the chord follows the beat', () => {
    const p = getProgression({ bpm: 80, patternId: 'ring', ...settings });
    expect([0, 3, 4, 5, 6, 7].map((b) => chordAtBeat(p, b))).toEqual(['G', 'G', 'Em', 'Em', 'C', 'C']);
    expect(nextChange(p, 4.5, 8)).toEqual({ chord: 'C', beat: 6 });
    expect(nextChange(p, 6, 8)).toBeNull();
  });

  test('every chord gets strummed, and long notes stop before the change', () => {
    const notes = song({ ...settings, patternId: 'ring' });
    expect(notes.map((n) => [n.beat, n.chord, n.len])).toEqual([[0, 'G', 3.5], [4, 'Em', 1.5], [6, 'C', 1.5]]);
    expect(notes.map((n) => n.chordChange)).toEqual([true, true, true]);
  });
});

describe('any major, minor or 7th chord has a shape and a bass note', () => {
  test('open shapes where they exist, barre chords elsewhere', () => {
    expect(shapeFor('G')).toEqual([3, 2, 0, 0, 0, 3]);
    expect(shapeFor('F')).toEqual([1, 3, 3, 2, 1, 1]);
    expect(shapeFor('Bm')).toEqual([null, 2, 4, 4, 3, 2]);
    expect(shapeFor('F#m')).toEqual([2, 4, 4, 2, 2, 2]);
    expect(shapeFor('Bb')).toEqual([null, 1, 3, 3, 3, 1]);
    expect(shapeFor('Gsus4')).toBeNull();
  });

  test('bass roots include sharps and flats and stay just under the guitar', () => {
    expect(rootFreq('E')).toBeCloseTo(82.41, 1);
    expect(rootFreq('F#m')).toBeCloseTo(92.5, 1);
    expect(rootFreq('Bb')).toBeCloseTo(116.54, 1);
    expect(rootFreq('B7')).toBeCloseTo(61.74, 1);
  });
});
