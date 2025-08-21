
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'online.soulo.twa',
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
      urlScheme: "online.soulo.twa"
    },
    RevenueCat: {
      apiKey: "YOUR_REVENUECAT_API_KEY" // Replace with your actual RevenueCat API key
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
      resize: "ionic",
      style: "light",
      resizeOnFullScreen: true
    },
    StatusBar: {
      style: "dark",
      backgroundColor: "#000000",
      overlaysWebView: true
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#8b5cf6",
      sound: "beep.wav",
      requestPermissionsOnLoad: true,
      attachments: [],
      enableAndroidExtraLargeIcon: true,
      androidAllowWhileIdle: true,
      androidExact: true
    }
  },
  ios: {
    contentInset: "never",
    allowsLinkPreview: false,
    scrollEnabled: true,
    backgroundColor: "#FFFFFF",
    scheme: "Soulo",
    preferredContentMode: "mobile",
    handleApplicationURL: true
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: "#FFFFFF",
    launchMode: "singleTask",
    orientation: "portrait",
    useLegacyBridge: false,
    appendUserAgent: "SouloApp",
    overrideUserAgent: "SouloApp/1.0.0 Mobile",
    androidScheme: "https",
    loadOnMainThread: true,
    handlePermissions: true,
    allowNavigationBarColorChange: true,
    navigationBarColor: "#FFFFFF"
  }
};

export default config;
