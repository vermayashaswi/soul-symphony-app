
import * as React from "react"

const MOBILE_BREAKPOINT = 768

interface MobileDetectionResult {
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
}

export function useIsMobile(): MobileDetectionResult {
  const [isMobile, setIsMobile] = React.useState<boolean>(false);
  const [isInitialized, setIsInitialized] = React.useState<boolean>(false);
  const [isIOS, setIsIOS] = React.useState<boolean>(false); 
  const [isAndroid, setIsAndroid] = React.useState<boolean>(false);

  React.useEffect(() => {
    // Function to check if mobile
    const checkIfMobile = () => {
      // Check URL parameter for demo mode
      const urlParams = new URLSearchParams(window.location.search);
      const mobileDemo = urlParams.get('mobileDemo') === 'true';
      
      if (mobileDemo) {
        return true;
      }
      
      // Check for __forceMobileView override for debugging
      if (typeof window.__forceMobileView !== 'undefined') {
        return window.__forceMobileView;
      }
      
      // Use multiple signals to determine if we're on mobile
      const viewportWidth = window.innerWidth < MOBILE_BREAKPOINT;
      const userAgentMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const touchCapable = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      // For most cases, viewport width is sufficient
      // But combine with user agent for edge cases
      return viewportWidth || (userAgentMobile && touchCapable);
    };
    
    // Function to check iOS
    const checkIfIOS = () => {
      return /iPhone|iPad|iPod/i.test(navigator.userAgent) || 
             (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    };
    
    // Function to check Android
    const checkIfAndroid = () => {
      return /Android/i.test(navigator.userAgent);
    };

    // Set initial state immediately
    const initialIsMobile = checkIfMobile();
    const initialIsIOS = checkIfIOS();
    const initialIsAndroid = checkIfAndroid();
    
    setIsMobile(initialIsMobile);
    setIsIOS(initialIsIOS);
    setIsAndroid(initialIsAndroid);
    setIsInitialized(true);
    
    console.log("Mobile detection initialized:", {
      isMobile: initialIsMobile, 
      isIOS: initialIsIOS,
      isAndroid: initialIsAndroid,
      width: window.innerWidth, 
      userAgent: navigator.userAgent,
      touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0
    });
    
    // Create event listeners for resize and orientation change
    const handleResize = () => {
      const newIsMobile = checkIfMobile();
      if (newIsMobile !== isMobile) {
        console.log("Mobile state changed:", newIsMobile, "width:", window.innerWidth);
        setIsMobile(newIsMobile);
      }
    };
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    // Setup matchMedia query as well
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handleMqlChange = () => {
      setIsMobile(checkIfMobile());
    };
    
    try {
      // Modern browsers
      mql.addEventListener('change', handleMqlChange);
    } catch (err) {
      // For older browsers
      // @ts-ignore - Using deprecated API for compatibility
      mql.addListener && mql.addListener(handleMqlChange);
    }
    
    // Force a recheck after a short delay (helps with some mobile browsers)
    setTimeout(() => {
      const delayedCheck = checkIfMobile();
      if (delayedCheck !== isMobile) {
        console.log("Delayed mobile check different:", delayedCheck, "width:", window.innerWidth);
        setIsMobile(delayedCheck);
      }
    }, 500);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      
      try {
        mql.removeEventListener('change', handleMqlChange);
      } catch (err) {
        // @ts-ignore - Using deprecated API for compatibility
        mql.removeListener && mql.removeListener(handleMqlChange);
      }
    };
  }, [isMobile]);

  // Expose a debug trigger function for the global scope
  React.useEffect(() => {
    // Add debug helper to window
    window.toggleMobileView = () => {
      window.__forceMobileView = !window.__forceMobileView;
      console.log("Mobile view manually toggled:", window.__forceMobileView);
      setIsMobile(window.__forceMobileView);
    };
    
    return () => {
      // @ts-ignore
      delete window.toggleMobileView;
    };
  }, []);

  return {
    isMobile: isInitialized ? isMobile : false,
    isIOS: isInitialized ? isIOS : false,
    isAndroid: isInitialized ? isAndroid : false
  };
}

// Add an alias export so that Chat.tsx can import it as useMobile
export const useMobile = useIsMobile;

// Extend global interface for our debug helpers
declare global {
  interface Window {
    __forceMobileView?: boolean;
    toggleMobileView?: () => void;
  }
  
  // Add standalone property for iOS PWA detection
  interface Navigator {
    standalone?: boolean;
  }
}
