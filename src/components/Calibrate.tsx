import { useEffect, useRef, useState } from 'react';
import type { AudioEngine } from '../audio/engine';
import { median } from '../game/judge';

const BPM = 90;
const COUNT_IN = 4;
const CLICKS = 12;

type Props = {
  engine: AudioEngine;
  /** Shown automatically before the first song, so it offers to skip rather than go back. */
  firstRun?: boolean;
  onDone: (latencyMs: number | null) => void;
};

/**
 * Plays a steady click; the player strums along. The median gap between the
 * clicks and the detected strums is the round-trip latency of this setup.
 */
export function Calibrate({ engine, firstRun, onDone }: Props) {
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
    <div className="calibrate">
      <section>
        <h2>{firstRun ? 'First, measure the delay' : 'Measure the delay'}</h2>
        <p className="lede">Sound takes a moment to get through your speakers and mic. Without this, every strum looks late. After 4 count-in ticks, strum once on each of the next {CLICKS}. Keep strums short and mute between them.</p>
        <div className={`calib-dot ${phase === 'running' && beat >= 0 ? 'pulse' : ''}`} key={beat}>
          {phase === 'running' ? (counting ? (beat >= 0 ? `${COUNT_IN - beat}` : '') : 'Strum') : '♪'}
        </div>
        {phase === 'running' && <p className="dim">{hits} strums heard</p>}
        {phase === 'done' && (
          result === null
            ? <p className="error">Fewer than 6 strums lined up with the ticks. Raise the sensitivity a little and try again.</p>
            : <p className="lede">Measured delay: <strong>{result} ms</strong></p>
        )}
        <div className="actions">
          {phase !== 'running' && <button className="btn" onClick={start}>{phase === 'done' ? 'Measure again' : 'Start'}</button>}
          {phase === 'done' && result !== null && <button className="btn" onClick={() => onDone(result)}>Use {result} ms</button>}
          {phase !== 'running' && <button className="btn quiet" onClick={() => onDone(null)}>{firstRun ? 'Skip for now' : 'Back'}</button>}
        </div>
      </section>
    </div>
  );
}
