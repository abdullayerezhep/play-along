import type { SongSettings } from './game/chart';

export type AppSettings = SongSettings & {
  latencyMs: number;
  sensitivity: number;
  metronome: boolean;
  bassLine: boolean;
  checkChords: boolean;
};

const KEY = 'play-along:settings';

export const defaultSettings: AppSettings = {
  bpm: 80, bars: 16, patternId: 'quarters', progressionId: 'pop',
  latencyMs: 0, sensitivity: 0.6, metronome: true, bassLine: true, checkChords: true,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(s: AppSettings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
}
