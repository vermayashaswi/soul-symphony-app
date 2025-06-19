
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.soulo.online',
  appName: 'soul-symphony-app',
  webDir: 'dist',
  server: {
    url: 'https://soulo.online?forceHideBadge=true',
    cleartext: true
  },
  // Enhanced plugins configuration for webtonative keyboard handling
  plugins: {
    // Enhanced splash screen configuration
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#FFFFFF",
      showSpinner: true,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#8b5cf6",
      splashFullScreen: true,
      splashImmersive: true
    },
    // Advanced keyboard configuration for webtonative
    Keyboard: {
      resize: "ionic", // Use ionic resize mode for better control
      style: "dark",
      resizeOnFullScreen: true,
      // Prevent keyboard from pushing content up
      disableScroll: false,
      // Use native keyboard handling
      nativeScrollMode: false
    },
    // Add status bar configuration for consistent UI
    StatusBar: {
      style: "light",
      backgroundColor: "#FFFFFF",
      overlaysWebView: false
    },
    // Add app configuration for better webview handling
    App: {
      // Handle app state changes
      handleAppUrlOpen: true,
      // Optimize for webtonative
      handleHttpSchemes: true
    }
  },
  // Enhanced iOS-specific configuration
  ios: {
    contentInset: "always",
    allowsLinkPreview: false,
    scrollEnabled: true,
    useUserAgentString: false,
    limitsNavigationsToAppBoundDomains: true,
    backgroundColor: "#FFFFFF",
    // Enhanced keyboard handling for iOS
    keyboardDisplayRequiresUserAction: false,
    suppressesIncrementalRendering: false,
    // Viewport configuration
    viewportFit: "cover"
  },
  // Enhanced Android-specific configuration
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
    // Enhanced keyboard handling for Android
    appendUserAgent: "webtonative-app",
    overrideUserAgent: false,
    // WebView configuration
    themeColor: "#FFFFFF",
    // Handle keyboard properly
    softInputMode: "adjustResize"
  }
};

export default config;
