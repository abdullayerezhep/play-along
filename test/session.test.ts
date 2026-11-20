import { describe, expect, test } from 'vitest';
import type { ChordResult } from '../src/audio/chords';
import { buildChart } from '../src/game/chart';
import { accuracy, grade } from '../src/game/judge';
import { Session, type GameEvent, type Probe } from '../src/game/session';

const BPM = 80, SPB = 60 / BPM, START = 10; // song starts at audio-clock second 10

function setup(patternId: string, opts: { checkChords?: boolean; bars?: number; ringOut?: boolean } = {}) {
  const events: GameEvent[] = [];
  const probe: Probe = { suddenDrop: () => false, decayRatio: () => 0.8, keyHeld: false, keyReleasedAt: -Infinity };
  const notes = buildChart({ bpm: BPM, bars: opts.bars ?? 4, patternId, progressionId: 'pop', ringOut: opts.ringOut ?? false });
  const session = new Session({
    notes, spb: SPB, startTime: START, latency: 0, checkChords: opts.checkChords ?? false, probe, emit: (e) => events.push(e),
  });
  const at = (beat: number) => START + beat * SPB;
  const frame = (beat: number) => session.update(beat * SPB, at(beat));
  return { session, events, probe, notes, at, frame };
}

const heard = (name: string, clarity = 0.9): ChordResult => ({ best: { name, score: 1 }, ranked: [{ name, score: 1 }], chroma: [], clarity });

describe('strums and notes', () => {
  test('a strum on the beat is perfect, a slightly late one is good, a far one hits nothing', () => {
    const { session, events, at } = setup('quarters');
    session.strum({ time: at(0) + 0.01, level: 1, source: 'key' });
    session.strum({ time: at(1) + 0.1, level: 1, source: 'key' });
    session.strum({ time: at(2) + 0.2, level: 1, source: 'key' });
    expect(events.map((e) => (e.type === 'hit' ? e.grade : e.type))).toEqual(['perfect', 'good', 'extra']);
    expect(events[1]).toMatchObject({ offset: expect.closeTo(0.1, 5) });
  });

  test('strumming non-stop no longer earns a top grade', () => {
    const { session, frame, at } = setup('folk', { bars: 8 });
    for (let b = 0; b < 32; b += 0.25) { session.strum({ time: at(b) + 0.02, level: 1, source: 'key' }); frame(b); }
    frame(40);
    expect(session.stats.perfect).toBe(48);        // every note was hit…
    expect(session.stats.extra).toBeGreaterThan(70); // …by strumming far too much
    expect(session.stats.maxCombo).toBeLessThan(4);
    expect(['C', 'D']).toContain(grade(accuracy(session.stats)));
  });

  test('playing exactly the pattern still scores 100%', () => {
    const { session, frame, at, notes } = setup('folk', { bars: 8 });
    for (const n of notes) { session.strum({ time: at(n.beat) + 0.01, level: 1, source: 'key' }); frame(n.beat); }
    frame(40);
    expect(session.stats).toMatchObject({ perfect: notes.length, extra: 0, miss: 0 });
    expect(accuracy(session.stats)).toBe(1);
  });

  test('quiet thumps and a strum heard twice are not counted as extra strums', () => {
    const { session, at } = setup('quarters');
    session.strum({ time: at(0), level: 0.2, source: 'mic' });
    session.strum({ time: at(0) + 0.11, level: 0.2, source: 'mic' });  // same strum, heard twice
    session.strum({ time: at(0.5), level: 0.03, source: 'mic' });      // hand landing on the strings
    expect(session.stats.extra).toBe(0);
    session.strum({ time: at(0.5) + 0.1, level: 0.18, source: 'mic' }); // a real strum off the beat
    expect(session.stats.extra).toBe(1);
  });

  test('notes nobody played become misses', () => {
    const { session, frame, events } = setup('quarters');
    frame(2);
    expect(session.stats.miss).toBe(2);
    expect(events.some((e) => e.type === 'miss')).toBe(true);
  });
});

