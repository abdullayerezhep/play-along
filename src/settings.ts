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
  /** The first-visit welcome has been answered or dismissed. */
  welcomed: boolean;
};

const KEY = 'play-along:settings';

export const defaultSettings: AppSettings = {
  mode: 'learn',
  // a newcomer starts on the one-chord warm-up
  bpm: 70, bars: 16, patternId: 'ring', progressionId: 'em', customChords: '', mySongs: [],
  output: 'speakers', latencyMs: 0, calibratedFor: null,
  sensitivity: 0.6, metronome: true, bassLine: true, checkChords: true, ringOut: true, welcomed: false,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSettings;
    // someone with saved settings has been here before
    const s = { ...defaultSettings, welcomed: true, ...JSON.parse(raw) };
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
