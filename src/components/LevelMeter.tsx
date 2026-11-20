import { useEffect, useRef, useState } from 'react';
import type { AudioEngine } from '../audio/engine';

/** Live mic level bar that flashes whenever a strum is detected. */
export function LevelMeter({ engine }: { engine: AudioEngine }) {
  const bar = useRef<HTMLDivElement>(null);
  const [strums, setStrums] = useState(0);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const db = 20 * Math.log10(engine.level + 1e-6);
      const pct = Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
      if (bar.current) bar.current.style.width = `${pct}%`;
      raf = requestAnimationFrame(loop);
    };
    loop();
    let t: number | undefined;
    const off = engine.onOnset(() => {
      setStrums((n) => n + 1);
      setFlash(true);
      clearTimeout(t);
      t = window.setTimeout(() => setFlash(false), 120);
    });
    return () => { cancelAnimationFrame(raf); off(); clearTimeout(t); };
  }, [engine]);

  return (
    <div className="meter-row">
      <div className="meter"><div ref={bar} className="meter-fill" /></div>
      <div className={`strum-lamp ${flash ? 'on' : ''}`}>STRUM</div>
      <span className="muted small">{strums} detected</span>
    </div>
  );
}