describe('chord check', () => {
  test('points wait for the chord; the wrong chord scores nothing and ends the streak', () => {
    const { session, events, at } = setup('quarters', { checkChords: true });
    session.strum({ time: at(0), level: 0.2, source: 'mic' });
    expect(session.stats.score).toBe(0);
    session.chord(at(0), heard('G'));
    expect(session.stats).toMatchObject({ perfect: 1, combo: 1 });
    session.strum({ time: at(1), level: 0.2, source: 'mic' });
    session.chord(at(1), heard('C'));
    expect(session.stats).toMatchObject({ perfect: 1, wrong: 1, combo: 0 });
    expect(events.at(-1)).toMatchObject({ type: 'wrongChord', heard: 'C' });
  });

  test('re-strumming a chord that is already ringing may match on the whole sound; a chord change may not', () => {
    const { session, at } = setup('quarters', { checkChords: true, bars: 8 });
    session.strum({ time: at(0), level: 0.2, source: 'mic' });
    session.chord(at(0), heard('G'));
    session.strum({ time: at(1), level: 0.1, source: 'mic' });  // soft re-strum: the added sound alone is unclear
    session.chord(at(1), heard('Bm'), heard('G'));
    expect(session.stats).toMatchObject({ perfect: 2, wrong: 0 });
    session.strum({ time: at(4), level: 0.2, source: 'mic' });  // bar 2 wants D, but G is what was added
    session.chord(at(4), heard('G'), heard('D'));
    expect(session.stats.wrong).toBe(1);
  });

  test('a chuck must sound dead', () => {
    const { session, probe, at } = setup('boom-chuck', { checkChords: true });
    session.strum({ time: at(1), level: 0.2, source: 'mic' });
    session.chord(at(1), heard('G', 0.3)); // no clear chord in the sound
    expect(session.stats.perfect).toBe(1);
    probe.decayRatio = () => 0.8;          // next one rings on with a clear chord
    session.strum({ time: at(3), level: 0.2, source: 'mic' });
    session.chord(at(3), heard('G'));
    expect(session.stats.wrong).toBe(1);
  });
});

describe('long notes and chops', () => {
  test('a long note scores while it rings and completes at the end of its tail', () => {
    const { session, events, probe, at, frame } = setup('ring');
    probe.keyHeld = true;
    session.strum({ time: at(0), level: 1, source: 'key' });
    frame(1); frame(2); frame(3.6);
    expect(events.at(-1)).toMatchObject({ type: 'rangOut' });
    expect(session.stats).toMatchObject({ holds: 1, holdsDone: 1 });
    expect(session.stats.score).toBeGreaterThan(100);
  });

  test('muting or strumming again breaks it, but not in the last moment', () => {
    const a = setup('ring');
    a.session.strum({ time: a.at(0), level: 0.2, source: 'mic' });
    a.frame(0.5);
    a.probe.suddenDrop = () => true;
    a.frame(1);
    expect(a.events.at(-1)).toMatchObject({ type: 'holdBroken', why: 'chord was cut off' });

    const b = setup('ring');
    b.session.strum({ time: b.at(0), level: 0.2, source: 'mic' });
    b.frame(0.5);
    b.session.strum({ time: b.at(2), level: 0.2, source: 'mic' });
    expect(b.events.some((e) => e.type === 'holdBroken' && e.why === 'strummed again')).toBe(true);

    const c = setup('ring');
    c.session.strum({ time: c.at(0), level: 0.2, source: 'mic' });
    c.frame(3);
    c.probe.suddenDrop = () => true;
    c.frame(3.3); // tail ends at 3.5
    expect(c.events.at(-1)).toMatchObject({ type: 'rangOut' });
  });

  test('a chop earns its bonus only when the sound is cut short', () => {
    const { session, events, probe, at, frame } = setup('skank');
    probe.decayRatio = () => 0.05;
    session.strum({ time: at(1), level: 0.2, source: 'mic' });
    frame(1.6);
    probe.decayRatio = () => 0.7;
    session.strum({ time: at(3), level: 0.2, source: 'mic' });
    frame(3.6);
    expect(events.filter((e) => e.type === 'chop').map((e) => e.type === 'chop' && e.ok)).toEqual([true, false]);
    expect(session.stats).toMatchObject({ chops: 2, chopsOk: 1, extra: 0 });
  });
});
