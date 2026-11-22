import type { SavedSong, SongSettings } from './game/chart';

export type Output = 'speakers' | 'headphones';

export type Mode = 'learn' | 'play';

export type AppSettings = SongSettings & {
  /** learn: the song waits at every note until you have played it. play: you keep up with the beat. */
  mode: Mode;
  customChords: string;
  /** Songs the player typed in and kept. */
  mySongs: SavedSong[];
  /** Where the player hears the game. Through speakers the mic hears it too, so the bass line stays off. */
  output: Output;
  latencyMs: number;
  /** Which output the delay was measured on (null = never measured). */
  calibratedFor: Output | null;
  sensitivity: number;
  metronome: boolean;
  bassLine: boolean;
  checkChords: boolean;
  ringOut: boolean;
};

const KEY = 'play-along:settings';

export const defaultSettings: AppSettings = {
  mode: 'learn',
  bpm: 80, bars: 16, patternId: 'quarters', progressionId: 'pop', customChords: '', mySongs: [],
  output: 'speakers', latencyMs: 0, calibratedFor: null,
  sensitivity: 0.6, metronome: true, bassLine: true, checkChords: true, ringOut: true,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSettings;
    const s = { ...defaultSettings, ...JSON.parse(raw) };
    if (s.patternId === 'one') s.patternId = 'ring'; // renamed pattern
    return s;
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(s: AppSettings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
}

export const isCalibrated = (s: AppSettings) => s.calibratedFor === s.output;
