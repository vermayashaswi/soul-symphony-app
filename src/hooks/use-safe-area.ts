
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
      
      console.log('[useSafeArea] Detection results:', {
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
        
        // ANDROID FIX: Enhanced detection and fallback
        if (isAndroidDevice) {
          console.log('[useSafeArea] Original insets:', { top, bottom, left, right });
          
          // Try multiple detection methods
          const detectionMethods = [
            () => {
              // Method 1: CSS env() function
              const testDiv = document.createElement('div');
              testDiv.style.position = 'fixed';
              testDiv.style.bottom = 'env(safe-area-inset-bottom, 0px)';
              testDiv.style.visibility = 'hidden';
              testDiv.style.pointerEvents = 'none';
              document.body.appendChild(testDiv);
              
              const envBottom = parseInt(getComputedStyle(testDiv).bottom) || 0;
              document.body.removeChild(testDiv);
              
              return { envBottom };
            },
            () => {
              // Method 2: Visual viewport detection
              if (window.visualViewport) {
                const screenHeight = window.screen.height;
                const viewportHeight = window.visualViewport.height;
                const heightDiff = screenHeight - viewportHeight;
                
                // If there's a significant difference, part of it might be safe area
                return { vpBottom: heightDiff > 50 ? Math.min(heightDiff, 40) : 0 };
              }
              return { vpBottom: 0 };
            },
            () => {
              // Method 3: Window inner height comparison
              const screenHeight = window.screen.height;
              const windowHeight = window.innerHeight;
              const heightDiff = screenHeight - windowHeight;
              
              // Estimate safe area from height difference
              return { whBottom: heightDiff > 50 ? Math.min(heightDiff / 2, 30) : 0 };
            }
          ];
          
          const detectionResults = detectionMethods.map(method => {
            try {
              return method();
            } catch (error) {
              console.warn('[useSafeArea] Detection method failed:', error);
              return {};
            }
          });
          
          console.log('[useSafeArea] Detection results:', detectionResults);
          
          // Use the maximum detected value with reasonable limits
          const detectedBottom = Math.max(
            detectionResults[0]?.envBottom || 0,
            detectionResults[1]?.vpBottom || 0,
            detectionResults[2]?.whBottom || 0,
            8 // Minimum 8px for Android
          );
          
          bottom = Math.max(bottom, detectedBottom);
          
          // For Android, also ensure reasonable top margin for status bar
          if (top === 0) {
            // Try to detect status bar height
            const statusBarHeight = 24; // Standard Android status bar
            top = statusBarHeight;
          }
          
          console.log('[useSafeArea] Final Android insets:', { top, bottom, left, right });
        }
        
        setSafeArea({ top, bottom, left, right });
        
        console.log('[useSafeArea] Native safe area detected:', { top, bottom, left, right });
      } else {
        // For web, use platform detection for status bar estimation
        const userAgent = navigator.userAgent;
        let statusBarHeight = 0;
        let bottomInset = 0;
        
        if (isAndroidDevice) {
          statusBarHeight = 24;
          // Add bottom inset for Android web view
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
        
        console.log('[useSafeArea] Web platform safe area estimated:', { 
          top: statusBarHeight, 
          bottom: bottomInset, 
          left: 0, 
          right: 0 
        });
      }
    };

    detectSafeArea();
    
    // Re-detect on orientation change and viewport changes
    let debounceTimeout: NodeJS.Timeout;
    const handleViewportChange = () => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        console.log('[useSafeArea] Viewport change detected, re-detecting safe area');
        detectSafeArea();
      }, 150);
    };
    
    // Listen to multiple viewport change events
    window.addEventListener('orientationchange', handleViewportChange);
    window.addEventListener('resize', handleViewportChange);
    
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
    }
    
    // ANDROID FIX: Also listen for window focus events
    window.addEventListener('focus', handleViewportChange);
    
    return () => {
      clearTimeout(debounceTimeout);
      window.removeEventListener('orientationchange', handleViewportChange);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('focus', handleViewportChange);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
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
        
        // Add debug attributes for Android
        if (isAndroid) {
          element.setAttribute('data-safe-area-bottom', `${safeArea.bottom}`);
          element.setAttribute('data-is-android', 'true');
        }
        
        console.log('[useSafeArea] Applied safe area styles:', safeArea);
      }
    }
  };
};
