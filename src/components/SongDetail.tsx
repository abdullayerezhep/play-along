import { useState } from 'react';
import type { Best } from '../best';
import { CUSTOM_ID, MINE, PATTERNS, getProgression, lengthOptions, parseSong, songLength, type SavedSong } from '../game/chart';
import { LEVELS, SONGS } from '../game/songs';
import { slotsFromHits } from '../game/slots';
import type { AppSettings } from '../settings';
import { ChordDiagram } from './ChordDiagram';
import { useChordHelp } from './chordHelp';
import { BackIcon } from './Icons';
import { Stars } from './Stars';
import { StrumStrip } from './StrumStrip';

type Props = {
  settings: AppSettings;
  best: Best;
  micOn: boolean;
  micError: string;
  onChange: (s: AppSettings) => void;
  /** Start the song. `withMic` asks for the microphone first. */
  onStart: (withMic: boolean) => void;
  onBack: () => void;
};

/**
 * Everything about one song, in the order a beginner needs it: the chords to
 * learn, how to strum, how fast, and then the start button.
 */
export function SongDetail({ settings, best, micOn, micError, onChange, onStart, onBack }: Props) {
  const showHelp = useChordHelp();
  const [choosingStrum, setChoosingStrum] = useState(false);
  const [askMic, setAskMic] = useState(false);
  const [name, setName] = useState('');
  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => onChange({ ...settings, [k]: v });

  const id = settings.progressionId;
  const typing = id === CUSTOM_ID;
  const parsed = parseSong(settings.customChords);
  const songError = typing && 'error' in parsed ? parsed.error : '';
  const song = getProgression(settings);
  const library = SONGS.find((s) => s.id === id);
  const chords = songError ? [] : [...new Set(song.bars.flat())];
  const pattern = PATTERNS.find((p) => p.id === settings.patternId) ?? PATTERNS[0];
  const lengths = lengthOptions(song);
  const length = songLength(song, settings.bars, false).playBars;
  const learn = settings.mode === 'learn';
  /** No keyboard on a phone: there a tap on the screen stands in for a strum. */
  const touch = window.matchMedia('(pointer: coarse)').matches;
  const level = LEVELS.find((l) => l.id === library?.level);

  const save = () => {
    if (!('bars' in parsed) || !name.trim()) return;
    const saved: SavedSong = {
      id: `${MINE}${Date.now().toString(36)}`, name: name.trim(), chords: settings.customChords.trim(),
      bpm: settings.bpm, patternId: settings.patternId,
    };
    onChange({ ...settings, mySongs: [...settings.mySongs, saved], progressionId: saved.id, customChords: '' });
    setName('');
  };

  const start = () => {
    if (songError) return;
    if (!micOn) { setAskMic(true); return; }
    onStart(false);
  };

  return (
    <article className="song-page">
      <header className="song-head">
        <button className="back" onClick={onBack} aria-label="Back to the song list"><BackIcon /></button>
        <div>
          <h1>{typing ? 'Your own song' : song.name}</h1>
          <p className="song-about">
            {typing ? 'Type the chords, then play it or save it.' : library?.about ?? 'Your song'}
            {level && <span className="tag">{level.name}</span>}
            {best[id] && <Stars grade={best[id].grade} />}
          </p>
        </div>
      </header>

      {typing && (
        <section>
          <input type="text" className="song-input" value={settings.customChords} placeholder="G D Em C" spellCheck={false} autoCapitalize="off"
            aria-label="Chords of your song" aria-invalid={!!songError} onChange={(e) => set('customChords', e.target.value)} />
          {songError
            ? <p className="hint error">{songError}</p>
            : <p className="hint">One chord per bar. To put two chords in one bar, draw the bar lines: <code>| G | D | Em C |</code></p>}
          {'bars' in parsed && (
            <div className="save-song">
              <input type="text" className="song-input plain" value={name} placeholder="Name it to keep it" aria-label="Song name" maxLength={60}
                onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
              <button className="btn quiet" disabled={!name.trim()} onClick={save}>Save song</button>
            </div>
          )}
        </section>
      )}

      {chords.length > 0 && (
        <section>
          <h2>{chords.length === 1 ? 'The chord you need' : `The ${chords.length} chords you need`}</h2>
          <div className="need">
            {chords.map((c) => (
              <button key={c} className="need-chord" onClick={() => showHelp(c)} aria-label={`${c}: how to play it`}>
                <ChordDiagram chord={c} size={84} />
                <span>{c}</span>
              </button>
            ))}
          </div>
          <p className="hint">Tap a chord to see where each finger goes.</p>
        </section>
      )}

      <section>
        <h2>How to strum it</h2>
        <div className="strum-now">
          <StrumStrip slots={slotsFromHits(pattern.hits)} count />
          <div>
            <p className="say">{pattern.say}</p>
            <p className="hint">{pattern.about}</p>
          </div>
        </div>
        <p className="hint">This is one bar of the song, repeated. ▼ is a strum down, ▲ a strum up, and an empty box is a beat where your hand passes without touching the strings.</p>
        <button className="link" aria-expanded={choosingStrum} onClick={() => setChoosingStrum(!choosingStrum)}>
          {choosingStrum ? 'Hide the other strums' : 'Choose an easier or harder strum'}
        </button>
        {choosingStrum && (
          <ul className="strum-choices">
            {PATTERNS.map((p) => (
              <li key={p.id}>
                <button className={p.id === pattern.id ? 'on' : ''} onClick={() => { set('patternId', p.id); setChoosingStrum(false); }}>
                  <span className="choice-name">{p.name}<small>{p.level}</small></span>
                  <StrumStrip slots={slotsFromHits(p.hits)} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>How fast</h2>
        <label className="tempo">
          <span className="bpm">{settings.bpm}<small>beats a minute</small></span>
          <input type="range" min={50} max={160} step={1} value={settings.bpm} onChange={(e) => set('bpm', Number(e.target.value))} aria-label="Tempo" />
        </label>
        <p className="hint">
          {learn ? 'In Learn mode the song waits for you, so this only sets how quickly the notes arrive.' : 'Slower is easier. Speed it up once it feels comfortable.'}
          {library?.bpm && library.bpm !== settings.bpm && <> The song's own speed is {library.bpm}. <button className="link inline" onClick={() => set('bpm', library.bpm!)}>Use it</button></>}
        </p>
        <div className="seg" role="radiogroup" aria-label="Song length">
          {lengths.map((b) => (
            <button key={b} role="radio" aria-checked={length === b} className={length === b ? 'on' : ''} onClick={() => set('bars', b)}>{b} bars</button>
          ))}
        </div>
      </section>

      <footer className="song-start">
        {askMic && !micOn && (
          <div className="ask-mic" role="alert">
            <p>{micError || "The microphone is off, so the game can't hear your guitar."}</p>
            <button className="btn" onClick={() => onStart(true)}>Turn it on and start</button>
            <button className="btn quiet" onClick={() => onStart(false)}>{touch ? 'Play by tapping the screen' : 'Play with the Space bar'}</button>
          </div>
        )}
        <div className="start-row">
          <div className="mode">
            <div className="seg" role="radiogroup" aria-label="How to play">
              <button role="radio" aria-checked={learn} className={learn ? 'on' : ''} onClick={() => set('mode', 'learn')}>Learn</button>
              <button role="radio" aria-checked={!learn} className={!learn ? 'on' : ''} onClick={() => set('mode', 'play')}>Play</button>
            </div>
            <span>{learn ? 'The song waits until you have played each strum.' : 'The song keeps going and your timing is scored.'}</span>
          </div>
          <button className="btn go" onClick={start} disabled={!!songError}>{learn ? 'Start learning' : 'Start playing'}</button>
        </div>
      </footer>
    </article>
  );
}
