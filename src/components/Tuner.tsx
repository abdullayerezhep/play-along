import { useEffect, useState } from 'react';
import type { AudioEngine } from '../audio/engine';
import { GUITAR_STRINGS, detectPitch, nearestString } from '../audio/pitch';
import { median } from '../game/judge';

type Reading = { index: number; cents: number };

/** Pluck one string at a time; shows which string it is and how far off it is. */
export function Tuner({ engine, onDone }: { engine: AudioEngine; onDone: () => void }) {
  const [reading, setReading] = useState<Reading | null>(null);

  useEffect(() => {
    const buf = new Float32Array(4096);
    let recent: number[] = [];
    let raf = 0, last = 0, quiet = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last < 80) return;
      last = t;
      if (!engine.readWaveform(buf)) return;
      const f = detectPitch(buf, engine.ctx.sampleRate);
      if (f === null) { if (++quiet > 15) { recent = []; setReading(null); } return; }
      quiet = 0;
      // a different string was plucked: forget the old readings
      if (recent.length && Math.abs(1200 * Math.log2(f / median(recent))) > 100) recent = [];
      recent.push(f);
      if (recent.length > 5) recent.shift();
      setReading(nearestString(median(recent)));
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  const inTune = reading !== null && Math.abs(reading.cents) <= 5;
  const cents = reading ? Math.max(-50, Math.min(50, reading.cents)) : 0;
  const advice = !reading ? 'Pluck one string and let it ring.'
    : inTune ? 'In tune.'
    : reading.cents < 0 ? 'Too low. Tighten the string a little.' : 'Too high. Loosen the string a little.';

  return (
    <div className="menu tuner">
      <section>
        <h2>Tune your guitar</h2>
        <p className="lede">The game checks your chords by pitch, so a guitar that is out of tune gets marked wrong.</p>
        <div className="strings" aria-hidden>
          {GUITAR_STRINGS.map((s, i) => <span key={i} className={reading?.index === i ? (inTune ? 'on ok' : 'on') : ''}>{s.name}</span>)}
        </div>
        <div className={`tuner-note${inTune ? ' ok' : ''}`}>{reading ? GUITAR_STRINGS[reading.index].name : '–'}</div>
        <p className="dim">{reading ? GUITAR_STRINGS[reading.index].label : 'Standard tuning: E A D G B E'}</p>
        <div className="tuner-scale" role="meter" aria-valuemin={-50} aria-valuemax={50} aria-valuenow={Math.round(cents)} aria-label="Cents away from in tune">
          <span className="tuner-zone" />
          {reading && <span className={`tuner-needle${inTune ? ' ok' : ''}`} style={{ left: `${50 + cents}%` }} />}
        </div>
        <p className="advice" aria-live="polite">{advice}</p>
        <div className="actions"><button className="btn" onClick={onDone}>Done</button></div>
      </section>
    </div>
  );
}
