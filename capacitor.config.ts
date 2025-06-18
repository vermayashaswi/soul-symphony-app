
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.soulo.app',
  appName: 'Soulo',
  webDir: 'dist',
  server: {
    url: 'https://soulo.online/app?source=capacitor&forceHideBadge=true',
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
      splashImmersive: true,
      launchShowDuration: 2000,
      launchFadeOutDuration: 1000,
      androidScaleType: "CENTER_CROP",
      iosContentMode: "scaleAspectFill"
    },
    // Handle keyboard properly
    Keyboard: {
      resize: "body",
      style: "dark",
      resizeOnFullScreen: true
    },
    // App preferences
    Preferences: {
      group: "com.soulo.app.preferences"
    },
    // Status bar configuration
    StatusBar: {
      style: "default",
      backgroundColor: "#8b5cf6",
      overlaysWebView: false
    },
    // App configuration
    App: {
      skipInitialNavigationCheck: true
    }
  },
  // iOS-specific configuration
  ios: {
    contentInset: "always",
    allowsLinkPreview: false,
    scrollEnabled: true,
    useUserAgentString: false,
    limitsNavigationsToAppBoundDomains: true,
    backgroundColor: "#8b5cf6",
    scheme: "Soulo"
  },
  // Android-specific configuration
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: "#8b5cf6",
    loggingBehavior: "none"
  }
};

export default config;
