import * as React from "react"

/**
 * A hook that detects if the current device is mobile based on screen size
 * or when mobile preview is explicitly enabled
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);
  
  React.useEffect(() => {
    // Check URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const mobileDemo = urlParams.get('mobileDemo') === 'true';
    
    if (mobileDemo) {
      // If explicitly requested via URL, use mobile view
      setIsMobile(true);
      return;
    }
    
    // Otherwise detect based on screen size
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Initial check
    checkMobile();
    
    // Listen for resize events
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  return isMobile;
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
