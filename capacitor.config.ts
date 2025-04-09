
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.571d731eb54b453e9f48a2c79a572930',
  appName: 'soul-symphony-app',
  webDir: 'dist',
  server: {
    url: 'https://571d731e-b54b-453e-9f48-a2c79a572930.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  // Ensure proper permissions for Android
  plugins: {
    // Add any plugin configurations here if needed
  }
};

export default config;
