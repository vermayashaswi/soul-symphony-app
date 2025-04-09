
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.soulo.online',
  appName: 'soul-symphony-app',
  webDir: 'dist',
  server: {
    url: 'https://soulo.online?forceHideBadge=true',
    cleartext: true
  },
  // Ensure proper permissions for Android
  plugins: {
    // Add any plugin configurations here if needed
  }
};

export default config;
