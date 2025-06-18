
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.soulo.online',
  appName: 'soul-symphony-app',
  webDir: 'dist',
  // Basic server configuration for development only
  server: {
    url: 'https://soulo.online?forceHideBadge=true',
    cleartext: true
  }
};

export default config;
