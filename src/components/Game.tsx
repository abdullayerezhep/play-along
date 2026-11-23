import { useEffect, useMemo, useRef, useState } from 'react';
import type { AudioEngine } from '../audio/engine';
import { BEATS_PER_BAR, PATTERNS, buildChart, rootFreq, songMap } from '../game/chart';
import { COLORS, Highway } from '../game/highway';
import { multiplier, type Stats } from '../game/judge';
import { Session, type GameEvent } from '../game/session';
import type { AppSettings } from '../settings';
import { ChordDiagram } from './ChordDiagram';
import { useChordHelp } from './chordHelp';
import { slotsFromNotes } from '../game/slots';
import { StrumStrip } from './StrumStrip';

type Props = {
  engine: AudioEngine;
  settings: AppSettings;
  onFinish: (s: Stats) => void;
  onRestart: () => void;
  onQuit: () => void;
};

type Hud = {
  score: number; combo: number; played: number; firstTry: number; progress: number;
  chord: string; next: string | null; soon: boolean;
  bar: number; cursor: number | undefined; waiting: boolean;
};

/**
 * One play-through. This component only wires things together: it runs the song
 * clock, makes the click and bass, feeds strums and chord results into the rules
 * (Session), draws with the Highway, and owns pause, the screen wake lock and the
 * on-screen readouts.
 *
 * Two ways to play:
 * - "play": the song runs on the audio clock at the chosen tempo, and you keep up.
 * - "learn": the song has its own clock, which stops at every note until you have
 *   played it, with the right chord. There is no way to fall behind.
 */
