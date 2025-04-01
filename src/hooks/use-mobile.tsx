import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(true);
  const [isInitialized, setIsInitialized] = React.useState<boolean>(false);

  React.useEffect(() => {
    setIsMobile(true);
    setIsInitialized(true);
    
    console.log("Mobile detection initialized: always true (mobile-only app)");
    
    const checkIfMobile = () => {
      return true;
    };
    
    const handleResize = () => {
      if (!isMobile) {
        console.log("Mobile state changed to true (enforced)");
        setIsMobile(true);
      }
    };
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handleMqlChange = () => {
      setIsMobile(true);
    };
    
    try {
      mql.addEventListener('change', handleMqlChange);
    } catch (err) {
      mql.addListener && mql.addListener(handleMqlChange);
    }
    
    setTimeout(() => {
      if (!isMobile) {
        console.log("Delayed mobile check enforced to true");
        setIsMobile(true);
      }
    }, 500);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      
      try {
        mql.removeEventListener('change', handleMqlChange);
      } catch (err) {
        mql.removeListener && mql.removeListener(handleMqlChange);
      }
    };
  }, [isMobile]);

  React.useEffect(() => {
    window.toggleMobileView = () => {
      window.__forceMobileView = true;
      console.log("Mobile view manually toggled: true (enforced)");
      setIsMobile(true);
    };
    
    window.__forceMobileView = true;
    
    return () => {
      delete window.toggleMobileView;
    };
  }, []);

  return isInitialized ? true : true;
}

export const useMobile = useIsMobile;

declare global {
  interface Window {
    __forceMobileView?: boolean;
    toggleMobileView?: () => void;
  }
}
