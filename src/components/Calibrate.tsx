import { useEffect, useRef, useState } from 'react';
import type { AudioEngine } from '../audio/engine';
import { median } from '../game/judge';

const BPM = 90;
const COUNT_IN = 4;
const CLICKS = 12;

type Props = { engine: AudioEngine; onDone: (latencyMs: number | null) => void };

/**
 * Plays a steady click; the player strums along. The median gap between the
 * clicks and the detected strums is the round-trip latency of this setup.
 */
export function Calibrate({ engine, onDone }: Props) {
  const [phase, setPhase] = useState<'ready' | 'running' | 'done'>('ready');
  const [beat, setBeat] = useState(-1);
  const [result, setResult] = useState<number | null>(null);
  const [hits, setHits] = useState(0);
  const onsets = useRef<number[]>([]);
  const cleanup = useRef<() => void>(() => {});

  useEffect(() => () => { cleanup.current(); engine.stopSession(); }, [engine]);

  const start = async () => {
    await engine.ctx.resume();
    onsets.current = [];
    setHits(0);
    setResult(null);
    setPhase('running');
    engine.beginSession();
    const spb = 60 / BPM;
    const t0 = engine.ctx.currentTime + 0.4;
    const clicks: number[] = [];
    for (let i = 0; i < COUNT_IN + CLICKS; i++) {
      const t = t0 + i * spb;
      engine.click(t, i % 4 === 0);
      if (i >= COUNT_IN) clicks.push(t);
    }
    const off = engine.onOnset((o) => {
      if (o.source !== 'mic') return;
      onsets.current.push(o.time);
      setHits((n) => n + 1);
    });
    const end = t0 + (COUNT_IN + CLICKS) * spb + 0.4;
    let raf = 0;
    cleanup.current = () => { cancelAnimationFrame(raf); off(); };
    const loop = () => {
      const now = engine.now;
      setBeat(Math.floor((now - t0) / spb));
      if (engine.ctx.currentTime < end) { raf = requestAnimationFrame(loop); return; }
      off();
      const diffs: number[] = [];
      for (const c of clicks) {
        let best = Infinity;
        for (const o of onsets.current) if (Math.abs(o - c) < Math.abs(best)) best = o - c;
        if (Math.abs(best) < 0.3) diffs.push(best);
      }
      setResult(diffs.length >= 6 ? Math.round(median(diffs) * 1000) : null);
      setPhase('done');
    };
    raf = requestAnimationFrame(loop);
  };

  const counting = phase === 'running' && beat < COUNT_IN;
  return (
    <div className="setup">
      <section className="panel center">
        <h2>Latency calibration</h2>
        <p className="muted small">You'll hear 4 count-in clicks, then {CLICKS} more. Strum once on each of the {CLICKS} clicks — short, crisp strums, mute the strings between.</p>
        <div className={`calib-dot ${phase === 'running' && beat >= 0 ? 'pulse' : ''}`} key={beat}>
          {phase === 'running' ? (counting ? (beat >= 0 ? `${COUNT_IN - beat}` : '') : 'STRUM') : '♪'}
        </div>
        {phase === 'running' && <p className="muted small">{hits} strums heard</p>}
        {phase === 'done' && (
          result === null
            ? <p className="error">Not enough strums lined up with the clicks. Try again, maybe with a higher sensitivity.</p>
            : <p>Measured offset: <strong>{result} ms</strong></p>
        )}
        <div className="row">
          {phase !== 'running' && <button className="btn" onClick={start}>{phase === 'done' ? 'Again' : 'Start'}</button>}
          {phase === 'done' && result !== null && <button className="btn" onClick={() => onDone(result)}>Use {result} ms</button>}
          {phase !== 'running' && <button className="btn ghost" onClick={() => onDone(null)}>Back</button>}
        </div>
      </section>
    </div>
  );
}
