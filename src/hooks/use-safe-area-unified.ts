
import { useEffect, useState, useCallback } from 'react';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export const useSafeAreaUnified = () => {
  const [safeArea, setSafeArea] = useState<SafeAreaInsets>({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  });
  
  const [isNative, setIsNative] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const detectSafeArea = useCallback(() => {
    const isNativeApp = nativeIntegrationService.isRunningNatively();
    const isAndroidDevice = /Android/.test(navigator.userAgent);
    
    setIsNative(isNativeApp);
    setIsAndroid(isAndroidDevice);
    
    console.log('[SafeAreaUnified] Detection:', { isNativeApp, isAndroidDevice });
    
    let insets: SafeAreaInsets = { top: 0, bottom: 0, left: 0, right: 0 };
    
    if (isNativeApp) {
      // Native app - try to get actual values
      const testElement = document.createElement('div');
      testElement.style.position = 'fixed';
      testElement.style.top = 'env(safe-area-inset-top, 0px)';
      testElement.style.bottom = 'env(safe-area-inset-bottom, 0px)';
      testElement.style.left = 'env(safe-area-inset-left, 0px)';
      testElement.style.right = 'env(safe-area-inset-right, 0px)';
      testElement.style.visibility = 'hidden';
      testElement.style.pointerEvents = 'none';
      
      document.body.appendChild(testElement);
      
      const computedStyles = getComputedStyle(testElement);
      const topValue = parseInt(computedStyles.top) || 0;
      const bottomValue = parseInt(computedStyles.bottom) || 0;
      const leftValue = parseInt(computedStyles.left) || 0;
      const rightValue = parseInt(computedStyles.right) || 0;
      
      document.body.removeChild(testElement);
      
      // Android WebView often reports 0 for bottom, so ensure minimum
      insets = {
        top: topValue,
        bottom: isAndroidDevice ? Math.max(bottomValue, 16) : bottomValue,
        left: leftValue,
        right: rightValue
      };
    } else {
      // Web fallback
      if (isAndroidDevice) {
        insets = { top: 24, bottom: 16, left: 0, right: 0 };
      } else if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
        insets = { top: 44, bottom: 34, left: 0, right: 0 };
      }
    }
    
    console.log('[SafeAreaUnified] Final insets:', insets);
    setSafeArea(insets);
    setIsInitialized(true);
    
    // Update CSS variables globally
    const root = document.documentElement;
    root.style.setProperty('--safe-area-inset-top', `${insets.top}px`);
    root.style.setProperty('--safe-area-inset-bottom', `${insets.bottom}px`);
    root.style.setProperty('--safe-area-inset-left', `${insets.left}px`);
    root.style.setProperty('--safe-area-inset-right', `${insets.right}px`);
    
    // Set platform classes
    if (isAndroidDevice) {
      root.classList.add('platform-android');
      root.classList.remove('platform-ios');
    } else if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
      root.classList.add('platform-ios');
      root.classList.remove('platform-android');
    }
  }, []);

  useEffect(() => {
    detectSafeArea();
    
    // Re-detect on orientation and resize changes
    const handleResize = () => {
      setTimeout(detectSafeArea, 200);
    };
    
    window.addEventListener('orientationchange', handleResize);
    window.addEventListener('resize', handleResize);
    
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    }
    
    return () => {
      window.removeEventListener('orientationchange', handleResize);
      window.removeEventListener('resize', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
    };
  }, [detectSafeArea]);

  return {
    safeArea,
    isNative,
    isAndroid,
    isInitialized,
    applySafeAreaStyles: (element: HTMLElement) => {
      if (element && isInitialized) {
        element.style.setProperty('--element-safe-area-top', `${safeArea.top}px`);
        element.style.setProperty('--element-safe-area-bottom', `${safeArea.bottom}px`);
        element.style.setProperty('--element-safe-area-left', `${safeArea.left}px`);
        element.style.setProperty('--element-safe-area-right', `${safeArea.right}px`);
      }
    }
  };
};
