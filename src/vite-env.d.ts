
/// <reference types="vite/client" />

interface Window {
  scrollY: number;
  scrollTo: (options: { top: number }) => void;
}

// Ensure vite is properly typed
declare module 'vite' {
  export interface UserConfig {
    // Add any custom properties if needed
  }
}
