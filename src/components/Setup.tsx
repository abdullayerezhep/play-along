import { useState } from 'react';
import type { AudioEngine } from '../audio/engine';
import { PATTERNS, PROGRESSIONS, type Pattern } from '../game/chart';
import type { AppSettings } from '../settings';
import { LevelMeter } from './LevelMeter';

type Props = {
  engine: AudioEngine;
  settings: AppSettings;
  onChange: (s: AppSettings) => void;
  onStart: () => void;
  onCalibrate: () => void;
};

/** One bar of a strum pattern as eight eighth-note slots. */
function PatternStrip({ pattern }: { pattern: Pattern }) {
  const cells: JSX.Element[] = [];
  for (let i = 0; i < 8; i++) {
    const h = pattern.hits.find((x) => Math.abs(x.b - i / 2) < 0.01);
    if (!h) { cells.push(<span key={i} className="slot" />); continue; }
    const span = h.len ? Math.round(h.len * 2) : 1;
    cells.push(
      <span key={i} className={`slot hit ${h.s}${h.chop ? ' chop' : ''}${h.len ? ' long' : ''}`} style={{ gridColumn: `span ${span}` }}>
        {h.s === 'mute' ? '×' : h.s === 'down' ? '▾' : '▴'}
      </span>,
    );
    i += span - 1;
  }
  return <span className="strip" aria-hidden>{cells}</span>;
}

export function Setup({ engine, settings, onChange, onStart, onCalibrate }: Props) {
  const [micReady, setMicReady] = useState(engine.micReady);
  const [micError, setMicError] = useState('');
  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => onChange({ ...settings, [k]: v });

  const enableMic = async () => {
    try {
      await engine.startMic();
      engine.setSensitivity(settings.sensitivity);
      setMicReady(true);
      setMicError('');
    } catch (e) {
      setMicError(`Microphone blocked${e instanceof Error ? ` (${e.message})` : ''}. Allow it in your browser's site settings, then try again.`);
    }
  };

  return (
    <div className="menu">
      <header className="masthead">
        <h1>Play Along</h1>
        <p>Strum your guitar in time with the notes. The mic listens for the beat and the chord.</p>
      </header>

      <section className="input-strip" aria-label="Microphone">
        {!micReady ? (
          <div className="mic-off">
            <button className="btn" onClick={enableMic}>Turn on microphone</button>
            <p>Set your phone or laptop near the guitar. Headphones keep the click out of the mic.</p>
            {micError && <p className="error">{micError}</p>}
          </div>
        ) : (
          <div className="mic-on">
            <LevelMeter engine={engine} />
            <div className="mic-controls">
              <label className="sens">
                <span>Sensitivity</span>
                <input type="range" min={0} max={1} step={0.01} value={settings.sensitivity}
                  onChange={(e) => { const v = Number(e.target.value); set('sensitivity', v); engine.setSensitivity(v); }} />
              </label>
              <div className="latency">
                <span>Delay {settings.latencyMs} ms</span>
                <button className="btn quiet small" onClick={onCalibrate}>Calibrate</button>
              </div>
            </div>
            <p className="hint">Strum once: the light should blink once and show your chord. If ringing strings make it blink again, lower the sensitivity.</p>
          </div>
        )}
      </section>

      <div className="pickers">
        <fieldset className="picker">
          <legend>Song</legend>
          {PROGRESSIONS.map((p) => (
            <label key={p.id} className={`row${settings.progressionId === p.id ? ' on' : ''}`}>
              <input type="radio" name="prog" checked={settings.progressionId === p.id} onChange={() => set('progressionId', p.id)} />
              <span className="row-name">{p.name.split('  ')[0]}</span>
              <span className="chips">
                {(p.chords.length > 4 ? [...new Set(p.chords)] : p.chords).map((c, i) => <span key={i} className="chip">{c}</span>)}
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="picker">
          <legend>Strum pattern</legend>
          {PATTERNS.map((p) => (
            <label key={p.id} className={`row${settings.patternId === p.id ? ' on' : ''}`}>
              <input type="radio" name="pattern" checked={settings.patternId === p.id} onChange={() => set('patternId', p.id)} />
              <span className="row-name">{p.name.split('  ')[0]}<small>{p.level}</small></span>
              <PatternStrip pattern={p} />
            </label>
          ))}
          <p className="key">
            <span><span className="k down">▾</span> down</span>
            <span><span className="k up">▴</span> up</span>
            <span><span className="k mute">×</span> muted chuck</span>
            <span><span className="k down long">▾</span> let it ring</span>
            <span><span className="k down chop">▾</span> chop: mute right after</span>
          </p>
        </fieldset>
      </div>

      <section className="transport">
        <label className="tempo">
          <span className="bpm">{settings.bpm}<small>bpm</small></span>
          <input type="range" min={50} max={160} step={1} value={settings.bpm} onChange={(e) => set('bpm', Number(e.target.value))} aria-label="Tempo" />
        </label>
        <div className="seg" role="radiogroup" aria-label="Song length">
          {[8, 16, 24, 32].map((b) => (
            <button key={b} role="radio" aria-checked={settings.bars === b} className={settings.bars === b ? 'on' : ''} onClick={() => set('bars', b)}>{b} bars</button>
          ))}
        </div>
        <div className="toggles">
          <label><input type="checkbox" checked={settings.metronome} onChange={(e) => set('metronome', e.target.checked)} /> Click</label>
          <label><input type="checkbox" checked={settings.bassLine} onChange={(e) => set('bassLine', e.target.checked)} /> Bass</label>
          <label><input type="checkbox" checked={settings.checkChords} onChange={(e) => set('checkChords', e.target.checked)} /> Check chords</label>
          <label><input type="checkbox" checked={settings.ringOut} onChange={(e) => set('ringOut', e.target.checked)} /> End on a held chord</label>
        </div>
        <button className="btn go" onClick={onStart}>Start playing</button>
      </section>
      <p className="footnote">No guitar nearby? Space strums: hold it for long notes, tap it for chops. Esc stops a song.</p>
    </div>
  );
}
