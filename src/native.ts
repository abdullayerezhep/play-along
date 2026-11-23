import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/** True inside the Android or iOS app, false in a browser. */
export const isNative = Capacitor.isNativePlatform();

/** Things only the store apps need. Does nothing in a browser. */
export function setupNative() {
  if (!isNative) return;
  // Android's back button walks the same history as the browser's (see nav.ts) and leaves the app from the first screen.
  void App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) history.back(); else void App.exitApp();
  });
}
