import type { CapacitorConfig } from '@capacitor/cli';

/** The Android and iOS apps: the same web app, packaged with its files inside. See docs/mobile.md. */
const config: CapacitorConfig = {
  // The app's permanent id in the stores. Change it before the first release, never after.
  appId: 'com.abdullayerezhep.playalong',
  appName: 'Play Along',
  webDir: 'dist',
  backgroundColor: '#1a110d',
};

export default config;
