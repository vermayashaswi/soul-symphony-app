
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
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    const detectSafeArea = () => {
      const isNativeApp = nativeIntegrationService.isRunningNatively();
      const isAndroidDevice = /Android/.test(navigator.userAgent);
      
      setIsNative(isNativeApp);
      setIsAndroid(isAndroidDevice);
      
      console.log('[useSafeArea] ANDROID FIX: Detection results:', {
        isNativeApp,
        isAndroidDevice,
        userAgent: navigator.userAgent
      });
      
      if (isNativeApp) {
        // For native apps, try to get actual safe area values
        const computedStyle = getComputedStyle(document.documentElement);
        let top = parseInt(computedStyle.getPropertyValue('--safe-area-inset-top').replace('px', '')) || 0;
        let bottom = parseInt(computedStyle.getPropertyValue('--safe-area-inset-bottom').replace('px', '')) || 0;
        let left = parseInt(computedStyle.getPropertyValue('--safe-area-inset-left').replace('px', '')) || 0;
        let right = parseInt(computedStyle.getPropertyValue('--safe-area-inset-right').replace('px', '')) || 0;
        
        // ANDROID FIX: Force minimum bottom inset for Android native apps
        if (isAndroidDevice) {
          console.log('[useSafeArea] ANDROID FIX: Original bottom inset:', bottom);
          
          // Try to get actual safe area from env() function
          const testDiv = document.createElement('div');
          testDiv.style.position = 'fixed';
          testDiv.style.bottom = 'env(safe-area-inset-bottom, 0px)';
          testDiv.style.visibility = 'hidden';
          document.body.appendChild(testDiv);
          
          const envBottom = parseInt(getComputedStyle(testDiv).bottom) || 0;
          document.body.removeChild(testDiv);
          
          console.log('[useSafeArea] ANDROID FIX: Env bottom inset:', envBottom);
          
          // Use the maximum of detected values or force minimum
          bottom = Math.max(bottom, envBottom, 8); // Minimum 8px for Android
          
          console.log('[useSafeArea] ANDROID FIX: Final bottom inset:', bottom);
        }
        
        setSafeArea({ top, bottom, left, right });
        
        console.log('[useSafeArea] ANDROID FIX: Native safe area detected:', { top, bottom, left, right });
      } else {
        // For web, use platform detection for status bar estimation
        const userAgent = navigator.userAgent;
        let statusBarHeight = 0;
        let bottomInset = 0;
        
        if (isAndroidDevice) {
          statusBarHeight = 24;
          // ANDROID FIX: Add bottom inset for Android web view
          bottomInset = 8;
          document.documentElement.classList.add('platform-android');
          document.documentElement.classList.remove('platform-ios');
        } else if (/iPhone|iPad|iPod/.test(userAgent)) {
          statusBarHeight = 44;
          document.documentElement.classList.add('platform-ios');
          document.documentElement.classList.remove('platform-android');
        }
        
        setSafeArea({
          top: statusBarHeight,
          bottom: bottomInset,
          left: 0,
          right: 0,
        });
        
        console.log('[useSafeArea] ANDROID FIX: Web platform safe area estimated:', { 
          top: statusBarHeight, 
          bottom: bottomInset, 
          left: 0, 
          right: 0 
        });
      }
    };

    detectSafeArea();
    
    // Re-detect on orientation change with debounce
    let orientationTimeout: NodeJS.Timeout;
    const handleOrientationChange = () => {
      clearTimeout(orientationTimeout);
      orientationTimeout = setTimeout(() => {
        console.log('[useSafeArea] ANDROID FIX: Orientation change detected, re-detecting safe area');
        detectSafeArea();
      }, 200);
    };
    
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);
    
    // ANDROID FIX: Also listen for viewport changes
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleOrientationChange);
    }
    
    return () => {
      clearTimeout(orientationTimeout);
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleOrientationChange);
      }
    };
  }, []);

  return {
    safeArea,
    isNative,
    isAndroid,
    applySafeAreaStyles: (element: HTMLElement) => {
      if (element) {
        element.style.setProperty('--safe-area-inset-top', `${safeArea.top}px`);
        element.style.setProperty('--safe-area-inset-bottom', `${safeArea.bottom}px`);
        element.style.setProperty('--safe-area-inset-left', `${safeArea.left}px`);
        element.style.setProperty('--safe-area-inset-right', `${safeArea.right}px`);
        
        // ANDROID FIX: Add debug attributes
        if (isAndroid) {
          element.setAttribute('data-safe-area-bottom', `${safeArea.bottom}`);
          element.setAttribute('data-is-android', 'true');
        }
        
        console.log('[useSafeArea] ANDROID FIX: Applied safe area styles:', safeArea);
      }
    }
  };
};
