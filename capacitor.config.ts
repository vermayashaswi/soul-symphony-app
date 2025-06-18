
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.soulo.online',
  appName: 'soul-symphony-app',
  webDir: 'dist',
  server: {
    url: 'https://soulo.online/app?forceHideBadge=true&nativeApp=true',
    cleartext: true,
    // Enhanced native app configuration
    allowNavigation: [
      'https://soulo.online/*',
      'https://*.supabase.co/*'
    ]
  },
  // Enhanced plugins configuration for better PWA support
  plugins: {
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
    Keyboard: {
      resize: "body",
      style: "dark",
      resizeOnFullScreen: true
    },
    // Add App plugin for better update handling
    App: {
      appendUserAgent: 'SouloNativeApp/1.0'
    }
  },
  // Enhanced iOS configuration
  ios: {
    contentInset: "always",
    allowsLinkPreview: false,
    scrollEnabled: true,
    useUserAgentString: false,
    limitsNavigationsToAppBoundDomains: true,
    backgroundColor: "#FFFFFF",
    // Enhanced WebView settings for better caching control
    webContentsDebuggingEnabled: true,
    allowsInlineMediaPlayback: true,
    mediaPlaybackRequiresUserAction: false
  },
  // Enhanced Android configuration
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
    // Enhanced WebView settings
    appendUserAgent: 'SouloNativeApp/1.0',
    overrideUserAgent: false,
    backgroundColor: "#FFFFFF"
  }
};

export default config;
