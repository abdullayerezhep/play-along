import { useState } from 'react';
import type { Best } from '../best';
import { isLocked, type Access } from '../game/access';
import { CUSTOM_ID, MINE, getProgression, suggestedBars } from '../game/chart';
import { DEFAULT_SONG, LEVELS, SONGS, type Group, type Level, type Song } from '../game/songs';
import type { AppSettings } from '../settings';
import { LockIcon, PlusIcon, SearchIcon } from './Icons';
import { Stars } from './Stars';

type Filter = Level | 'mine';

type Props = {
  settings: AppSettings;
  best: Best;
  access: Access;
  onChange: (s: AppSettings) => void;
  /** Called after a song is chosen, so a phone can open its page. */
  onOpen: () => void;
  onGuide: () => void;
};

const chordCount = (s: Song) => {
  const n = new Set(s.bars.flat()).size;
  return `${n} chord${n === 1 ? '' : 's'}`;
};

/** The song list: search, a level filter, and one plain row per song. */
export function SongsScreen({ settings, best, access, onChange, onOpen, onGuide }: Props) {
  const selected = settings.progressionId;
  const current = SONGS.find((s) => s.id === selected);
  const mine = selected === CUSTOM_ID || selected.startsWith(MINE);
  const [filter, setFilter] = useState<Filter>(mine ? 'mine' : current?.level ?? 'easy');
  const [group, setGroup] = useState<Group>(current && current.level !== 'warmup' ? current.group ?? 'hit' : 'hit');
  const [query, setQuery] = useState('');

  /** Choosing a song also sets the tempo, strum and length that suit it. */
  const pick = (song: Song) => {
    onChange({
      ...settings, progressionId: song.id, bars: suggestedBars(song), welcomed: true,
      bpm: song.bpm ?? settings.bpm, patternId: song.patternId ?? settings.patternId,
    });
    onOpen();
  };
  const remove = (id: string) => onChange({
    ...settings, mySongs: settings.mySongs.filter((m) => m.id !== id),
    progressionId: selected === id ? DEFAULT_SONG : selected,
  });

  const q = query.trim().toLowerCase();
  const found = q ? SONGS.filter((s) => `${s.name} ${s.about ?? ''}`.toLowerCase().includes(q)) : null;
  const listed = found ?? SONGS.filter((s) => s.level === filter && (filter === 'warmup' || s.group === group));
  const level = LEVELS.find((l) => l.id === filter);

  const row = (s: Song, extra?: JSX.Element) => (
    <li key={s.id} className={`song-row${selected === s.id ? ' on' : ''}`}>
      <button className="song-main" onClick={() => pick(s)} aria-current={selected === s.id ? 'true' : undefined}>
        <span className="song-title">{s.name}</span>
        <span className="song-sub">{s.about}</span>
      </button>
      <span className="song-meta">
        {best[s.id] && <Stars grade={best[s.id].grade} />}
        {isLocked(s, access)
          ? <span className="locked"><LockIcon /><span className="sr">Locked. </span>{chordCount(s)}</span>
          : <span>{chordCount(s)}</span>}
      </span>
      {extra}
    </li>
  );

  return (
    <div className="song-list">
      <header className="page-head">
        <h1>Songs</h1>
        <label className="search">
          <SearchIcon />
          <input type="search" value={query} placeholder="Find a song or artist" aria-label="Find a song or artist" onChange={(e) => setQuery(e.target.value)} />
        </label>
      </header>

      {!settings.welcomed && !q && (
        <section className="welcome">
          <h2>New here? Start with one chord.</h2>
          <p>"Just Em" needs two fingers. In Learn mode the song waits for you, so there is no way to be too slow.</p>
          <div className="actions">
            <button className="btn" onClick={() => { setFilter('warmup'); pick(SONGS.find((s) => s.id === 'em')!); }}>Start with Just Em</button>
            <button className="btn quiet" onClick={onGuide}>Learn the chords first</button>
            <button className="btn quiet" onClick={() => onChange({ ...settings, welcomed: true })}>I can already play</button>
          </div>
        </section>
      )}

      {!q && (
        <div className="filters">
          <div className="seg" role="tablist" aria-label="Difficulty">
            {LEVELS.map((l) => (
              <button key={l.id} role="tab" aria-selected={filter === l.id} className={filter === l.id ? 'on' : ''} onClick={() => setFilter(l.id)}>{l.name}</button>
            ))}
            <button role="tab" aria-selected={filter === 'mine'} className={filter === 'mine' ? 'on' : ''} onClick={() => setFilter('mine')}>My songs</button>
          </div>
          {filter !== 'mine' && filter !== 'warmup' && (
            <div className="seg" role="tablist" aria-label="Kind of song">
              <button role="tab" aria-selected={group === 'hit'} className={group === 'hit' ? 'on' : ''} onClick={() => setGroup('hit')}>Hits</button>
              <button role="tab" aria-selected={group === 'trad'} className={group === 'trad' ? 'on' : ''} onClick={() => setGroup('trad')}>Traditional</button>
            </div>
          )}
        </div>
      )}

      {found && <p className="list-note">{found.length ? `${found.length} song${found.length === 1 ? '' : 's'} found` : `Nothing matches "${query.trim()}". You can add any song yourself under My songs.`}</p>}
      {!found && level && (
        <p className="list-note">
          {level.about}
          {isLocked({ level: level.id }, access) && ' These open with a one-time purchase. Tap any song to look inside first.'}
        </p>
      )}

      {filter === 'mine' && !found ? (
        <>
          <p className="list-note">Songs you typed in yourself. Any song works if you know its chords.</p>
          <ul className="songs">
            {settings.mySongs.map((m) => row(
              { ...getProgression({ ...settings, progressionId: m.id }), about: 'Your song', bpm: m.bpm, patternId: m.patternId },
              <button className="del" aria-label={`Delete ${m.name}`} onClick={() => remove(m.id)}>×</button>,
            ))}
          </ul>
          <button className={`add-song${selected === CUSTOM_ID ? ' on' : ''}`} onClick={() => { onChange({ ...settings, progressionId: CUSTOM_ID, welcomed: true }); onOpen(); }}>
            <PlusIcon /> Add a song
          </button>
        </>
      ) : (
        <ul className="songs">{listed.map((s) => row(s))}</ul>
      )}
    </div>
  );
}
