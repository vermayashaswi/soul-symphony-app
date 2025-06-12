
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
    // Enhanced splash screen configuration
    SplashScreen: {
      launchAutoHide: false, // We control this from our React app
      backgroundColor: "#8b5cf6",
      showSpinner: false, // We have our own loading indicator
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#ffffff",
      splashFullScreen: true,
      splashImmersive: true,
      layoutName: "launch_screen",
      useDialog: true
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
      style: "light",
      overlaysWebView: false
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
    handleApplicationNotifications: false
  },
  // Android-specific configuration
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false, // Disable for production
    backgroundColor: "#8b5cf6",
    loggingBehavior: "none"
  }
};

export default config;
