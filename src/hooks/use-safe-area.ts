
import { useEffect, useState } from 'react';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

export interface SafeAreaInsets {
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
    right: 0,
  });
  
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    const detectSafeArea = () => {
      const isNativeApp = nativeIntegrationService.isRunningNatively();
      setIsNative(isNativeApp);
      
      if (isNativeApp) {
        // For native apps, try to get actual safe area values
        const computedStyle = getComputedStyle(document.documentElement);
        const top = parseInt(computedStyle.getPropertyValue('--safe-area-inset-top').replace('px', '')) || 0;
        const bottom = parseInt(computedStyle.getPropertyValue('--safe-area-inset-bottom').replace('px', '')) || 0;
        const left = parseInt(computedStyle.getPropertyValue('--safe-area-inset-left').replace('px', '')) || 0;
        const right = parseInt(computedStyle.getPropertyValue('--safe-area-inset-right').replace('px', '')) || 0;
        
        setSafeArea({ top, bottom, left, right });
        
        console.log('[useSafeArea] Native safe area detected:', { top, bottom, left, right });
      } else {
        // For web, use platform detection for status bar estimation
        const userAgent = navigator.userAgent;
        let statusBarHeight = 0;
        
        if (/Android/.test(userAgent)) {
          statusBarHeight = 24;
          document.documentElement.classList.add('platform-android');
        } else if (/iPhone|iPad|iPod/.test(userAgent)) {
          statusBarHeight = 44;
          document.documentElement.classList.add('platform-ios');
        }
        
        setSafeArea({
          top: statusBarHeight,
          bottom: 0,
          left: 0,
          right: 0,
        });
        
        console.log('[useSafeArea] Web platform safe area estimated:', { top: statusBarHeight, bottom: 0, left: 0, right: 0 });
      }
    };

    detectSafeArea();
    
    // Re-detect on orientation change
    const handleOrientationChange = () => {
      setTimeout(detectSafeArea, 100);
    };
    
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);
    
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, []);

  return {
    safeArea,
    isNative,
    applySafeAreaStyles: (element: HTMLElement) => {
      if (element) {
        element.style.setProperty('--safe-area-inset-top', `${safeArea.top}px`);
        element.style.setProperty('--safe-area-inset-bottom', `${safeArea.bottom}px`);
        element.style.setProperty('--safe-area-inset-left', `${safeArea.left}px`);
        element.style.setProperty('--safe-area-inset-right', `${safeArea.right}px`);
      }
    }
  };
};
