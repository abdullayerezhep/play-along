import { describe, expect, test } from 'vitest';
import { PATTERNS, buildChart, getProgression, lengthOptions, shapeFor, songMap, suggestedBars } from '../src/game/chart';
import { DEFAULT_SONG, LEVELS, SONGS } from '../src/game/songs';

const settingsFor = (id: string) => {
  const s = SONGS.find((x) => x.id === id)!;
  return { bpm: s.bpm!, bars: suggestedBars(s), patternId: s.patternId!, progressionId: id, ringOut: true };
};

describe('song library', () => {
  test('has songs at every level, with unique ids', () => {
    for (const l of LEVELS) expect(SONGS.filter((s) => s.level === l.id).length).toBeGreaterThanOrEqual(5);
    expect(new Set(SONGS.map((s) => s.id)).size).toBe(SONGS.length);
    expect(SONGS.some((s) => s.id === DEFAULT_SONG)).toBe(true);
  });

  test('each level above the warm-ups has both hits and traditional songs', () => {
    for (const level of ['easy', 'medium', 'hard']) for (const group of ['hit', 'trad']) {
      expect(SONGS.filter((s) => s.level === level && s.group === group).length, `${level} ${group}`).toBeGreaterThanOrEqual(5);
    }
    for (const s of SONGS.filter((x) => x.group === 'hit')) expect(s.about, s.name).toBeTruthy(); // names the artist
  });

  test('every song can be played: known strum, sensible tempo, a shape for every chord', () => {
    for (const s of SONGS) {
      expect(PATTERNS.some((p) => p.id === s.patternId), s.name).toBe(true);
      expect(s.bpm, s.name).toBeGreaterThanOrEqual(50);
      expect(s.bpm, s.name).toBeLessThanOrEqual(160);
      for (const chord of s.bars.flat()) expect(shapeFor(chord), `${s.name}: ${chord}`).not.toBeNull();
      if (s.home) expect(s.bars.flat(), s.name).toContain(s.home);
      const notes = buildChart(settingsFor(s.id));
      expect(notes.length, s.name).toBeGreaterThan(4);
      expect(lengthOptions(s), s.name).toContain(songMap(settingsFor(s.id)).playBars);
    }
  });

  test('levels really get harder: more chords, then barre chords and mid-bar changes', () => {
    const chords = (level: string) => SONGS.filter((s) => s.level === level).map((s) => new Set(s.bars.flat()).size);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(Math.max(...chords('easy'))).toBeLessThanOrEqual(4);
    expect(avg(chords('medium'))).toBeGreaterThan(avg(chords('easy')));
    // easy songs give at least a whole bar per chord, except one closing change
    for (const s of SONGS.filter((x) => x.level === 'easy')) expect(s.bars.filter((b) => b.length > 1).length, s.name).toBeLessThanOrEqual(1);
    // every hard song has a barre chord or changes inside the bar
    const isBarre = (c: string) => { const sh = shapeFor(c)!; return !sh.includes(0); };
    for (const s of SONGS.filter((x) => x.level === 'hard')) {
      expect(s.bars.flat().some(isBarre) || s.bars.some((b) => b.length > 1) || s.bpm! >= 120, s.name).toBe(true);
    }
  });

  test('songs end on their home chord, even when they start on another', () => {
    expect(buildChart(settingsFor('korobeiniki')).at(-1)).toMatchObject({ chord: 'Am', len: 3.5 });
    expect(buildChart(settingsFor('midnight')).at(-1)!.chord).toBe('G');
    expect(buildChart(settingsFor('saints')).at(-1)).toMatchObject({ chord: 'G', beat: 64 });
  });

  test('long songs are offered once or twice through', () => {
    expect(lengthOptions(SONGS.find((s) => s.id === 'whiskey')!)).toEqual([24, 48]);
    expect(lengthOptions(SONGS.find((s) => s.id === 'saints')!)).toEqual([16, 32]);
  });
});

describe('songs the player saved', () => {
  const mySongs = [{ id: 'my:abc', name: 'Campfire', chords: '| A | D | E7 A |', bpm: 96, patternId: 'folk' }];

  test('play like library songs', () => {
    const p = getProgression({ bpm: 96, bars: 8, patternId: 'folk', progressionId: 'my:abc', mySongs });
    expect(p).toMatchObject({ name: 'Campfire', bars: [['A'], ['D'], ['E7', 'A']] });
  });

  test('a deleted song falls back to the default', () => {
    expect(getProgression({ bpm: 96, bars: 8, patternId: 'folk', progressionId: 'my:gone', mySongs }).id).toBe(DEFAULT_SONG);
  });
});
