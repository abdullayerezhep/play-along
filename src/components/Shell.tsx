import type { ReactNode } from 'react';
import type { Tab } from '../nav';
import { GuideIcon, MicIcon, SettingsIcon, SongsIcon, TunerIcon } from './Icons';

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'songs', label: 'Songs', icon: <SongsIcon /> },
  { id: 'guide', label: 'Learn', icon: <GuideIcon /> },
  { id: 'tuner', label: 'Tuner', icon: <TunerIcon /> },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
];

type Props = {
  tab: Tab;
  onTab: (t: Tab) => void;
  micOn: boolean;
  onMic: () => void;
  /** A page below a tab is open (a song's page on a phone): the tab bar steps aside for it. */
  deep?: boolean;
  children: ReactNode;
};

/** The frame around every menu screen: a rail of destinations on a wide screen, a tab bar on a phone. */
export function Shell({ tab, onTab, micOn, onMic, deep, children }: Props) {
  return (
    <div className={`shell${deep ? ' deep' : ''}`}>
      <nav className="nav" aria-label="Main">
        <div className="brand">Play Along</div>
        <div className="nav-items">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => onTab(t.id)}>
              {t.icon}<span>{t.label}</span>
            </button>
          ))}
        </div>
        <button className={`mic-state${micOn ? ' on' : ''}`} onClick={onMic}>
          <MicIcon />
          <span>{micOn ? 'Microphone is on' : 'Turn on microphone'}</span>
        </button>
      </nav>
      <div className="page">{children}</div>
    </div>
  );
}
