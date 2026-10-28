import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.nihongotracker.mobile',
  appName: 'NihongoTracker',
  webDir: 'www',
  server: {
    androidScheme: 'https',
    cleartext: process.env.CAPACITOR_LOCAL === 'true',
  },
  plugins: {
    CapacitorHttp: { enabled: true },
    SystemBars: { insetsHandling: 'css', initialViewportFitValueHint: 'cover' },
    Keyboard: { resizeOnFullScreen: true },
  },
};

export default config;
