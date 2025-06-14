import * as React from "react"
import { getDeviceType } from "./use-device-type";

// Set MOBILE_BREAKPOINT as before
const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Use deviceType from the shared hook
  const [isMobile, setIsMobile] = React.useState<boolean>(false);
  const [isInitialized, setIsInitialized] = React.useState<boolean>(false);
  const [isIOS, setIsIOS] = React.useState<boolean>(false); 
  const [isAndroid, setIsAndroid] = React.useState<boolean>(false);
  const [deviceType, setDeviceType] = React.useState(getDeviceType());

  React.useEffect(() => {
    const checkDevice = () => {
      const type = getDeviceType();
      setDeviceType(type);

      // Compatibility: mobile is 'mobile', NOT 'tablet'
      setIsMobile(type === "mobile");
      setIsIOS(/iPhone|iPad|iPod/i.test(navigator.userAgent) || 
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
      setIsAndroid(/Android/i.test(navigator.userAgent));
      setIsInitialized(true);

      if (process.env.NODE_ENV !== "production") {
        console.log("[useIsMobile] Detected device:", {
          type, ua: navigator.userAgent, width: window.innerWidth,
        });
      }
    };
    checkDevice();

    const handleResize = () => {
      checkDevice();
    };
    
    // Special handling for iOS orientation changes
    const handleOrientationChange = () => {
      console.log("Orientation change detected");
      // On iOS, we need a small delay
      if (isIOS) {
        setTimeout(() => {
          handleResize();
        }, 100);
      } else {
        handleResize();
      }
    };

    window.addEventListener('resize', checkDevice);
    window.addEventListener('orientationchange', checkDevice);

    return () => {
      window.removeEventListener('resize', checkDevice);
      window.removeEventListener('orientationchange', checkDevice);
    };
  }, []);

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

  // Only the return object changes: add deviceType
  const result = {
    isMobile: isInitialized ? isMobile : false,
    isIOS: isInitialized ? isIOS : false,
    isAndroid: isInitialized ? isAndroid : false,
    deviceType: isInitialized ? deviceType : "desktop",
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

// Extend global interface for our debug helpers
declare global {
  interface Window {
    __forceMobileView?: boolean;
    toggleMobileView?: () => void;
  }
}
