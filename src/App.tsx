import { useCallback, useEffect, useState } from 'react';
import { AudioEngine } from './audio/engine';
import { Calibrate } from './components/Calibrate';
import { ChordCard } from './components/ChordCard';
import { ChordHelpContext, type ShowChordHelp } from './components/chordHelp';
import { Game } from './components/Game';
import { Library } from './components/Library';
import { Results } from './components/Results';
import { SettingsScreen } from './components/SettingsScreen';
import { Shell } from './components/Shell';
import { SongDetail } from './components/SongDetail';
import { SongsScreen } from './components/SongsScreen';
import { Tuner } from './components/Tuner';
import { loadBest, recordBest, type Best } from './best';
import { CUSTOM_ID } from './game/chart';
import { accuracy, grade, type Stats } from './game/judge';
import { useScreens, type Tab } from './nav';
import { isCalibrated, loadSettings, saveSettings, type AppSettings } from './settings';

/** On a narrow screen the song list and the song's page are two separate pages. */
const onPhone = () => window.matchMedia('(max-width: 899px)').matches;

export default function App() {
  const [engine] = useState(() => new AudioEngine());
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const { screen, go, back } = useScreens();
  const [micOn, setMicOn] = useState(engine.micReady);
  const [micError, setMicError] = useState('');
  const [skippedCalibration, setSkippedCalibration] = useState(false);
  const [best, setBest] = useState<Best>(loadBest);
  const [result, setResult] = useState<{ stats: Stats; newBest: boolean; learn: boolean } | null>(null);
  /** The chord being explained in the "how to play it" card, if any. */
  const [help, setHelp] = useState<{ chord: string; onClose?: () => void } | null>(null);
  const showHelp = useCallback<ShowChordHelp>((chord, onClose) => setHelp({ chord, onClose }), []);
  const closeHelp = () => { help?.onClose?.(); setHelp(null); };

  useEffect(() => saveSettings(settings), [settings]);

  // Space strums on the menus too, handy for trying the mic lamp without a guitar.
  useEffect(() => {
    if (screen.name === 'play') return;
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLButtonElement || e.target instanceof HTMLInputElement;
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && !typing(e)) { e.preventDefault(); if (!e.repeat) engine.tap(); } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') engine.release(); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [engine, screen.name]);

  const change = (next: AppSettings) => {
    if (next.output !== settings.output) setSkippedCalibration(false); // other speakers, other delay
    setSettings(next);
  };

  const enableMic = async (): Promise<boolean> => {
    try {
      await engine.startMic();
      engine.setSensitivity(settings.sensitivity);
      setMicOn(true);
      setMicError('');
      return true;
    } catch (e) {
      setMicError(`The microphone is blocked${e instanceof Error ? ` (${e.message})` : ''}. Allow it in the site or app settings, then try again.`);
      return false;
    }
  };

  /** `replace` keeps Back pointing at the menu when one game follows another. */
  const play = async (replace: boolean) => {
    await engine.ctx.resume();
    go({ name: 'play', run: Date.now() }, replace);
  };

  /** The first Play-mode song with a mic goes through the delay measurement once. */
  const start = async (withMic: boolean) => {
    if (withMic && !(await enableMic())) return;
    // timing is only judged in play mode, so only that needs the delay measured
    if (settings.mode === 'play' && engine.micReady && !isCalibrated(settings) && !skippedCalibration) go({ name: 'calibrate', then: 'play' });
    else void play(false);
  };

  /** A song played on a real guitar can set a new best result for that song. */
  const finish = (stats: Stats) => {
    const counts = settings.mode === 'play' && engine.micReady && stats.keyStrums === 0 && settings.progressionId !== CUSTOM_ID;
    const r = counts ? recordBest(best, settings.progressionId, grade(accuracy(stats)), accuracy(stats)) : { best, improved: false };
    setBest(r.best);
    setResult({ stats, newBest: r.improved, learn: settings.mode === 'learn' });
    go({ name: 'results' }, true);
  };

  const calibrated = (then: 'back' | 'play') => (ms: number | null) => {
    if (ms !== null) setSettings((s) => ({ ...s, latencyMs: ms, calibratedFor: s.output }));
    else if (then === 'play') {
      setSkippedCalibration(true);
      // better than assuming no delay at all
      if (!isCalibrated(settings)) setSettings((s) => ({ ...s, latencyMs: engine.estimatedLatencyMs() }));
    }
    if (then === 'play') void play(true); else back();
  };

  const tab = (t: Tab) => go({ name: 'home', tab: t }, true);
  const micButton = () => { if (micOn) tab('settings'); else void enableMic().then((ok) => { if (!ok) tab('settings'); }); };

  return (
    <ChordHelpContext.Provider value={showHelp}>
    <main className="app">
      {screen.name === 'home' && (
        <Shell tab={screen.tab} onTab={tab} micOn={micOn} onMic={micButton} deep={!!screen.detail}>
          {screen.tab === 'songs' && (
            <div className={`split${screen.detail ? ' detail' : ''}`}>
              <SongsScreen settings={settings} best={best} onChange={change}
                onOpen={() => { if (onPhone() && !screen.detail) go({ name: 'home', tab: 'songs', detail: true }); }}
                onGuide={() => tab('guide')} />
              <SongDetail key={settings.progressionId} settings={settings} best={best} micOn={micOn} micError={micError}
                onChange={change} onStart={start} onBack={back} />
            </div>
          )}
          {screen.tab === 'guide' && <Library />}
          {screen.tab === 'tuner' && <Tuner engine={engine} micOn={micOn} micError={micError} onMic={enableMic} />}
          {screen.tab === 'settings' && (
            <SettingsScreen engine={engine} settings={settings} micOn={micOn} micError={micError} onMic={enableMic}
              onChange={change} onCalibrate={() => go({ name: 'calibrate', then: 'back' })} />
          )}
        </Shell>
      )}
      {screen.name === 'calibrate' && (
        <Calibrate engine={engine} firstRun={screen.then === 'play'} onDone={calibrated(screen.then)} />
      )}
      {screen.name === 'play' && (
        <Game key={screen.run} engine={engine} settings={settings}
          onFinish={finish}
          onRestart={() => void play(true)}
          onQuit={back} />
      )}
      {screen.name === 'results' && result && (
        <Results stats={result.stats} learn={result.learn} newBest={result.newBest} calibrated={isCalibrated(settings)} usedMic={engine.micReady}
          onRetry={() => void play(true)} onMenu={back}
          onPlayMode={() => { setSettings((s) => ({ ...s, mode: 'play' })); back(); }} />
      )}
      {help && <ChordCard key={help.chord} chord={help.chord} engine={engine} onClose={closeHelp} />}
    </main>
    </ChordHelpContext.Provider>
  );
}
