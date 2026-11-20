import type { SongSettings } from './game/chart';

export type AppSettings = SongSettings & {
  latencyMs: number;
  sensitivity: number;
  metronome: boolean;
  bassLine: boolean;
  checkChords: boolean;
  ringOut: boolean;
};

const KEY = 'play-along:settings';

export const defaultSettings: AppSettings = {
  bpm: 80, bars: 16, patternId: 'quarters', progressionId: 'pop',
  latencyMs: 0, sensitivity: 0.6, metronome: true, bassLine: true, checkChords: true, ringOut: true,
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
