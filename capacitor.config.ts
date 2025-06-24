
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rhasys.soulo',
  appName: 'Soulo',
  webDir: 'dist',
  server: {
    url: 'https://soulo.online/app?forceHideBadge=true',
    cleartext: true
  },
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
    // Request essential permissions on app startup
    Permissions: {
      permissions: [
        'microphone',
        'notifications'
      ]
    }
  },
  ios: {
    contentInset: "always",
    allowsLinkPreview: false,
    scrollEnabled: true,
    useUserAgentString: false,
    limitsNavigationsToAppBoundDomains: true,
    backgroundColor: "#FFFFFF"
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
    // Add permissions to Android manifest
    permissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.POST_NOTIFICATIONS'
    ]
  }
};

export default config;
