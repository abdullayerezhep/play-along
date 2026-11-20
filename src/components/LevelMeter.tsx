import { useEffect, useRef, useState } from 'react';
import type { AudioEngine } from '../audio/engine';

/** Live mic level, a light that blinks on every detected strum, and the last chord heard. */
export function LevelMeter({ engine }: { engine: AudioEngine }) {
  const bar = useRef<HTMLDivElement>(null);
  const [flash, setFlash] = useState(false);
  const [chord, setChord] = useState('');

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const db = 20 * Math.log10(engine.level + 1e-6);
      const pct = Math.max(0, Math.min(1, (db + 60) / 60));
      if (bar.current) bar.current.style.transform = `scaleX(${pct})`;
      raf = requestAnimationFrame(loop);
    };
    loop();
    let t: number | undefined;
    const off = engine.onOnset(() => {
      setFlash(true);
      clearTimeout(t);
      t = window.setTimeout(() => setFlash(false), 140);
    });
    const offChord = engine.onChord(({ result }) => setChord(result.clarity < 0.55 ? 'muted' : result.best.name));
    return () => { cancelAnimationFrame(raf); off(); offChord(); clearTimeout(t); };
  }, [engine]);

  return (
    <div className="meter-row">
      <span className={`lamp${flash ? ' on' : ''}`} role="status" aria-label={flash ? 'Strum detected' : 'Listening'} />
      <div className="meter"><div ref={bar} className="meter-fill" /></div>
      <div className="heard" aria-live="polite">{chord || '—'}</div>
    </div>
  );
}
