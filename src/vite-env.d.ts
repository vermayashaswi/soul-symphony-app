
/// <reference types="vite/client" />

interface Window {
  scrollY: number;
  scrollTo: (options: { top: number }) => void;
  ReactNativeWebView?: any;
  webkit?: {
    messageHandlers?: any;
  };
}

// Global gtag function for Google Analytics
declare function gtag(command: string, targetId: string, config?: any): void;

// Ensure vite is properly typed
declare module 'vite' {
  export interface UserConfig {
    // Add any custom properties if needed
  }
}
