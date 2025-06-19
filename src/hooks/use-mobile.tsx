
import * as React from "react"

const MOBILE_BREAKPOINT = 768

// Extend Navigator interface for iOS-specific properties
interface IOSNavigator extends Navigator {
  standalone?: boolean;
}

// Extend Window interface for our debug helpers only
declare global {
  interface Window {
    __forceMobileView?: boolean;
    toggleMobileView?: () => void;
  }
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(false);
  const [isInitialized, setIsInitialized] = React.useState<boolean>(false);
  const [isIOS, setIsIOS] = React.useState<boolean>(false); 
  const [isAndroid, setIsAndroid] = React.useState<boolean>(false);
  const [isWebtonative, setIsWebtonative] = React.useState<boolean>(false);

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
    
    // Enhanced function to check if running in webtonative
    const checkIfWebtonative = () => {
      // Check for webtonative specific indicators
      const hasWebtonativeUA = /webtonative/i.test(navigator.userAgent);
      const hasWebView = /wv|WebView/i.test(navigator.userAgent);
      const hasWebApp = (navigator as IOSNavigator).standalone === true;
      
      // Enhanced webview detection
      const isWebView = hasWebtonativeUA || hasWebView || hasWebApp;
      
      // Check for common mobile webview characteristics
      const hasMobileWebViewSignals = (
        window.orientation !== undefined ||
        /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      ) && (
        // Check for webview-specific properties
        !window.chrome || // Chrome desktop has window.chrome
        hasWebView ||
        window.navigator.userAgent.includes('wv') ||
        // Check for missing browser features that indicate webview
        !window.external ||
        !window.sidebar
      );
      
      // Additional checks for webtonative environment
      const isLikelyWebtonative = (isWebView || hasMobileWebViewSignals) && 
                                  (checkIfAndroid() || checkIfIOS());
      
      console.log('[Mobile] Enhanced webtonative detection:', {
        hasWebtonativeUA,
        hasWebView,
        hasWebApp,
        hasMobileWebViewSignals,
        isWebView,
        isLikelyWebtonative,
        hasChrome: !!window.chrome,
        hasExternal: !!window.external,
        userAgent: navigator.userAgent,
        orientation: window.orientation,
        visualViewport: !!window.visualViewport
      });
      
      return isLikelyWebtonative;
    };

    // Set initial state immediately
    const initialIsMobile = checkIfMobile();
    const initialIsIOS = checkIfIOS();
    const initialIsAndroid = checkIfAndroid();
    const initialIsWebtonative = checkIfWebtonative();
    
    setIsMobile(initialIsMobile);
    setIsIOS(initialIsIOS);
    setIsAndroid(initialIsAndroid);
    setIsWebtonative(initialIsWebtonative);
    setIsInitialized(true);
    
    console.log("Enhanced mobile detection initialized:", {
      isMobile: initialIsMobile, 
      isIOS: initialIsIOS,
      isAndroid: initialIsAndroid,
      isWebtonative: initialIsWebtonative,
      width: window.innerWidth, 
      userAgent: navigator.userAgent,
      touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      visualViewport: !!window.visualViewport
    });
    
    // Create event listeners for resize and orientation change
    const handleResize = () => {
      const newIsMobile = checkIfMobile();
      if (newIsMobile !== isMobile) {
        console.log("Mobile state changed:", newIsMobile, "width:", window.innerWidth);
        setIsMobile(newIsMobile);
      }
    };
    
    // Special handling for iOS orientation changes
    const handleOrientationChange = () => {
      console.log("Orientation change detected");
      // On iOS and webtonative, we need a small delay
      if (initialIsIOS || initialIsWebtonative) {
        setTimeout(() => {
          handleResize();
          // Re-check webtonative status after orientation change
          const newWebtonativeStatus = checkIfWebtonative();
          if (newWebtonativeStatus !== initialIsWebtonative) {
            setIsWebtonative(newWebtonativeStatus);
          }
        }, 300);
      } else {
        handleResize();
      }
    };
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);
    
    // Set appropriate body classes for device-specific CSS
    if (initialIsIOS) {
      document.body.classList.add('ios-device');
    }
    if (initialIsAndroid) {
      document.body.classList.add('android-device');
    }
    if (initialIsWebtonative) {
      document.body.classList.add('webtonative-app');
      document.documentElement.classList.add('webtonative-env');
      
      // Set initial viewport properties for webtonative
      const setViewportProperties = () => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
        document.documentElement.style.setProperty('--real-vh', `${window.innerHeight}px`);
        
        if (window.visualViewport) {
          const visualVh = window.visualViewport.height * 0.01;
          document.documentElement.style.setProperty('--visual-vh', `${visualVh}px`);
          document.documentElement.style.setProperty('--available-height', `${window.visualViewport.height}px`);
        }
      };
      
      setViewportProperties();
    }
    
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
      window.removeEventListener('orientationchange', handleOrientationChange);
      
      try {
        mql.removeEventListener('change', handleMqlChange);
      } catch (err) {
        // @ts-ignore - Using deprecated API for compatibility
        mql.removeListener && mql.removeListener(handleMqlChange);
      }
      
      if (initialIsIOS) {
        document.body.classList.remove('ios-device');
      }
      if (initialIsAndroid) {
        document.body.classList.remove('android-device');
      }
      if (initialIsWebtonative) {
        document.body.classList.remove('webtonative-app');
        document.documentElement.classList.remove('webtonative-env');
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

  // Make this function backward compatible by allowing it to be used as a boolean directly
  const result = {
    isMobile: isInitialized ? isMobile : false,
    isIOS: isInitialized ? isIOS : false,
    isAndroid: isInitialized ? isAndroid : false,
    isWebtonative: isInitialized ? isWebtonative : false
  } as const;
  
  // Add a valueOf method to make the object behave like a boolean
  Object.defineProperty(result, 'valueOf', {
    value: function() { return this.isMobile; }
  });
  
  // Add toString method for string coercion
  Object.defineProperty(result, 'toString', {
    value: function() { return String(this.isMobile); }
  });

  return result;
}

// Add an alias export so that Chat.tsx can import it as useMobile
export const useMobile = useIsMobile;
