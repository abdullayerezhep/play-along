import { useState } from 'react';
import type { Best } from '../best';
import { CUSTOM_ID, MINE, getProgression, parseSong, suggestedBars, type SavedSong } from '../game/chart';
import { DEFAULT_SONG, LEVELS, SONGS, type Group, type Level, type Song } from '../game/songs';
import type { AppSettings } from '../settings';
import { ChordChip } from './ChordChip';

type Props = { settings: AppSettings; best: Best; onChange: (s: AppSettings) => void };
type Tab = Level | 'mine';

const MAX_CHIPS = 5;

function Chips({ bars }: { bars: string[][] }) {
  const chords = [...new Set(bars.flat())];
  return (
    <span className="chips">
      {chords.slice(0, MAX_CHIPS).map((c) => <ChordChip key={c} chord={c} />)}
      {chords.length > MAX_CHIPS && <span className="chip more">+{chords.length - MAX_CHIPS}</span>}
    </span>
  );
}

/** The song library by level, plus the player's own songs. */
export function SongPicker({ settings, best, onChange }: Props) {
  const selected = settings.progressionId;
  const mine = selected === CUSTOM_ID || selected.startsWith(MINE);
  const current = SONGS.find((s) => s.id === selected);
  const [tab, setTab] = useState<Tab>(mine ? 'mine' : current?.level ?? 'warmup');
  const [group, setGroup] = useState<Group>(current && current.level !== 'warmup' ? current.group ?? 'hit' : 'hit');
  const [name, setName] = useState('');

  /** Choosing a song also sets the tempo, strum and length that suit it. */
  const pick = (song: Song) => onChange({
    ...settings, progressionId: song.id, bars: suggestedBars(song),
    bpm: song.bpm ?? settings.bpm, patternId: song.patternId ?? settings.patternId,
  });

  const parsed = parseSong(settings.customChords);
  const typing = selected === CUSTOM_ID;
  const error = typing && 'error' in parsed ? parsed.error : '';

  const save = () => {
    if (!('bars' in parsed) || !name.trim()) return;
    const song: SavedSong = {
      id: `${MINE}${Date.now().toString(36)}`, name: name.trim(), chords: settings.customChords.trim(),
      bpm: settings.bpm, patternId: settings.patternId,
    };
    onChange({ ...settings, mySongs: [...settings.mySongs, song], progressionId: song.id, customChords: '' });
    setName('');
  };
  const remove = (id: string) => onChange({
    ...settings, mySongs: settings.mySongs.filter((m) => m.id !== id),
    progressionId: selected === id ? DEFAULT_SONG : selected,
  });

  const badge = (id: string) => best[id] && (
    <span className={`best g${best[id].grade}`} title={`Your best: ${best[id].grade}, ${Math.round(best[id].accuracy * 100)}% accurate`}>{best[id].grade}</span>
  );

  return (
    <fieldset className="picker">
      <legend>Song</legend>
      <div className="seg levels" role="tablist" aria-label="Difficulty">
        {LEVELS.map((l) => (
          <button key={l.id} role="tab" aria-selected={tab === l.id} className={tab === l.id ? 'on' : ''} onClick={() => setTab(l.id)}>{l.name}</button>
        ))}
        <button role="tab" aria-selected={tab === 'mine'} className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>My songs</button>
      </div>

      {tab !== 'mine' && tab !== 'warmup' && (
        <div className="seg groups" role="tablist" aria-label="Kind of song">
          <button role="tab" aria-selected={group === 'hit'} className={group === 'hit' ? 'on' : ''} onClick={() => setGroup('hit')}>Hits</button>
          <button role="tab" aria-selected={group === 'trad'} className={group === 'trad' ? 'on' : ''} onClick={() => setGroup('trad')}>Traditional</button>
        </div>
      )}

      {tab !== 'mine' ? (
        <>
          {SONGS.filter((s) => s.level === tab && (tab === 'warmup' || s.group === group)).map((s) => (
            <label key={s.id} className={`row${selected === s.id ? ' on' : ''}`}>
              <input type="radio" name="song" checked={selected === s.id} onChange={() => pick(s)} />
              <span className="row-name song">{s.name}<small>{s.about}</small></span>
              {badge(s.id)}
              <Chips bars={s.bars} />
            </label>
          ))}
          <p className="note">
            {LEVELS.find((l) => l.id === tab)!.about} Choosing a song sets a tempo and strum that suit it; change them as you like.
            {tab !== 'warmup' && group === 'hit' && ' Hits are simplified to plain major, minor and 7th chords.'}
          </p>
        </>
      ) : (
        <>
          {settings.mySongs.map((m) => {
            const song = getProgression({ ...settings, progressionId: m.id });
            return (
              <label key={m.id} className={`row${selected === m.id ? ' on' : ''}`}>
                <input type="radio" name="song" checked={selected === m.id} onChange={() => pick({ ...song, bpm: m.bpm, patternId: m.patternId })} />
                <span className="row-name song">{m.name}</span>
                {badge(m.id)}
                <Chips bars={song.bars} />
                <button type="button" className="del" aria-label={`Delete ${m.name}`} onClick={(e) => { e.preventDefault(); remove(m.id); }}>×</button>
              </label>
            );
          })}
          <label className={`row own${typing ? ' on' : ''}`}>
            <input type="radio" name="song" checked={typing} onChange={() => onChange({ ...settings, progressionId: CUSTOM_ID })} />
            <span className="row-name">New song</span>
            <input type="text" className="song-input" value={settings.customChords} placeholder="G D Em C" spellCheck={false}
              aria-label="Chords of your song" aria-invalid={!!error}
              onFocus={() => { if (!typing) onChange({ ...settings, progressionId: CUSTOM_ID }); }}
              onChange={(e) => onChange({ ...settings, progressionId: CUSTOM_ID, customChords: e.target.value })} />
          </label>
          {error && <p className="error note">{error}</p>}
          {typing && 'bars' in parsed && (
            <div className="save-song">
              <input type="text" className="song-input" value={name} placeholder="Name it to keep it" aria-label="Song name" maxLength={60}
                onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
              <button type="button" className="btn quiet small" disabled={!name.trim()} onClick={save}>Save song</button>
            </div>
          )}
          {!error && (
            <p className="note">
              Type the chords of any song you like, one chord per bar. To put two chords in a bar, draw the bar lines: <code>| G | D | Em C |</code>.
              A saved song keeps the tempo and strum you have set.
            </p>
          )}
        </>
      )}
    </fieldset>
  );
}
