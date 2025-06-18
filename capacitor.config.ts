
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.soulo.online',
  appName: 'soul-symphony-app',
  webDir: 'dist',
  // Point to the app route instead of root for mobile apps
  server: {
    url: 'https://soulo.online/app?forceHideBadge=true',
    cleartext: true
  }
};

export default config;
