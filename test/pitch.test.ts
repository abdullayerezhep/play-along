import { describe, expect, test } from 'vitest';
import { GUITAR_STRINGS, detectPitch, nearestString } from '../src/audio/pitch';
import { SR, addNoise, playStrums, rng, silence } from './sim';

/** Pluck one open string, `cents` away from standard tuning, and read the waveform 0.3 s later. */
function pluck(string: number, cents: number) {
  const sig = silence(1), rnd = rng(string + 1);
  const shape = [null, null, null, null, null, null] as (number | null)[];
  shape[string] = 0;
  // retune by resampling: stretch time by the frequency ratio
  playStrums(sig, [{ t: 0.05, shape, amp: 0.15 }], { rnd, detuneCents: 0 });
  const ratio = 2 ** (cents / 1200), out = new Float32Array(4096);
  for (let i = 0; i < out.length; i++) {
    const x = (0.35 * SR + i) * ratio, k = Math.floor(x);
    out[i] = sig[k] + (sig[k + 1] - sig[k]) * (x - k);
  }
  addNoise(out, 0.001, rnd);
  return out;
}

describe('tuner', () => {
  test('names each open string and reads it within 2 cents', () => {
    GUITAR_STRINGS.forEach((_, i) => {
      for (const cents of [-30, 0, 18]) {
        const f = detectPitch(pluck(i, cents), SR);
        expect(f).not.toBeNull();
        const r = nearestString(f!);
        expect(r.index).toBe(i);
        expect(Math.abs(r.cents - cents)).toBeLessThan(2);
      }
    });
  });

  test('says nothing about silence or noise', () => {
    expect(detectPitch(new Float32Array(4096), SR)).toBeNull();
    const noise = new Float32Array(4096);
    addNoise(noise, 0.05, rng(2));
    expect(detectPitch(noise, SR)).toBeNull();
  });
});
