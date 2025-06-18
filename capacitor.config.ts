
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.soulo.online',
  appName: 'soul-symphony-app',
  webDir: 'dist',
  server: {
    url: 'https://soulo.online/app?forceHideBadge=true&nativeApp=true&pwabuilder=true',
    cleartext: true,
    // Enhanced configuration for both PWA Builder and Capacitor
    allowNavigation: [
      'https://soulo.online/*',
      'https://*.supabase.co/*'
    ]
  },
  // Enhanced plugins configuration for better PWA Builder support
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
    // Enhanced App plugin for better update handling and PWA Builder compatibility
    App: {
      appendUserAgent: 'SouloNativeApp/1.0 PWABuilderCompatible'
    }
  },
  // Enhanced iOS configuration for PWA Builder compatibility
  ios: {
    contentInset: "always",
    allowsLinkPreview: false,
    scrollEnabled: true,
    useUserAgentString: false,
    limitsNavigationsToAppBoundDomains: true,
    backgroundColor: "#FFFFFF",
    // Enhanced WebView settings for better caching control and PWA Builder support
    webContentsDebuggingEnabled: true,
    allowsInlineMediaPlayback: true,
    mediaPlaybackRequiresUserAction: false
  },
  // Enhanced Android configuration for PWA Builder compatibility
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
    // Enhanced WebView settings for PWA Builder support
    appendUserAgent: 'SouloNativeApp/1.0 PWABuilderCompatible',
    overrideUserAgent: false,
    backgroundColor: "#FFFFFF"
  }
};

export default config;
