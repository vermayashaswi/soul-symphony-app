
/// <reference types="vite/client" />

interface Window {
  scrollY: number;
  scrollTo: (options: { top: number }) => void;
  Capacitor?: {
    Plugins: {
      Keyboard: {
        addListener: (event: string, callback: (data: any) => void) => void;
        removeAllListeners: () => void;
      };
    };
  };
}

// Ensure vite is properly typed
declare module 'vite' {
  export interface UserConfig {
    // Add any custom properties if needed
  }
}
