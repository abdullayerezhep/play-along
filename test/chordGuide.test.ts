import { describe, expect, test } from 'vitest';
import { CHORD_GROUPS, chordGuide } from '../src/game/chordGuide';
import { SONGS } from '../src/game/songs';

describe('chord guide', () => {
  test('explains an open chord finger by finger', () => {
    const g = chordGuide('C')!;
    expect(g).toMatchObject({ fullName: 'C major', notes: ['C', 'E', 'G'], barre: false });
    expect(g.steps).toEqual([
      'Index finger: 1st fret of the B string.',
      'Middle finger: 2nd fret of the D string.',
      'Ring finger: 3rd fret of the A string.',
      'The G and high E strings ring open, with no finger on them.',
      'Strum from the A string down. Leave out the low E string.',
    ]);
    expect(g.tip).not.toBe('');
  });

  test('explains a barre chord, including the barre itself', () => {
    const f = chordGuide('F')!;
    expect(f.barre).toBe(true);
    expect(f.steps[0]).toBe('Index finger: lay it flat across the 1st fret, from the low E string to the high E string.');
    expect(f.steps.at(-1)).toBe('Strum all six strings.');
    const bm = chordGuide('Bm')!;
    expect(bm.steps[0]).toContain('2nd fret, from the A string to the high E string');
    expect(bm.steps.at(-1)).toContain('Leave out the low E string');
  });

  test('every fingering agrees with its shape', () => {
    const all = new Set([...CHORD_GROUPS.flatMap((g) => g.chords), ...SONGS.flatMap((s) => s.bars.flat())]);
    for (const chord of all) {
      const g = chordGuide(chord)!;
      expect(g, chord).not.toBeNull();
      g.shape.forEach((fret, s) => {
        const finger = g.fingers[s];
        if (fret === null) expect(finger, `${chord} string ${s}`).toBeNull();
        else if (fret === 0) expect(finger, `${chord} string ${s}`).toBe(0);
        else expect(finger, `${chord} string ${s}`).toBeGreaterThan(0);
      });
      // a finger can only be in one fret, and lower-numbered fingers are never further up the neck
      const frets = [1, 2, 3, 4].map((f) => g.shape.filter((_, s) => g.fingers[s] === f) as number[]);
      for (const fs of frets) expect(new Set(fs).size, chord).toBeLessThanOrEqual(1);
      const used = frets.filter((fs) => fs.length).map((fs) => fs[0]);
      expect([...used].sort((a, b) => a - b), chord).toEqual(used);
      expect(g.tip, chord).not.toBe('');
    }
  });

  test('every chord used by a library song is explained in the guide', () => {
    const listed = new Set(CHORD_GROUPS.flatMap((g) => g.chords));
    const used = new Set(SONGS.flatMap((s) => s.bars.flat()));
    expect([...used].filter((c) => !listed.has(c))).toEqual([]);
  });

  test('says which songs a chord is good for', () => {
    expect(chordGuide('Em')!.songs.length).toBeGreaterThan(1);
  });
});