export function Game({ engine, settings, onFinish, onRestart, onQuit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const showHelp = useChordHelp();
  const learn = settings.mode === 'learn';
  const song = useMemo(() => songMap(settings), [settings]);
  const notes = useMemo(() => buildChart(settings), [settings]);
  const barSlots = useMemo(() => Array.from({ length: song.totalBars }, (_, b) => slotsFromNotes(notes, b)), [notes, song]);
  const pattern = PATTERNS.find((p) => p.id === settings.patternId);
  const [hud, setHud] = useState<Hud>({
    score: 0, combo: 0, played: 0, firstTry: 0, progress: 0,
    chord: song.chordAt(0), next: song.upcoming(0)?.chord ?? null, soon: false, bar: 0, cursor: undefined, waiting: false,
  });
  const [heard, setHeard] = useState<{ name: string; ok: boolean } | null>(null);
  /** null = playing, 'menu' = paused, a number = seconds until play resumes */
  const [pause, setPause] = useState<null | 'menu' | number>(null);
  const controls = useRef({ pause: () => {}, resume: () => {} });

  const finishRef = useRef(onFinish);
  useEffect(() => { finishRef.current = onFinish; });

  useEffect(() => {
    const ctx = engine.ctx;
    const spb = 60 / settings.bpm;
    const { totalBeats, playBeats, chordAt } = song;
    const bassOn = settings.bassLine && settings.output === 'headphones'; // through speakers the mic would hear it as guitar
    const end = totalBeats * spb + 0.8;
    let done = false;
    let paused: null | 'menu' | 'counting' = null;

    // --- the song clock, and the click and bass that go with it ---------
    engine.beginSession();
    const start = ctx.currentTime + 0.6 + BEATS_PER_BAR * spb; // play mode: audio-clock time of the first beat
    let songT = -BEATS_PER_BAR * spb;                           // learn mode: the song's own position
    let lastCtx = ctx.currentTime;
    let lastBeat = -BEATS_PER_BAR - 1;
    const songNow = () => (learn ? songT : engine.now - start);

    const soundBeat = (b: number, t: number) => {
      if (settings.metronome || b < 0) engine.click(t, ((b % BEATS_PER_BAR) + BEATS_PER_BAR) % BEATS_PER_BAR === 0);
      if (!bassOn || b < 0) return;
      const chord = chordAt(b);
      if (b >= playBeats) { if (b === playBeats) engine.bass(t, rootFreq(chord), spb * 3.5); return; }
      const changed = b === 0 || chordAt(b - 1) !== chord;
      if (b % 2 === 0 || changed) engine.bass(t, rootFreq(chord), spb * (b % 2 === 0 && chordAt(b + 1) === chord ? 1.8 : 0.9));
    };
    // play mode: everything is scheduled ahead on the audio clock
    if (!learn) for (let b = -BEATS_PER_BAR; b < totalBeats; b++) soundBeat(b, start + b * spb);

    /** Learn mode: move the song on, but never past a note that has not been played; tick as beats go by. */
    const advance = () => {
      const now = ctx.currentTime;
      songT += Math.min(0.1, now - lastCtx);
      lastCtx = now;
      const stop = session.waitingAt();
      if (stop !== null && songT > stop) songT = stop;
      const beat = Math.floor(songT / spb + 1e-6);
      if (beat > lastBeat) { lastBeat = beat; if (beat < totalBeats) soundBeat(beat, now + 0.02); }
    };
    const rewindTo = (t: number) => {
      songT = Math.min(songT, t);
      lastBeat = Math.floor(songT / spb + 1e-6);
    };

    // --- drawing --------------------------------------------------------
    const canvas = canvasRef.current!;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.25 : 1;
    const highway = new Highway(canvas, { spb, totalBeats, motion });
    const ro = new ResizeObserver(() => highway.resize());
    ro.observe(canvas);

    // --- rules ----------------------------------------------------------
    const show = (e: GameEvent) => {
      switch (e.type) {
        case 'hit': {
          highway.strum(COLORS[e.note.stroke], e.note.stroke === 'mute' ? 0.25 : 1);
          if (learn) break; // no timing to grade while the song waits for you
          const good = e.grade === 'good';
          highway.pop(good ? 'Good' : 'Perfect', good ? COLORS.good : COLORS.perfect, good ? (e.offset < 0 ? 'a little early' : 'a little late') : undefined);
          break;
        }
        case 'extra': highway.pop('Extra strum', COLORS.miss, 'no note there'); break;
        case 'miss': highway.pop('Miss', COLORS.miss); break;
        case 'heard': setHeard({ name: e.name, ok: e.ok }); break;
        case 'wrongChord':
          if (e.retry) { rewindTo(e.note.time); highway.pop(`Not ${e.note.chord} yet`, COLORS.miss, `that sounded like ${e.heard}`); }
          else highway.pop('Wrong chord', COLORS.miss, `heard ${e.heard}, needed ${e.note.chord}`);
          break;
        case 'notMuted':
          if (e.retry) rewindTo(e.note.time);
          highway.pop('Mute it', COLORS.miss, 'a chuck is dead strings, no chord');
          break;
        case 'rangOut': highway.strum(COLORS.down, 0.6); highway.pop('Rang out', COLORS.hold, `+${e.points}`); break;
        case 'holdBroken': highway.pop('Let it ring', COLORS.miss, e.why); break;
        case 'chop': if (e.ok) highway.pop('Chop', COLORS.perfect); else highway.pop('Cut it shorter', COLORS.good, 'mute right after the strum'); break;
      }
    };
    const session = new Session({
      notes, spb, startTime: start, latency: settings.latencyMs / 1000, checkChords: settings.checkChords, emit: show,
      wait: learn, clock: () => songT,
      probe: {
        suddenDrop: (onset) => engine.history.suddenDrop(onset),
        decayRatio: (onset, at) => engine.history.decayRatio(onset, at),
        get keyHeld() { return engine.keyHeld; },
        get keyReleasedAt() { return engine.keyReleasedAt; },
      },
    });
    const offStrum = engine.onOnset((o) => {
      if (done || paused) return;
      highway.strum(COLORS.mute, 0.35);
      session.strum(o);
    });
    const offChord = engine.onChord((c) => { if (!done && !paused) session.chord(c.onsetTime, c.result, c.plain); });

    // --- pause ----------------------------------------------------------
    // Play mode: suspending the audio clock freezes the click, the bass and the song together,
    // and a short countdown leads back in. Learn mode: the song's own clock simply stops.
    let countdown = 0;
    const pauseGame = () => {
      if (done || paused) return;
      paused = 'menu';
      if (!learn) void ctx.suspend();
      setPause('menu');
    };
    const resumeGame = () => {
      if (paused !== 'menu') return;
      if (learn) { lastCtx = ctx.currentTime; session.settle(ctx.currentTime); paused = null; setPause(null); return; }
      paused = 'counting';
      let left = 3;
      setPause(left);
      countdown = window.setInterval(() => {
        left--;
        if (left > 0) { setPause(left); return; }
        clearInterval(countdown);
        void ctx.resume().then(() => { session.settle(ctx.currentTime); paused = null; setPause(null); });
      }, 700);
    };
    controls.current = { pause: pauseGame, resume: resumeGame };
    const onHidden = () => { if (document.hidden) pauseGame(); else void keepAwake(); };
    document.addEventListener('visibilitychange', onHidden);

    // --- keep a phone's screen on while playing --------------------------
    let lock: WakeLockSentinel | null = null;
    const keepAwake = async () => {
      try { lock = (await navigator.wakeLock?.request('screen')) ?? null; } catch { /* not allowed or not supported */ }
    };
    void keepAwake();

    // --- keyboard -------------------------------------------------------
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') { if (paused === 'menu') resumeGame(); else pauseGame(); return; }
      if (e.code !== 'Space' || paused) return; // while paused, Space works the buttons as usual
      e.preventDefault();
      if (!e.repeat) engine.tap();
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') engine.release(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);

    // --- every frame ----------------------------------------------------
    let raf = 0, lastHud = '', waitingSince = 0;
    const frame = () => {
      if (learn && !paused) advance();
      const now = songNow();
      if (!paused) session.update(now, ctx.currentTime);

      // learn mode: after a moment of waiting, say what the song is waiting for
      const waitNote = paused ? null : session.waitingFor(now);
      if (!waitNote) waitingSince = 0;
      else if (!waitingSince) waitingSince = performance.now();
      const stuck = !!waitNote && performance.now() - waitingSince > 1200;
      highway.draw(now, notes, !!paused, stuck ? (waitNote!.stroke === 'mute' ? 'Strum muted strings' : `Strum ${waitNote!.chord}`) : undefined);

      const beat = Math.max(0, now / spb);
      const next = song.upcoming(beat);
      const s = session.stats;
      const h: Hud = {
        score: s.score, combo: s.combo, played: s.perfect + s.good, firstTry: s.firstTry,
        progress: Math.max(0, Math.min(1, now / (totalBeats * spb))),
        chord: chordAt(beat), next: next?.chord ?? null, soon: !!next && next.beat - beat <= 2,
        bar: Math.min(song.totalBars - 1, Math.floor(beat / BEATS_PER_BAR + 1e-6)),
        cursor: now < 0 ? undefined : Math.floor(((beat % BEATS_PER_BAR) + 1e-6) * 2),
        waiting: stuck,
      };
      const key = `${h.score}|${h.combo}|${h.played}|${h.firstTry}|${Math.round(h.progress * 200)}|${h.chord}|${h.next}|${h.soon}|${h.bar}|${h.cursor}|${h.waiting}`;
      if (key !== lastHud) { lastHud = key; setHud(h); }

      if (now > end && !done) { done = true; finishRef.current(session.stats); return; }
      if (!done) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      done = true;
      cancelAnimationFrame(raf);
      clearInterval(countdown);
      offStrum();
      offChord();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      void lock?.release();
      engine.stopSession();
      if (ctx.state === 'suspended') void ctx.resume(); // never leave the menu with frozen audio
    };
  }, [engine, notes, song, settings, learn]);

  /** Stop the song, explain the chord, and carry on when the card is closed. */
  const explain = (chord: string) => {
    controls.current.pause();
    showHelp(chord, () => controls.current.resume());
  };

  const mult = multiplier(hud.combo);

  return (
    <div className="game">
      {/* a tap on the neck is a strum too: the phone's answer to the Space bar */}
      <canvas ref={canvasRef} className="highway"
        onPointerDown={(e) => { if (e.pointerType !== 'mouse') engine.tap(); }}
        onPointerUp={() => engine.release()} onPointerCancel={() => engine.release()} />
      <div className="hud-score">
        {learn ? (
          <>
            <div className="score-num">{hud.played}<small> of {notes.length}</small></div>
            <div className="combo"><span className="dim">The song waits for you</span></div>
          </>
        ) : (
          <>
            <div className="score-num">{hud.score.toLocaleString()}</div>
            <div className="combo">
              {hud.combo > 1 ? <>{hud.combo} in a row</> : <span className="dim">Build a streak</span>}
              {mult > 1 && <span className="mult">×{mult}</span>}
            </div>
          </>
        )}
      </div>

      <div className="hud-strum">
        <StrumStrip slots={barSlots[hud.bar]} count cursor={hud.cursor} />
        {pattern && <div className="say">{pattern.say}</div>}
      </div>

      <div className="hud-chord">
        <button className={`chord-card${hud.waiting ? ' waiting' : ''}`} onClick={() => explain(hud.chord)} title="How to play this chord">
          <span className="chord-name">{hud.chord}</span>
          <ChordDiagram chord={hud.chord} size={learn ? 132 : 96} fingers={learn} />
        </button>
        {hud.next && (
          <button className={`chord-card next${hud.soon ? ' soon' : ''}`} onClick={() => explain(hud.next!)} title="How to play this chord">
            <span className="chord-name"><small>next</small>{hud.next}</span>
            <ChordDiagram chord={hud.next} size={72} />
          </button>
        )}
        {settings.checkChords && heard && (
          <div className={`chord-heard ${heard.ok ? 'ok' : 'bad'}`}>You played {heard.name}</div>
        )}
        <div className="chord-hint">Click a chord to see how to play it</div>
      </div>

      <div className="hud-bottom">
        <div className="progress"><div style={{ width: `${hud.progress * 100}%` }} /></div>
        <button className="btn quiet small" onClick={() => controls.current.pause()}>Pause</button>
      </div>
      {pause !== null && (
        <div className="pause" role="dialog" aria-label="Paused">
          {pause === 'menu' ? (
            <>
              <h2>Paused</h2>
              <div className="actions">
                <button className="btn go" autoFocus onClick={() => controls.current.resume()}>Keep playing</button>
                <button className="btn quiet" onClick={onRestart}>Start over</button>
                <button className="btn quiet" onClick={onQuit}>Change song</button>
              </div>
            </>
          ) : <div className="pause-count" aria-live="assertive">{pause}</div>}
        </div>
      )}
    </div>
  );
}
