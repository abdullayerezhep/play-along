import { useEffect, useMemo, useRef, useState } from 'react';
import type { AudioEngine } from '../audio/engine';
import { BEATS_PER_BAR, buildChart, rootFreq, songMap } from '../game/chart';
import { COLORS, Highway } from '../game/highway';
import { multiplier, type Stats } from '../game/judge';
import { Session, type GameEvent } from '../game/session';
import type { AppSettings } from '../settings';
import { ChordDiagram } from './ChordDiagram';

type Props = {
  engine: AudioEngine;
  settings: AppSettings;
  onFinish: (s: Stats) => void;
  onRestart: () => void;
  onQuit: () => void;
};

type Hud = { score: number; combo: number; progress: number; chord: string; next: string | null; soon: boolean };

/**
 * One play-through. This component only wires things together: it schedules the
 * click and bass, feeds strums and chord results into the rules (Session), draws
 * with the Highway, and owns pause, the screen wake lock and the on-screen readouts.
 */
export function Game({ engine, settings, onFinish, onRestart, onQuit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const song = useMemo(() => songMap(settings), [settings]);
  const notes = useMemo(() => buildChart(settings), [settings]);
  const [hud, setHud] = useState<Hud>({ score: 0, combo: 0, progress: 0, chord: song.chordAt(0), next: song.upcoming(0)?.chord ?? null, soon: false });
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
    let done = false;
    let paused: null | 'menu' | 'counting' = null;

    // --- sound: count-in, click, bass ----------------------------------
    engine.beginSession();
    const start = ctx.currentTime + 0.6 + BEATS_PER_BAR * spb; // audio-clock time of the first beat
    const bassOn = settings.bassLine && settings.output === 'headphones'; // through speakers the mic would hear it as guitar
    for (let b = -BEATS_PER_BAR; b < totalBeats; b++) {
      const t = start + b * spb;
      if (settings.metronome || b < 0) engine.click(t, b % BEATS_PER_BAR === 0);
      if (!bassOn || b < 0) continue;
      const chord = chordAt(b);
      if (b >= playBeats) { if (b === playBeats) engine.bass(t, rootFreq(chord), spb * 3.5); continue; }
      const changed = b === 0 || chordAt(b - 1) !== chord;
      if (b % 2 === 0 || changed) engine.bass(t, rootFreq(chord), spb * (b % 2 === 0 && chordAt(b + 1) === chord ? 1.8 : 0.9));
    }
    const end = totalBeats * spb + 0.8;

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
          const good = e.grade === 'good';
          highway.pop(good ? 'Good' : 'Perfect', good ? COLORS.good : COLORS.perfect, good ? (e.offset < 0 ? 'a little early' : 'a little late') : undefined);
          break;
        }
        case 'extra': highway.pop('Extra strum', COLORS.miss, 'no note there'); break;
        case 'miss': highway.pop('Miss', COLORS.miss); break;
        case 'heard': setHeard({ name: e.name, ok: e.ok }); break;
        case 'wrongChord': highway.pop('Wrong chord', COLORS.miss, `heard ${e.heard}, needed ${e.note.chord}`); break;
        case 'notMuted': highway.pop('Mute it', COLORS.miss, 'a chuck is dead strings, no chord'); break;
        case 'rangOut': highway.strum(COLORS.down, 0.6); highway.pop('Rang out', COLORS.hold, `+${e.points}`); break;
        case 'holdBroken': highway.pop('Let it ring', COLORS.miss, e.why); break;
        case 'chop': if (e.ok) highway.pop('Chop', COLORS.perfect); else highway.pop('Cut it shorter', COLORS.good, 'mute right after the strum'); break;
      }
    };
    const session = new Session({
      notes, spb, startTime: start, latency: settings.latencyMs / 1000, checkChords: settings.checkChords, emit: show,
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
    const offChord = engine.onChord((c) => { if (!done) session.chord(c.onsetTime, c.result, c.plain); });

    // --- pause ----------------------------------------------------------
    // Suspending the audio clock freezes the click, the bass and the song position together.
    let countdown = 0;
    const pauseGame = () => {
      if (done || paused) return;
      paused = 'menu';
      void ctx.suspend();
      setPause('menu');
    };
    const resumeGame = () => {
      if (paused !== 'menu') return;
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
    let raf = 0, lastHud = '';
    const frame = () => {
      const now = engine.now - start;
      if (!paused) session.update(now, ctx.currentTime);
      highway.draw(now, notes, !!paused);

      const beat = Math.max(0, now / spb);
      const next = song.upcoming(beat);
      const h: Hud = {
        score: session.stats.score, combo: session.stats.combo,
        progress: Math.max(0, Math.min(1, now / (totalBeats * spb))),
        chord: chordAt(beat), next: next?.chord ?? null, soon: !!next && next.beat - beat <= 2,
      };
      const key = `${h.score}|${h.combo}|${Math.round(h.progress * 200)}|${h.chord}|${h.next}|${h.soon}`;
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
  }, [engine, notes, song, settings]);

  const mult = multiplier(hud.combo);

  return (
    <div className="game">
      <canvas ref={canvasRef} className="highway" />
      <div className="hud-score">
        <div className="score-num">{hud.score.toLocaleString()}</div>
        <div className="combo">
          {hud.combo > 1 ? <>{hud.combo} in a row</> : <span className="dim">Build a streak</span>}
          {mult > 1 && <span className="mult">×{mult}</span>}
        </div>
      </div>
      <div className="hud-chord">
        <div className="chord-card">
          <div className="chord-name">{hud.chord}</div>
          <ChordDiagram chord={hud.chord} size={96} />
        </div>
        {hud.next && (
          <div className={`chord-card next${hud.soon ? ' soon' : ''}`}>
            <div className="chord-name"><small>next</small>{hud.next}</div>
            <ChordDiagram chord={hud.next} size={72} />
          </div>
        )}
        {settings.checkChords && heard && (
          <div className={`chord-heard ${heard.ok ? 'ok' : 'bad'}`}>You played {heard.name}</div>
        )}
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
