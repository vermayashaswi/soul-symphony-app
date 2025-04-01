
import * as React from "react"

export function useIsMobile() {
  // Since this is a mobile-only app, always return true
  return true;
}

export const useMobile = useIsMobile;

// These type definitions are still needed for compatibility
declare global {
  interface Window {
    __forceMobileView?: boolean;
    toggleMobileView?: () => void;
  }
}
