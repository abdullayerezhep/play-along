import { useState } from 'react';
import type { AudioEngine } from '../audio/engine';
import type { Best } from '../best';
import { CUSTOM_ID, PATTERNS, getProgression, lengthOptions, parseSong, songLength } from '../game/chart';
import { isCalibrated, type AppSettings } from '../settings';
import { LevelMeter } from './LevelMeter';
import { SongPicker } from './SongPicker';
import { slotsFromHits } from '../game/slots';
import { StrumStrip } from './StrumStrip';

type Props = {
  engine: AudioEngine;
  settings: AppSettings;
  best: Best;
  onChange: (s: AppSettings) => void;
  onStart: () => void;
  onCalibrate: () => void;
  onTune: () => void;
  onGuide: () => void;
};

export function Setup({ engine, settings, best, onChange, onStart, onCalibrate, onTune, onGuide }: Props) {
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
  const learn = settings.mode === 'learn';

  const start = () => {
    if (songError) return;
    if (!micReady) { setAskMic(true); return; }
    onStart();
  };

  return (
    <div className="menu">
      <header className="masthead">
        <h1>Play Along</h1>
        <p>Strum your guitar along with the notes. The mic listens for your strums and your chords.</p>
        <button className="btn quiet guide-link" onClick={onGuide}>New to guitar? Chords and strumming, explained</button>
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
        <SongPicker settings={settings} best={best} onChange={onChange} />

        <fieldset className="picker">
          <legend>Strum pattern</legend>
          {PATTERNS.map((p) => (
            <label key={p.id} className={`row${settings.patternId === p.id ? ' on' : ''}`}>
              <input type="radio" name="pattern" checked={settings.patternId === p.id} onChange={() => set('patternId', p.id)} />
              <span className="row-name pattern">{p.name}<small>{p.level}: {p.say.toLowerCase()}</small></span>
              <StrumStrip slots={slotsFromHits(p.hits)} />
            </label>
          ))}
          <p className="key">
            <span><span className="k down">▼</span> down</span>
            <span><span className="k up">▲</span> up</span>
            <span><span className="k mute">×</span> muted chuck</span>
            <span><span className="k down long">▼</span> let it ring</span>
            <span><span className="k down chop">▼</span> chop: mute right after</span>
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
        <div className="mode">
          <div className="seg" role="radiogroup" aria-label="How to play">
            <button role="radio" aria-checked={learn} className={learn ? 'on' : ''} onClick={() => set('mode', 'learn')}>Learn</button>
            <button role="radio" aria-checked={!learn} className={!learn ? 'on' : ''} onClick={() => set('mode', 'play')}>Play</button>
          </div>
          <span>{learn ? 'The song waits for each strum.' : 'You keep up with the beat.'}</span>
        </div>
        <button className="btn go" onClick={start} disabled={!!songError}>{learn ? 'Start learning' : 'Start playing'}</button>
      </section>
      <p className="footnote">No guitar nearby? Space strums: hold it for long notes, tap it for chops. Esc pauses a song.</p>
    </div>
  );
}
