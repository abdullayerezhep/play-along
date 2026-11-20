import { describe, expect, test } from 'vitest';
import { shapeFor } from '../src/game/chart';
import { addNoise, clickInto, playStrums, rng, runDetector, silence, type Strum } from './sim';

const G = shapeFor('G')!, T0 = 0.5;

/** Play one strum and report how the "is it still ringing?" checks see it. */
function ring(strum: Partial<Strum>, o: { tau: number; clickLevel?: number }) {
  const rnd = rng(7), sig = silence(4);
  playStrums(sig, [{ t: T0, shape: G, ...strum }], { rnd, tau: o.tau, harmonicDecay: 0.5 });
  if (o.clickLevel) for (let b = 0; b < 4; b++) clickInto(sig, T0 + b * 0.75, b === 0, o.clickLevel);
  addNoise(sig, 0.0015, rnd);
  let cutOffAt: number | null = null;
  const { history } = runDetector(sig, 0.6, (time, h) => {
    if (cutOffAt === null && time > T0 + 0.1 && time < T0 + 2.6 && h.suddenDrop(T0)) cutOffAt = time - T0;
  });
  return { cutOffAt, ratio: (dt: number) => history.decayRatio(T0, T0 + dt)! };
}

describe('ringing or muted?', () => {
  test('a chord left alone is never reported as cut off, on a bright or a dull guitar', () => {
    for (const tau of [0.6, 1.0, 1.5]) for (const amp of [0.12, 0.03]) {
      const r = ring({ amp }, { tau });
      expect(r.cutOffAt).toBeNull();
      expect(r.ratio(0.22)).toBeGreaterThan(0.5);
    }
  });

  test('muting a ringing chord is noticed within about a tenth of a second', () => {
    for (const tau of [0.6, 1.5]) {
      const r = ring({ muteAt: 1.2 }, { tau });
      expect(r.cutOffAt).not.toBeNull();
      expect(r.cutOffAt!).toBeGreaterThan(1.2);
      expect(r.cutOffAt!).toBeLessThan(1.35);
    }
  });

  test('a chop and a chuck are both nearly silent a moment after the strum', () => {
    expect(ring({ muteAt: 0.1 }, { tau: 1.0 }).ratio(0.25)).toBeLessThan(0.3);
    expect(ring({ dead: true }, { tau: 1.0 }).ratio(0.15)).toBeLessThan(0.3);
  });

  test('the metronome click coming through the speakers does not look like a mute', () => {
    for (const clickLevel of [0.1, 0.5]) expect(ring({}, { tau: 1.0, clickLevel }).cutOffAt).toBeNull();
  });
});
