import { matchesChord, type ChordResult } from '../audio/chords';
import type { Note } from './chart';
import {
  GOOD_WINDOW, confirmChord, emptyStats, extraStrum, holdTick, judgeStrum, median, multiplier, rejectChord, sweepMisses,
  type Stats,
} from './judge';

/** What the rules need to know about the sound after a strum. The audio engine provides it; tests fake it. */
export type Probe = {
  /** Has the sound of the strum at `onset` been cut off suddenly? */
  suddenDrop(onset: number): boolean;
  /** Loudness at `at` compared with the strum's peak (null = not measured yet). */
  decayRatio(onset: number, at: number): number | null;
  /** Keyboard stand-in for the guitar. */
  keyHeld: boolean;
  keyReleasedAt: number;
};

export type StrumInput = { time: number; level: number; source: 'mic' | 'key' };

export type GameEvent =
  | { type: 'hit'; note: Note; grade: 'perfect' | 'good'; offset: number }
  | { type: 'extra' }
  | { type: 'miss' }
  | { type: 'heard'; name: string; ok: boolean }
  | { type: 'wrongChord'; note: Note; heard: string }
  | { type: 'notMuted'; note: Note }
  | { type: 'rangOut'; note: Note; points: number }
  | { type: 'holdBroken'; note: Note; why: string }
  | { type: 'chop'; note: Note; ok: boolean };

type Options = {
  notes: Note[];
  spb: number;
  /** AudioContext time of the song's first beat. */
  startTime: number;
  /** Measured mic delay, in seconds. */
  latency: number;
  checkChords: boolean;
  probe: Probe;
  emit: (e: GameEvent) => void;
};

/** A chuck counts as muted, and a chop as cut short, if the sound fell below this fraction of its peak. */
const MUTED_RATIO = 0.3;
const UNCLEAR = 0.55; // below this "clarity" there is no real chord in the sound

/**
 * The rules of one play-through: which strum hits which note, whether the chord was
 * right, whether long notes rang out and chops were cut short, and what any of it scores.
 * It knows nothing about audio nodes or drawing.
 */
export class Session {
  readonly stats: Stats = emptyStats();
  private pending = new Map<number, Note>(); // strums waiting for their chord check, by onset time
  private levels: number[] = [];             // loudness of strums that hit a note
  private lastHitAt = -Infinity;
  private quietUntil = -Infinity;            // ignore stray sounds until then
  private readonly chopAt: number;
  private readonly firstNote: number;
  private readonly lastNote: number;

  constructor(private o: Options) {
    this.chopAt = Math.min(0.25, o.spb * 0.45);
    this.firstNote = o.notes.length ? o.notes[0].time : 0;
    const last = o.notes[o.notes.length - 1];
    this.lastNote = last ? last.endTime ?? last.time : 0;
  }

  get notes() { return this.o.notes; }

  /** Stray sounds right after `ctxTime` (e.g. when coming back from a pause) shouldn't count as strums. */
  settle(ctxTime: number, seconds = 0.3) {
    this.quietUntil = Math.max(this.quietUntil, ctxTime + seconds);
  }

  strum(s: StrumInput) {
    const { notes, emit, spb } = this.o;
    const t = s.time - this.o.startTime - (s.source === 'mic' ? this.o.latency : 0);
    if (s.source === 'key') this.stats.keyStrums++;

    // strumming again cuts off a chord that was meant to ring
    for (const n of notes) {
      if (n.hold === 'holding' && s.time - (n.onsetCtx ?? 0) > 0.12) this.breakHold(n, 'strummed again', t);
    }

    const check = this.o.checkChords && s.source === 'mic';
    const hit = judgeStrum(notes, t, this.stats, check);
    if (!hit) {
      if (this.isRealExtra(s, t)) { extraStrum(this.stats); emit({ type: 'extra' }); }
      return;
    }
    hit.onsetCtx = s.time;
    hit.source = s.source;
    this.lastHitAt = s.time;
    if (s.source === 'mic') this.levels.push(s.level);
    if (hit.chop) { this.stats.chops++; this.quietUntil = Math.max(this.quietUntil, s.time + this.chopAt + 0.08); }
    if (hit.stroke === 'mute') this.quietUntil = Math.max(this.quietUntil, s.time + Math.min(0.2, spb * 0.4));
    if (check) this.pending.set(s.time, hit);
    emit({ type: 'hit', note: hit, grade: hit.result as 'perfect' | 'good', offset: hit.offset ?? 0 });
  }

