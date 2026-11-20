import { useState } from 'react';
import type { AudioEngine } from '../audio/engine';
import { CUSTOM_ID, PATTERNS, PROGRESSIONS, getProgression, lengthOptions, parseSong, songLength, type Pattern } from '../game/chart';
import { isCalibrated, type AppSettings } from '../settings';
import { LevelMeter } from './LevelMeter';

type Props = {
  engine: AudioEngine;
  settings: AppSettings;
  onChange: (s: AppSettings) => void;
  onStart: () => void;
  onCalibrate: () => void;
  onTune: () => void;
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

const uniqueChords = (bars: string[][]) => [...new Set(bars.flat())];

export function Setup({ engine, settings, onChange, onStart, onCalibrate, onTune }: Props) {
  const [micReady, setMicReady] = useState(engine.micReady);
  const [micError, setMicError] = useState('');
  const [askMic, setAskMic] = useState(false);
  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => onChange({ ...settings, [k]: v });

  const enableMic = async (): Promise<boolean> => {
    try {
      await engine.startMic();
      engine.setSensitivity(settings.sensitivity);
      setMicReady(true);
      setMicError('');
      return true;
    } catch (e) {
      setMicError(`Microphone blocked${e instanceof Error ? ` (${e.message})` : ''}. Allow it in your browser's site settings, then try again.`);
      return false;
    }
  };

  const custom = settings.progressionId === CUSTOM_ID;
  const parsed = parseSong(settings.customChords);
  const songError = custom && 'error' in parsed ? parsed.error : '';
  const prog = getProgression(settings);
  const lengths = lengthOptions(prog);
  const length = songLength(prog, settings.bars, false).playBars;
  const speakers = settings.output === 'speakers';

  const start = () => {
    if (songError) return;
    if (!micReady) { setAskMic(true); return; }
    onStart();
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
            <p>Set your phone or laptop near the guitar. The sound stays on this device.</p>
            {micError && <p className="error">{micError}</p>}
          </div>
        ) : (
          <div className="mic-on">
            <LevelMeter engine={engine} />
            <label className="sens">
              <span>Sensitivity</span>
              <input type="range" min={0} max={1} step={0.01} value={settings.sensitivity}
                onChange={(e) => { const v = Number(e.target.value); set('sensitivity', v); engine.setSensitivity(v); }} />
            </label>
            <p className="hint">Strum once: the light should blink once and show your chord. Raise the sensitivity if soft upstrokes are missed, lower it if ringing strings blink the light again.</p>
            <div className="mic-tools">
              <span>{isCalibrated(settings) ? `Delay ${settings.latencyMs} ms` : 'Delay not measured yet'}</span>
              <button className="btn quiet small" onClick={onCalibrate}>Measure delay</button>
              <button className="btn quiet small" onClick={onTune}>Tune guitar</button>
            </div>
          </div>
        )}
      </section>

      <div className="pickers">
        <fieldset className="picker">
          <legend>Song</legend>
          {PROGRESSIONS.map((p) => (
            <label key={p.id} className={`row${settings.progressionId === p.id ? ' on' : ''}`}>
              <input type="radio" name="prog" checked={settings.progressionId === p.id} onChange={() => set('progressionId', p.id)} />
              <span className="row-name">{p.name}</span>
              <span className="chips">
                {(p.bars.length > 4 ? uniqueChords(p.bars) : p.bars.flat()).map((c, i) => <span key={i} className="chip">{c}</span>)}
              </span>
            </label>
          ))}
          <label className={`row own${custom ? ' on' : ''}`}>
            <input type="radio" name="prog" checked={custom} onChange={() => set('progressionId', CUSTOM_ID)} />
            <span className="row-name">Your own</span>
            <input type="text" className="song-input" value={settings.customChords} placeholder="G D Em C" spellCheck={false}
              aria-label="Chords of your own song" aria-invalid={!!songError}
              onFocus={() => { if (!custom) set('progressionId', CUSTOM_ID); }}
              onChange={(e) => onChange({ ...settings, progressionId: CUSTOM_ID, customChords: e.target.value })} />
          </label>
          {custom && (songError
            ? <p className="error note">{songError}</p>
            : <p className="note">One chord per bar. To put two chords in a bar, draw the bar lines: <code>| G | D | Em C |</code></p>)}
        </fieldset>

        <fieldset className="picker">
          <legend>Strum pattern</legend>
          {PATTERNS.map((p) => (
            <label key={p.id} className={`row${settings.patternId === p.id ? ' on' : ''}`}>
              <input type="radio" name="pattern" checked={settings.patternId === p.id} onChange={() => set('patternId', p.id)} />
              <span className="row-name">{p.name}<small>{p.level}</small></span>
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
          <p className="note">The arrows suggest which way to strum. The game checks your timing and your chord; it can't hear the direction.</p>
        </fieldset>
      </div>

      {askMic && !micReady && (
        <section className="ask-mic" role="alert">
          <p>The microphone is off, so the game can't hear your guitar.</p>
          <button className="btn" onClick={async () => { if (await enableMic()) onStart(); }}>Turn it on and start</button>
          <button className="btn quiet" onClick={onStart}>Play with the Space bar</button>
        </section>
      )}

      <section className="options" aria-label="Sound and rules">
        <div className="seg" role="radiogroup" aria-label="Where you hear the game">
          <button role="radio" aria-checked={speakers} className={speakers ? 'on' : ''} onClick={() => set('output', 'speakers')}>Speakers</button>
          <button role="radio" aria-checked={!speakers} className={!speakers ? 'on' : ''} onClick={() => set('output', 'headphones')}>Headphones</button>
        </div>
        <label><input type="checkbox" checked={settings.metronome} onChange={(e) => set('metronome', e.target.checked)} /> Click</label>
        <label className={speakers ? 'off' : ''} title={speakers ? 'Through speakers the mic would hear the bass as your guitar' : undefined}>
          <input type="checkbox" disabled={speakers} checked={!speakers && settings.bassLine} onChange={(e) => set('bassLine', e.target.checked)} /> Bass line{speakers ? ' (needs headphones)' : ''}
        </label>
        <label><input type="checkbox" checked={settings.checkChords} onChange={(e) => set('checkChords', e.target.checked)} /> Check chords</label>
        <label><input type="checkbox" checked={settings.ringOut} onChange={(e) => set('ringOut', e.target.checked)} /> End on a held chord</label>
      </section>

      <section className="transport">
        <label className="tempo">
          <span className="bpm">{settings.bpm}<small>bpm</small></span>
          <input type="range" min={50} max={160} step={1} value={settings.bpm} onChange={(e) => set('bpm', Number(e.target.value))} aria-label="Tempo" />
        </label>
        <div className="seg" role="radiogroup" aria-label="Song length">
          {lengths.map((b) => (
            <button key={b} role="radio" aria-checked={length === b} className={length === b ? 'on' : ''} onClick={() => set('bars', b)}>{b} bars</button>
          ))}
        </div>
        <button className="btn go" onClick={start} disabled={!!songError}>Start playing</button>
      </section>
      <p className="footnote">No guitar nearby? Space strums: hold it for long notes, tap it for chops. Esc pauses a song.</p>
    </div>
  );
}
