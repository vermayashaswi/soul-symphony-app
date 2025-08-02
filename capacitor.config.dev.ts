import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.soulo.online',
  appName: 'Soulo Dev',
  webDir: 'dist',
  // CRITICAL FIX: Remove external server URL - use bundled assets in development too
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '11083941790-vgbdbj6j313ggo6jbt9agp3bvrlilam8.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#8b5cf6",
      showSpinner: true,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#FFFFFF",
      splashFullScreen: true,
      splashImmersive: true,
      splashScreenDelay: 2000
    },
    Keyboard: {
      resize: "body",
      style: "default",
      resizeOnFullScreen: true
    },
    StatusBar: {
      style: "dark",
      backgroundColor: "#000000"
    },
    App: {
      // FIXED: No external URLs - handle deep links properly
      urlScheme: "app.soulo.online"
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#8b5cf6",
      sound: "beep.wav"
    }
  },
  ios: {
    contentInset: "always",
    allowsLinkPreview: false,
    scrollEnabled: true,
    backgroundColor: "#FFFFFF",
    scheme: "Soulo",
    preferredContentMode: "mobile"
  },
  android: {
    allowMixedContent: false, // FIXED: No mixed content in dev
    captureInput: true,
    webContentsDebuggingEnabled: true, // Keep debugging for dev
    backgroundColor: "#FFFFFF",
    launchMode: "singleTask",
    orientation: "portrait",
    useLegacyBridge: false,
    appendUserAgent: "SouloApp",
    overrideUserAgent: "SouloApp/1.0.0 Mobile",
    androidScheme: "https",
    loadOnMainThread: true,
    handlePermissions: true
  }
};

export default config;
