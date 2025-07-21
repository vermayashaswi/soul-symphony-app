
import { useState, useEffect } from 'react';

interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export const useSafeArea = () => {
  const [safeArea, setSafeArea] = useState<SafeAreaInsets>({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0
  });
  
  const [isNative, setIsNative] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const updateSafeArea = () => {
      // Check if we're in a native app context
      const isNativeApp = window.location.href.includes('capacitor://') || 
                         window.location.href.includes('ionic://') ||
                         (window as any).Capacitor?.isNative;
      
      setIsNative(isNativeApp);
      
      // Platform detection
      const userAgent = navigator.userAgent.toLowerCase();
      const androidDetected = userAgent.includes('android');
      const iOSDetected = /iphone|ipad|ipod/.test(userAgent);
      
      setIsAndroid(androidDetected);
      setIsIOS(iOSDetected);
      
      // Set platform classes on body
      document.body.classList.toggle('platform-android', androidDetected);
      document.body.classList.toggle('platform-ios', iOSDetected);
      document.body.classList.toggle('platform-native', isNativeApp);
      
      // Get safe area values
      const computedStyle = getComputedStyle(document.documentElement);
      const top = parseInt(computedStyle.getPropertyValue('--safe-area-inset-top').replace('px', '')) || 0;
      const bottom = parseInt(computedStyle.getPropertyValue('--safe-area-inset-bottom').replace('px', '')) || 0;
      const left = parseInt(computedStyle.getPropertyValue('--safe-area-inset-left').replace('px', '')) || 0;
      const right = parseInt(computedStyle.getPropertyValue('--safe-area-inset-right').replace('px', '')) || 0;
      
      setSafeArea({ top, bottom, left, right });
      
      console.log('SafeArea updated:', { top, bottom, left, right, isNativeApp, androidDetected, iOSDetected });
    };

    updateSafeArea();
    
    // Listen for orientation changes and viewport changes
    window.addEventListener('resize', updateSafeArea);
    window.addEventListener('orientationchange', updateSafeArea);
    
    return () => {
      window.removeEventListener('resize', updateSafeArea);
      window.removeEventListener('orientationchange', updateSafeArea);
    };
  }, []);

  const applySafeAreaStyles = (element: HTMLElement) => {
    if (!element) return;
    
    element.style.setProperty('--calculated-safe-area-top', `${safeArea.top}px`);
    element.style.setProperty('--calculated-safe-area-bottom', `${safeArea.bottom}px`);
    element.style.setProperty('--calculated-safe-area-left', `${safeArea.left}px`);
    element.style.setProperty('--calculated-safe-area-right', `${safeArea.right}px`);
    
    // Debug attribute for Android
    if (isAndroid) {
      element.setAttribute('data-safe-area-bottom', `${safeArea.bottom}px`);
    }
  };

  return {
    safeArea,
    isNative,
    isAndroid,
    isIOS,
    applySafeAreaStyles
  };
};
