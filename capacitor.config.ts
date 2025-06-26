
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.soulo.online',
  appName: 'Soulo',
  webDir: 'dist',
  // Remove server configuration for production - use bundled assets
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#000000",
      showSpinner: true,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small", 
      spinnerColor: "#8b5cf6",
      splashFullScreen: true,
      splashImmersive: true,
      splashScreenDelay: 3000
    },
    Keyboard: {
      resize: "body",
      style: "dark",
      resizeOnFullScreen: true
    },
    StatusBar: {
      style: "dark",
      backgroundColor: "#000000"
    },
    App: {
      // Deep link handling for OAuth redirects
      launchUrl: "soulo://auth"
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
    backgroundColor: "#000000",
    scheme: "soulo",
    preferredContentMode: "mobile"
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: "#000000",
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
