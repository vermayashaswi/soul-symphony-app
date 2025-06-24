
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.soulo.online',
  appName: 'Soulo',
  webDir: 'dist',
  server: {
    url: 'https://soulo.online/app?forceHideBadge=true',
    cleartext: true
  },
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
      splashScreenDelay: 2000
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
      launchUrl: "https://soulo.online/app"
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  },
  ios: {
    contentInset: "always",
    allowsLinkPreview: false,
    scrollEnabled: true,
    backgroundColor: "#000000",
    scheme: "Soulo",
    preferredContentMode: "mobile"
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: "#000000",
    launchMode: "singleTask",
    orientation: "portrait"
  }
};

export default config;
