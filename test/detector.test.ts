import { describe, expect, test } from 'vitest';
import { shapeFor } from '../src/game/chart';
import { addNoise, clickInto, playStrums, rng, runDetector, silence, type Strum } from './sim';

const G = shapeFor('G')!, D = shapeFor('D')!;

/** How many strums were caught (within 50 ms), how many detections were extra, and the worst lateness. */
function score(strums: Strum[], sensitivity: number, seed = 3) {
  const rnd = rng(seed), sig = silence(8);
  playStrums(sig, strums, { rnd });
  addNoise(sig, 0.002, rnd);
  const found = runDetector(sig, sensitivity).onsets.map((o) => o.time);
  const errs = strums.map((s) => found.find((x) => Math.abs(x - s.t) < 0.05)).map((x, i) => (x === undefined ? null : x - strums[i].t));
  const hits = errs.filter((e): e is number => e !== null);
  return { caught: hits.length, extra: found.length - hits.length, worstLate: Math.max(...hits) };
}

describe('strum detector', () => {
  test('catches soft strums played over a loud chord that is still ringing', () => {
    const strums = Array.from({ length: 14 }, (_, k) => ({ t: 0.5 + k * 0.5, shape: G, amp: k % 2 ? 0.05 : 0.2 }));
    const r = score(strums, 0.6);
    expect(r.caught).toBeGreaterThanOrEqual(13);
    expect(r.extra).toBe(0);
    expect(r.worstLate).toBeLessThan(0.03);
  });

  test('catches down-up eighth notes with soft upstrokes on the top strings', () => {
    const strums = Array.from({ length: 16 }, (_, k) => ({ t: 0.5 + k * 0.375, shape: k < 8 ? G : D, amp: k % 2 ? 0.05 : 0.15, up: k % 2 === 1 }));
    const r = score(strums, 0.6);
    expect(r.caught).toBeGreaterThanOrEqual(14);
    expect(r.extra).toBe(0);
  });

  test('fast eighths (140 bpm) need a higher sensitivity, and then work', () => {
    const strums = Array.from({ length: 24 }, (_, k) => ({ t: 0.5 + k * 0.214, shape: G, amp: k % 2 ? 0.06 : 0.12, up: k % 2 === 1 }));
    const r = score(strums, 0.9);
    expect(r.caught).toBeGreaterThanOrEqual(20);
    expect(r.extra).toBeLessThanOrEqual(1);
  });

  test('a chord left to ring counts once, however long it rings', () => {
    for (const sens of [0.3, 0.6, 0.9]) expect(score([{ t: 0.5, shape: G, amp: 0.2 }], sens)).toMatchObject({ caught: 1, extra: 0 });
  });

  test('catches muted chucks between normal strums', () => {
    const strums = Array.from({ length: 8 }, (_, k) => ({ t: 0.5 + k * 0.75, shape: G, dead: k % 2 === 1 }));
    expect(score(strums, 0.6)).toMatchObject({ caught: 8, extra: 0 });
  });

  test('steady room noise does not count as strumming', () => {
    for (const rms of [0.003, 0.01]) {
      const sig = silence(10);
      addNoise(sig, rms * 1.73, rng(9));
      expect(runDetector(sig, 0.6).onsets.filter((o) => o.time > 0.3)).toHaveLength(0);
    }
  });

  test("the game's own click, heard through speakers, is ignored", () => {
    for (const level of [0.1, 0.7]) {
      const alone = silence(8);
      for (let b = 0; b < 9; b++) clickInto(alone, 0.5 + b * 0.75, b % 4 === 0, level);
      addNoise(alone, 0.002, rng(4));
      expect(runDetector(alone, 0.6).onsets).toHaveLength(0);
      expect(runDetector(alone, 0.9).onsets).toHaveLength(0);

      const overChord = silence(4), rnd = rng(5);
      playStrums(overChord, [{ t: 0.5, shape: G, amp: 0.1 }], { rnd, tau: 1.0, harmonicDecay: 0.5 });
      for (let b = 0; b < 4; b++) clickInto(overChord, 0.5 + b * 0.75, b === 0, level);
      addNoise(overChord, 0.002, rnd);
      expect(runDetector(overChord, 0.9).onsets).toHaveLength(1); // just the strum
    }
  });
});
