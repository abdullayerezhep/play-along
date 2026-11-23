import { useCallback, useEffect, useState } from 'react';

export type Tab = 'songs' | 'guide' | 'tuner' | 'settings';

/** Where the player is in the app. */
export type Screen =
  | { name: 'home'; tab: Tab; /** phone: the chosen song's page is open */ detail?: boolean }
  | { name: 'calibrate'; then: 'back' | 'play' }
  | { name: 'play'; run: number }
  | { name: 'results' };

const HOME: Screen = { name: 'home', tab: 'songs' };

/**
 * The current screen, kept in step with the browser's history, so the Back button
 * (and the hardware back button in the Android app) does what people expect:
 * song page → list, game → the page you started it from.
 */
export function useScreens() {
  const [screen, setScreen] = useState<Screen>(HOME);

  useEffect(() => {
    history.replaceState({ screen: HOME }, '');
    const onPop = (e: PopStateEvent) => {
      const s = (e.state as { screen?: Screen } | null)?.screen;
      // a finished game or its results cannot be re-entered from history
      setScreen(s && s.name === 'home' ? s : HOME);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  /** Go to a screen. `replace` swaps the current history entry instead of adding one. */
  const go = useCallback((s: Screen, replace = false) => {
    if (replace) history.replaceState({ screen: s }, '');
    else history.pushState({ screen: s }, '');
    setScreen(s);
  }, []);
  const back = useCallback(() => history.back(), []);

  return { screen, go, back };
}
