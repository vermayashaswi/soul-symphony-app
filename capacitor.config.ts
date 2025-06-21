
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.soulo.online',
  appName: 'soul-symphony-app',
  webDir: 'dist',
  server: {
    url: 'https://soulo.online?forceHideBadge=true',
    cleartext: true
  },
  // Ensure proper permissions for iOS and Android
  plugins: {
    // Enhanced splash screen configurations
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#FFFFFF",
      showSpinner: true,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#8b5cf6",
      splashFullScreen: true,
      splashImmersive: true,
      // Enhanced splash screen timing
      launchShowDuration: 3000,
      launchFadeOutDuration: 500,
      androidScaleType: "CENTER_CROP",
      iosContentMode: "scaleAspectFill"
    },
    // Handle keyboard properly
    Keyboard: {
      resize: "body",
      style: "dark",
      resizeOnFullScreen: true
    },
    // Enhanced status bar for splash screen
    StatusBar: {
      style: "dark",
      backgroundColor: "#FFFFFF"
    }
  },
  // iOS-specific configuration
  ios: {
    contentInset: "always",
    allowsLinkPreview: false,
    scrollEnabled: true,
    useUserAgentString: false,
    limitsNavigationsToAppBoundDomains: true,
    backgroundColor: "#FFFFFF",
    // Enhanced splash screen settings
    splashScreenBackgroundColor: "#FFFFFF",
    splashScreenScaleType: "scaleAspectFill"
  },
  // Android-specific configuration
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
    // Enhanced splash screen settings
    splashScreenBackgroundColor: "#FFFFFF",
    splashScreenScaleType: "CENTER_CROP"
  }
};

export default config;
