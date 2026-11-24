import type { AudioEngine } from '../audio/engine';
import { isCalibrated, type AppSettings } from '../settings';
import type { Shop } from '../useStore';
import { LevelMeter } from './LevelMeter';

type Props = {
  engine: AudioEngine;
  settings: AppSettings;
  micOn: boolean;
  micError: string;
  onMic: () => void;
  onChange: (s: AppSettings) => void;
  onCalibrate: () => void;
  shop: Shop;
  onUnlock: () => void;
};

/** Things you set once: the microphone, where the sound comes from, and the rules. */
export function SettingsScreen({ engine, settings, micOn, micError, onMic, onChange, onCalibrate, shop, onUnlock }: Props) {
  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => onChange({ ...settings, [k]: v });
  const speakers = settings.output === 'speakers';

  return (
    <div className="settings">
      <header className="page-head"><h1>Settings</h1></header>

      <section>
        <h2>Microphone</h2>
        {!micOn ? (
          <>
            <p className="hint">The game listens to your guitar through the microphone. The sound stays on this device.</p>
            <button className="btn" onClick={onMic}>Turn on microphone</button>
            {micError && <p className="hint error">{micError}</p>}
          </>
        ) : (
          <>
            <LevelMeter engine={engine} />
            <p className="hint">Strum once: the light should blink once, and the chord you played appears on the right.</p>
            <label className="field">
              <span>Sensitivity</span>
              <input type="range" min={0} max={1} step={0.01} value={settings.sensitivity}
                onChange={(e) => { const v = Number(e.target.value); set('sensitivity', v); engine.setSensitivity(v); }} />
            </label>
            <p className="hint">Raise it if soft strums are missed. Lower it if one strum blinks the light twice.</p>
          </>
        )}
      </section>

      <section>
        <h2>Sound</h2>
        <div className="field">
          <span>I hear the game through</span>
          <div className="seg" role="radiogroup" aria-label="Where you hear the game">
            <button role="radio" aria-checked={speakers} className={speakers ? 'on' : ''} onClick={() => set('output', 'speakers')}>Speakers</button>
            <button role="radio" aria-checked={!speakers} className={!speakers ? 'on' : ''} onClick={() => set('output', 'headphones')}>Headphones</button>
          </div>
        </div>
        <label className="check"><input type="checkbox" checked={settings.metronome} onChange={(e) => set('metronome', e.target.checked)} /> Tick on every beat</label>
        <label className={`check${speakers ? ' off' : ''}`}>
          <input type="checkbox" disabled={speakers} checked={!speakers && settings.bassLine} onChange={(e) => set('bassLine', e.target.checked)} /> Bass line
        </label>
        {speakers && <p className="hint">The bass line needs headphones. Through speakers the microphone would hear it as your guitar.</p>}
      </section>

      <section>
        <h2>Timing</h2>
        <p className="hint">Sound takes a moment to get through your speakers and microphone. Play mode needs to know how long, or every strum looks late. Learn mode does not need this.</p>
        <div className="field">
          <span>{isCalibrated(settings) ? `Delay: ${settings.latencyMs} ms` : 'Delay not measured yet'}</span>
          <button className="btn quiet" onClick={onCalibrate} disabled={!micOn}>Measure the delay</button>
        </div>
      </section>

      <section>
        <h2>Rules</h2>
        <label className="check"><input type="checkbox" checked={settings.checkChords} onChange={(e) => set('checkChords', e.target.checked)} /> Check that I play the right chord</label>
        <p className="hint">Turn this off to practise only the rhythm.</p>
        <label className="check"><input type="checkbox" checked={settings.ringOut} onChange={(e) => set('ringOut', e.target.checked)} /> End every song on one long chord</label>
      </section>

      {shop.paywall && (
        <section>
          <h2>Songs</h2>
          {shop.owned ? (
            <p className="hint">All songs are open on this account. Thank you for buying.</p>
          ) : (
            <>
              <p className="hint">Warm-ups and Easy songs are free. Medium and Hard songs open with a one-time purchase. Bought it on another phone? Restore it from the same screen.</p>
              <button className="btn quiet" onClick={onUnlock}>{shop.price ? `Unlock all songs for ${shop.price}` : 'Unlock all songs'}</button>
            </>
          )}
        </section>
      )}
    </div>
  );
}
