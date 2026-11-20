import { describe, expect, test } from 'vitest';
import { chromaFromSpectrum, classify, matchesChord, parseChord } from '../src/audio/chords';
import { shapeFor } from '../src/game/chart';
import { SR, addNoise, playStrums, rng, silence, spectrumDb } from './sim';

const CHORDS = ['G', 'C', 'D', 'Em', 'Am', 'E', 'A', 'Dm', 'E7', 'A7', 'B7', 'F', 'Bm', 'F#m'];
const family = (c: string) => { const p = parseChord(c)!; return `${p.root}${p.quality === 'm' ? 'm' : ''}`; };

/**
 * Strum `prev`, then `played` 0.4 s later, and analyse the way the engine does:
 * one spectrum as the strum starts, one 160 ms later. `diff` is what the strum
 * added; `plain` is everything that is sounding.
 */
function listen(prev: string, played: string, o: { amp?: number; up?: boolean; seed: number }) {
  const rnd = rng(o.seed), sig = silence(1.4), t = 0.8;
  playStrums(sig, [{ t: t - 0.4, shape: shapeFor(prev)! }, { t, shape: shapeFor(played)!, amp: o.amp, up: o.up }], { rnd });
  addNoise(sig, 0.002, rnd);
  const after = spectrumDb(sig, t + 0.17);
  return { diff: classify(chromaFromSpectrum(after, SR, spectrumDb(sig, t + 0.015))), plain: classify(chromaFromSpectrum(after, SR)) };
}

/**
 * 42 strums. `sameChord`: the chord was already ringing (a re-strum inside a bar),
 * where the game also accepts a match on everything that is sounding.
 */
type Trial = { accepted: number; wrongAccepted: number; fumblesAccepted: number };
const done = new Map<string, Trial>();

function trial(o: { amp?: number; up?: boolean; sameChord?: boolean }): Trial {
  const key = JSON.stringify(o);
  if (done.has(key)) return done.get(key)!;
  const rnd = rng(11);
  let accepted = 0, wrongAccepted = 0, fumblesAccepted = 0, total = 0;
  for (let round = 0; round < 3; round++) for (const played of CHORDS) {
    const prev = o.sameChord ? played : CHORDS[Math.floor(rnd() * CHORDS.length)];
    const { diff, plain } = listen(prev, played, { ...o, seed: 100 + total });
    const ok = (c: string, lenient: boolean) => matchesChord(diff, c) || (lenient && matchesChord(plain, c));
    total++;
    if (ok(played, !!o.sameChord)) accepted++;
    for (const other of CHORDS) if (family(other) !== family(played) && ok(other, !!o.sameChord)) wrongAccepted++;
    // a fumble: the song still wants `prev`, which is ringing, but the player strums `played`
    if (family(prev) !== family(played) && ok(prev, true)) fumblesAccepted++;
  }
  const result = { accepted, wrongAccepted, fumblesAccepted };
  done.set(key, result);
  return result;
}

describe('chord recognition on a simulated guitar', () => {
  test('a chord change is recognised with the old chord still ringing', () => {
    const r = trial({});
    expect(r.accepted).toBeGreaterThanOrEqual(40); // of 42
    expect(r.wrongAccepted).toBeLessThanOrEqual(8); // of 534 chances
  });

  test('…also on a soft strum, and on an upstroke that only catches the top strings', () => {
    expect(trial({ amp: 0.05 }).accepted).toBeGreaterThanOrEqual(34);
    expect(trial({ up: true, amp: 0.08 }).accepted).toBeGreaterThanOrEqual(36);
  });

  test('strumming the same chord again, down or up, stays correct', () => {
    expect(trial({ sameChord: true }).accepted).toBeGreaterThanOrEqual(41);
    expect(trial({ sameChord: true, up: true, amp: 0.08 }).accepted).toBeGreaterThanOrEqual(40);
  });

  test('switching to another chord too early is still caught on a full strum', () => {
    expect(trial({}).fumblesAccepted).toBeLessThanOrEqual(2);
    expect(trial({ up: true, amp: 0.08 }).fumblesAccepted).toBeLessThanOrEqual(9); // soft upstrokes are judged kindly
  });
});
