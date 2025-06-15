
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.soulo.online',
  appName: 'SOULo',
  webDir: 'dist',
  server: {
    url: 'https://soulo.online?forceHideBadge=true',
    cleartext: true
  },
  // Ensure proper permissions for iOS and Android
  plugins: {
    // Add specific iOS-related configurations
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#8b5cf6",
      showSpinner: true,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#ffffff",
      splashFullScreen: true,
      splashImmersive: true
    },
    // Handle keyboard properly
    Keyboard: {
      resize: "body",
      style: "dark",
      resizeOnFullScreen: true
    },
    // Add status bar configuration
    StatusBar: {
      backgroundColor: "#8b5cf6",
      style: "light"
    }
  },
  // iOS-specific configuration
  ios: {
    contentInset: "always",
    allowsLinkPreview: false,
    scrollEnabled: true,
    useUserAgentString: false,
    limitsNavigationsToAppBoundDomains: true,
    backgroundColor: "#8b5cf6"
  },
  // Android-specific configuration
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
    backgroundColor: "#8b5cf6"
  }
};

export default config;
