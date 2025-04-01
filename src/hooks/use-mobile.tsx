
import * as React from "react"

export function useIsMobile() {
  // Always return true to force mobile view everywhere
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
