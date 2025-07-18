
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.soulo.online',
  appName: 'Soulo',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '11083941790-vgbdbj6j313ggo6jbt9agp3bvrlilam8.apps.googleusercontent.com',
      clientId: '11083941790-oi1vrl8bmsjajc0h1ka4f9q0qjmm80o9.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
    App: {
      urlScheme: "app.soulo.online"
    },
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#8b5cf6",
      showSpinner: true,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#FFFFFF",
      splashFullScreen: false,
      splashImmersive: false,
      splashScreenDelay: 2000
    },
    Keyboard: {
      resize: "ionic",
      style: "dark",
      resizeOnFullScreen: true
    },
    StatusBar: {
      style: "light",
      backgroundColor: "#8b5cf6",
      overlaysWebView: false
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
    contentInset: "automatic",
    allowsLinkPreview: false,
    scrollEnabled: true,
    backgroundColor: "#8b5cf6",
    scheme: "Soulo",
    preferredContentMode: "mobile"
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: "#8b5cf6",
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