  /**
   * A strum with no note near it normally counts against the player, except for
   * sounds that are probably not a deliberate strum.
   */
  private isRealExtra(s: StrumInput, t: number): boolean {
    if (t < this.firstNote - GOOD_WINDOW || t > this.lastNote + GOOD_WINDOW) return false; // before or after the song
    if (s.time - this.lastHitAt < 0.15) return false; // one slow strum heard twice
    if (s.time < this.quietUntil) return false;       // the muting hand after a chop or chuck
    if (s.source === 'key') return true;
    if (!this.levels.length) return false;            // nothing to compare its loudness with yet
    return s.level >= 0.35 * median(this.levels);     // far quieter than the real strums: a thump or squeak
  }

  /**
   * The chord analysis for the strum at `onsetTime` has arrived. `result` is what the
   * strum added to the sound, `plain` everything that is sounding after it.
   */
  chord(onsetTime: number, result: ChordResult, plain: ChordResult = result) {
    const { emit, probe } = this.o;
    const note = this.pending.get(onsetTime);
    this.pending.delete(onsetTime);
    const clear = result.clarity >= UNCLEAR;
    const heard = clear ? result.best.name : 'muted';
    if (!note) { emit({ type: 'heard', name: heard, ok: false }); return; }

    if (note.stroke === 'mute') {
      // a chuck should be a dead "chk": no clear chord, or the sound dies right away
      const ratio = probe.decayRatio(onsetTime, onsetTime + 0.15);
      const ok = !clear || (ratio !== null && ratio < MUTED_RATIO);
      emit({ type: 'heard', name: ok ? 'muted' : heard, ok });
      if (ok) confirmChord(note, this.stats);
      else { rejectChord(note, this.stats); emit({ type: 'notMuted', note }); }
      return;
    }
    // On a chord change only the newly added sound counts, because the old chord is
    // still ringing. When the same chord is strummed again it is already in the air,
    // so a match on the whole sound is accepted too (a soft upstroke adds very little).
    const ok = matchesChord(result, note.chord) || (!note.chordChange && matchesChord(plain, note.chord));
    emit({ type: 'heard', name: ok ? note.chord : heard, ok });
    if (ok) confirmChord(note, this.stats);
    else { rejectChord(note, this.stats); emit({ type: 'wrongChord', note, heard }); }
  }

  /** Call every frame. `songNow` is the song clock in seconds, `ctxNow` the audio clock. */
  update(songNow: number, ctxNow: number) {
    const { notes, spb, probe, emit } = this.o;

    // if a chord check never came back, give the player the benefit of the doubt
    for (const [onsetTime, n] of this.pending) {
      if (ctxNow - onsetTime > 0.6) { confirmChord(n, this.stats); this.pending.delete(onsetTime); }
    }
    if (sweepMisses(notes, songNow, this.stats).length) emit({ type: 'miss' });

    for (const n of notes) {
      if (n.time > songNow) break;
      if ((n.result !== 'perfect' && n.result !== 'good') || n.awaitingChord) continue;

      if (n.len && !n.hold) { n.hold = 'holding'; this.stats.holds++; }
      if (n.hold === 'holding') {
        if (songNow >= n.endTime!) this.finishHold(n);
        else if (n.source === 'key' ? !probe.keyHeld : probe.suddenDrop(n.onsetCtx!)) {
          this.breakHold(n, n.source === 'key' ? 'released too early' : 'chord was cut off', songNow);
        } else holdTick(n, songNow, spb, this.stats);
      }

      if (n.chop && !n.chopState && ctxNow > n.onsetCtx! + this.chopAt + 0.03) {
        let ok: boolean | null;
        if (n.source === 'key') ok = probe.keyReleasedAt > n.onsetCtx! && probe.keyReleasedAt - n.onsetCtx! <= this.chopAt + 0.02;
        else {
          const r = probe.decayRatio(n.onsetCtx!, n.onsetCtx! + this.chopAt);
          ok = r === null ? null : r < MUTED_RATIO;
        }
        if (ok === null) continue; // loudness readings not in yet
        n.chopState = ok ? 'ok' : 'rang';
        if (ok) { this.stats.chopsOk++; this.stats.score += 50 * multiplier(this.stats.combo); }
        emit({ type: 'chop', note: n, ok });
      }
    }
  }

  private finishHold(n: Note) {
    holdTick(n, n.endTime!, this.o.spb, this.stats);
    n.hold = 'done';
    this.stats.holdsDone++;
    this.o.emit({ type: 'rangOut', note: n, points: n.holdPoints ?? 0 });
  }

  private breakHold(n: Note, why: string, songNow: number) {
    // letting go in the last moment of the note is forgiven
    if (songNow > n.endTime! - this.o.spb * 0.35) { this.finishHold(n); return; }
    n.hold = 'broken';
    this.o.emit({ type: 'holdBroken', note: n, why });
  }
}
