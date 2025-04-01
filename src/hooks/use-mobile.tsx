
import * as React from "react"

/**
 * Always returns true to ensure the app is always in mobile mode
 * regardless of the actual device being used.
 */
export function useIsMobile() {
  // Force mobile view for all devices
  return true;
}

// Export an alias for backward compatibility
export const useMobile = useIsMobile;

// These type definitions are still needed for compatibility
declare global {
  interface Window {
    __forceMobileView?: boolean;
    toggleMobileView?: () => void;
  }
}
