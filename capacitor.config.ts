
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.571d731eb54b453e9f48a2c79a572930',
  appName: 'soul-symphony-app',
  webDir: 'dist',
  server: {
    url: "https://571d731e-b54b-453e-9f48-a2c79a572930.lovableproject.com?forceHideBadge=true",
    cleartext: true,
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
      smallIcon: "ic_notification",
      iconColor: "#FFA500",
      sound: "default",
      requestPermissions: true,
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
    allowMixedContent: true, // Allow loading avatars from external sources
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
    navigationBarColor: "#FFFFFF",
    // WebSocket and network configuration for real-time features
    allowFileAccess: true,
    allowFileAccessFromFileURLs: true,
    allowUniversalAccessFromFileURLs: true,
    // Enhanced network security for WebSocket connections
    domStorageEnabled: true,
    javaScriptEnabled: true,
    // Custom WebView settings for better WebSocket support
    mixedContentMode: 'compatibility',
    // Allow WebSocket connections from all origins for Supabase realtime
    allowedNavigationHosts: [
      "kwnwhgucnzqxndzjayyq.supabase.co",
      "*.supabase.co",
      "realtime.supabase.co"
    ]
  }
};

export default config;
