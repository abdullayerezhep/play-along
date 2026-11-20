import { useEffect, useState } from 'react';
import { AudioEngine } from './audio/engine';
import { Calibrate } from './components/Calibrate';
import { Game } from './components/Game';
import { Results } from './components/Results';
import { Setup } from './components/Setup';
import { Tuner } from './components/Tuner';
import { loadBest, recordBest, type Best } from './best';
import { CUSTOM_ID } from './game/chart';
import { accuracy, grade, type Stats } from './game/judge';
import { isCalibrated, loadSettings, saveSettings, type AppSettings } from './settings';

type Screen =
  | { name: 'setup' }
  | { name: 'calibrate'; then: 'setup' | 'play' }
  | { name: 'tuner' }
  | { name: 'play'; run: number }
  | { name: 'results'; stats: Stats; newBest: boolean };

export default function App() {
  const [engine] = useState(() => new AudioEngine());
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [screen, setScreen] = useState<Screen>({ name: 'setup' });
  const [skippedCalibration, setSkippedCalibration] = useState(false);
  const [best, setBest] = useState<Best>(loadBest);

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

  const play = async () => {
    await engine.ctx.resume();
    setScreen({ name: 'play', run: Date.now() });
  };

  /** The first song with a mic goes through the delay measurement once. */
  const start = () => {
    if (engine.micReady && !isCalibrated(settings) && !skippedCalibration) setScreen({ name: 'calibrate', then: 'play' });
    else void play();
  };

  /** A song played on a real guitar can set a new best grade for that song. */
  const finish = (stats: Stats) => {
    const counts = engine.micReady && stats.keyStrums === 0 && settings.progressionId !== CUSTOM_ID;
    const r = counts ? recordBest(best, settings.progressionId, grade(accuracy(stats)), accuracy(stats)) : { best, improved: false };
    setBest(r.best);
    setScreen({ name: 'results', stats, newBest: r.improved });
  };

  const calibrated = (then: 'setup' | 'play') => (ms: number | null) => {
    if (ms !== null) setSettings((s) => ({ ...s, latencyMs: ms, calibratedFor: s.output }));
    else if (then === 'play') {
      setSkippedCalibration(true);
      // better than assuming no delay at all
      if (!isCalibrated(settings)) setSettings((s) => ({ ...s, latencyMs: engine.estimatedLatencyMs() }));
    }
    if (then === 'play') void play(); else setScreen({ name: 'setup' });
  };

  return (
    <main className="app">
      {screen.name === 'setup' && (
        <Setup engine={engine} settings={settings} best={best} onChange={change} onStart={start}
          onCalibrate={() => setScreen({ name: 'calibrate', then: 'setup' })}
          onTune={() => setScreen({ name: 'tuner' })} />
      )}
      {screen.name === 'calibrate' && (
        <Calibrate engine={engine} firstRun={screen.then === 'play'} onDone={calibrated(screen.then)} />
      )}
      {screen.name === 'tuner' && <Tuner engine={engine} onDone={() => setScreen({ name: 'setup' })} />}
      {screen.name === 'play' && (
        <Game key={screen.run} engine={engine} settings={settings}
          onFinish={finish}
          onRestart={play}
          onQuit={() => setScreen({ name: 'setup' })} />
      )}
      {screen.name === 'results' && (
        <Results stats={screen.stats} newBest={screen.newBest} calibrated={isCalibrated(settings)} usedMic={engine.micReady}
          onRetry={play} onMenu={() => setScreen({ name: 'setup' })} />
      )}
    </main>
  );
}
