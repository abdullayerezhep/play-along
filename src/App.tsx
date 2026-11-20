import { useEffect, useState } from 'react';
import { AudioEngine } from './audio/engine';
import { Calibrate } from './components/Calibrate';
import { Game } from './components/Game';
import { Results } from './components/Results';
import { Setup } from './components/Setup';
import type { Stats } from './game/judge';
import { loadSettings, saveSettings, type AppSettings } from './settings';

type Screen = { name: 'setup' } | { name: 'calibrate' } | { name: 'play'; run: number } | { name: 'results'; stats: Stats };

export default function App() {
  const [engine] = useState(() => new AudioEngine());
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [screen, setScreen] = useState<Screen>({ name: 'setup' });

  useEffect(() => saveSettings(settings), [settings]);

  // Space strums on the menu too, handy for testing without a guitar.
  useEffect(() => {
    if (screen.name === 'play') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); engine.tap(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [engine, screen.name]);

  const play = async () => {
    await engine.ctx.resume();
    setScreen({ name: 'play', run: Date.now() });
  };

  return (
    <main className="app">
      {screen.name === 'setup' && (
        <Setup engine={engine} settings={settings} onChange={setSettings} onStart={play}
          onCalibrate={() => setScreen({ name: 'calibrate' })} />
      )}
      {screen.name === 'calibrate' && (
        <Calibrate engine={engine} onDone={(ms) => {
          if (ms !== null) setSettings((s) => ({ ...s, latencyMs: ms }));
          setScreen({ name: 'setup' });
        }} />
      )}
      {screen.name === 'play' && (
        <Game key={screen.run} engine={engine} settings={settings}
          onFinish={(stats) => setScreen({ name: 'results', stats })}
          onQuit={() => setScreen({ name: 'setup' })} />
      )}
      {screen.name === 'results' && (
        <Results stats={screen.stats} onRetry={play} onMenu={() => setScreen({ name: 'setup' })} />
      )}
    </main>
  );
}
