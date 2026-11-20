import { useState } from 'react';
import type { AudioEngine } from '../audio/engine';
import { PATTERNS, PROGRESSIONS } from '../game/chart';
import type { AppSettings } from '../settings';
import { LevelMeter } from './LevelMeter';

type Props = {
  engine: AudioEngine;
  settings: AppSettings;
  onChange: (s: AppSettings) => void;
  onStart: () => void;
  onCalibrate: () => void;
};

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
      setMicError(e instanceof Error ? e.message : 'Microphone access was refused.');
    }
  };

  return (
    <div className="setup">
      <header className="title">
        <h1>PLAY<span>ALONG</span></h1>
        <p className="muted">Strum your real guitar on the beat. Hit the notes, build the combo.</p>
      </header>

      <section className="panel">
        <h2>1 · Plug in your ears</h2>
        {!micReady ? (
          <>
            <p className="muted small">Put your phone or laptop near the guitar (or use an audio interface). Headphones help so the click doesn't trigger the mic.</p>
            <button className="btn" onClick={enableMic}>Enable microphone</button>
            {micError && <p className="error small">{micError}</p>}
          </>
        ) : (
          <>
            <LevelMeter engine={engine} />
            <label className="field">
              <span>Sensitivity <em>{Math.round(settings.sensitivity * 100)}</em></span>
              <input type="range" min={0} max={1} step={0.01} value={settings.sensitivity}
                onChange={(e) => { const v = Number(e.target.value); set('sensitivity', v); engine.setSensitivity(v); }} />
            </label>
            <p className="muted small">Strum a few times: each strum should light up STRUM once. Lower it if it fires on ringing strings, raise it if it misses soft strums.</p>
            <div className="latency">
              <span>Latency offset: <strong>{settings.latencyMs} ms</strong></span>
              <button className="btn ghost" onClick={onCalibrate}>Calibrate</button>
            </div>
          </>
        )}
      </section>

      <section className="panel">
        <h2>2 · Pick a song</h2>
        <label className="field">
          <span>Chords</span>
          <select value={settings.progressionId} onChange={(e) => set('progressionId', e.target.value)}>
            {PROGRESSIONS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Strum pattern</span>
          <select value={settings.patternId} onChange={(e) => set('patternId', e.target.value)}>
            {PATTERNS.map((p) => <option key={p.id} value={p.id}>{p.level}: {p.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Tempo <em>{settings.bpm} BPM</em></span>
          <input type="range" min={50} max={160} step={1} value={settings.bpm} onChange={(e) => set('bpm', Number(e.target.value))} />
        </label>
        <label className="field">
          <span>Length</span>
          <select value={settings.bars} onChange={(e) => set('bars', Number(e.target.value))}>
            {[8, 16, 24, 32].map((b) => <option key={b} value={b}>{b} bars</option>)}
          </select>
        </label>
        <div className="toggles">
          <label><input type="checkbox" checked={settings.metronome} onChange={(e) => set('metronome', e.target.checked)} /> Metronome</label>
          <label><input type="checkbox" checked={settings.bassLine} onChange={(e) => set('bassLine', e.target.checked)} /> Bass line</label>
        </div>
      </section>

      <button className="btn big" onClick={onStart}>▶ START</button>
      <p className="muted small center">No guitar handy? Press <kbd>Space</kbd> to strum. <kbd>Esc</kbd> quits a song.</p>
    </div>
  );
}
