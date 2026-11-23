import { afterEach, describe, expect, it, vi } from 'vitest';
import { getProgression } from '../src/game/chart';
import { defaultSettings, loadSettings } from '../src/settings';

const withStorage = (saved: string | null) =>
  vi.stubGlobal('localStorage', { getItem: () => saved, setItem: () => {} });

afterEach(() => vi.unstubAllGlobals());

describe('settings', () => {
  it('starts a newcomer on the one-chord warm-up, in learn mode, with the welcome still to show', () => {
    withStorage(null);
    const s = loadSettings();
    expect(s.welcomed).toBe(false);
    expect(s.mode).toBe('learn');
    expect(getProgression(s).bars.flat()).toEqual(['Em']);
  });

  it('does not welcome someone who has played before, and keeps their song', () => {
    // settings saved by a version from before the welcome existed
    withStorage(JSON.stringify({ progressionId: 'pop', bpm: 96 }));
    const s = loadSettings();
    expect(s.welcomed).toBe(true);
    expect(s.progressionId).toBe('pop');
    expect(s.bpm).toBe(96);
    expect(s.sensitivity).toBe(defaultSettings.sensitivity);
  });

  it('falls back to the defaults when the saved settings are unreadable', () => {
    withStorage('{not json');
    expect(loadSettings()).toEqual(defaultSettings);
  });
});
