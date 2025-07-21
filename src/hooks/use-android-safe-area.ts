
import { useEffect, useState, useCallback } from 'react';

export interface AndroidSafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export const useAndroidSafeArea = () => {
  const [safeArea, setSafeArea] = useState<AndroidSafeAreaInsets>({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0
  });
  
  const [isAndroid, setIsAndroid] = useState(false);
  const [isNative, setIsNative] = useState(false);

  const detectAndroidSafeArea = useCallback(() => {
    const userAgent = navigator.userAgent;
    const isAndroidDevice = /Android/.test(userAgent);
    const isNativeApp = !!(window as any).Capacitor && 
      ((window as any).Capacitor.getPlatform() === 'android' || 
       (window as any).Capacitor.getPlatform() === 'ios');
    
    setIsAndroid(isAndroidDevice);
    setIsNative(isNativeApp);
    
    console.log('[useAndroidSafeArea] Detection:', {
      isAndroidDevice,
      isNativeApp,
      userAgent,
      platform: isNativeApp ? (window as any).Capacitor.getPlatform() : 'web'
    });
    
    let top = 0;
    let bottom = 0;
    let left = 0;
    let right = 0;
    
    if (isNativeApp && isAndroidDevice) {
      // For native Android apps, try to get actual window insets
      try {
        const statusBarPlugin = (window as any).Capacitor?.Plugins?.StatusBar;
        if (statusBarPlugin) {
          // Try to get status bar height
          statusBarPlugin.getInfo?.().then((info: any) => {
            if (info && info.height) {
              top = info.height;
              console.log('[useAndroidSafeArea] Status bar height from plugin:', top);
            }
          }).catch(() => {
            // Fallback to default Android status bar height
            top = 24;
          });
        } else {
          top = 24; // Default Android status bar height
        }
        
        // For Android navigation bar, check if we have system UI insets
        const windowInsets = (window as any).AndroidWindowInsets;
        if (windowInsets) {
          bottom = windowInsets.navigationBarHeight || 48;
          console.log('[useAndroidSafeArea] Navigation bar height from insets:', bottom);
        } else {
          // Check for gesture navigation vs button navigation
          const hasGestureNav = window.innerHeight > (screen.height * 0.95);
          bottom = hasGestureNav ? 16 : 48; // Gesture nav has smaller bottom inset
          console.log('[useAndroidSafeArea] Estimated navigation bar height:', bottom);
        }
        
        // Check for display cutouts (notches)
        if ((window as any).screen?.orientation?.type?.includes('landscape')) {
          left = Math.max(left, 16);
          right = Math.max(right, 16);
        }
        
      } catch (error) {
        console.warn('[useAndroidSafeArea] Error getting native insets:', error);
        // Fallback values
        top = 24;
        bottom = 48;
      }
    } else if (isAndroidDevice) {
      // For Android web apps, use viewport detection
      top = 24; // Standard Android status bar
      
      // Detect if running in fullscreen or standalone mode
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                          (window.navigator as any).standalone ||
                          document.referrer.includes('android-app://');
      
      if (isStandalone) {
        bottom = 16; // Reduced bottom for standalone web apps
      } else {
        bottom = 8; // Minimal bottom for regular web
      }
    }
    
    setSafeArea({ top, bottom, left, right });
    
    console.log('[useAndroidSafeArea] Final safe area:', { top, bottom, left, right });
    
    return { top, bottom, left, right };
  }, []);

  const applySafeAreaCSS = useCallback((insets: AndroidSafeAreaInsets) => {
    const root = document.documentElement;
    
    // Set CSS custom properties
    root.style.setProperty('--android-safe-area-top', `${insets.top}px`);
    root.style.setProperty('--android-safe-area-bottom', `${insets.bottom}px`);
    root.style.setProperty('--android-safe-area-left', `${insets.left}px`);
    root.style.setProperty('--android-safe-area-right', `${insets.right}px`);
    
    // Override existing safe area variables for Android
    if (isAndroid) {
      root.style.setProperty('--safe-area-inset-top', `${insets.top}px`);
      root.style.setProperty('--safe-area-inset-bottom', `${insets.bottom}px`);
      root.style.setProperty('--safe-area-inset-left', `${insets.left}px`);
      root.style.setProperty('--safe-area-inset-right', `${insets.right}px`);
      
      // Add platform class
      root.classList.add('platform-android');
      root.classList.remove('platform-ios');
    }
    
    console.log('[useAndroidSafeArea] Applied CSS variables:', insets);
  }, [isAndroid]);

  useEffect(() => {
    const insets = detectAndroidSafeArea();
    applySafeAreaCSS(insets);
    
    // Listen for orientation changes
    const handleOrientationChange = () => {
      setTimeout(() => {
        const newInsets = detectAndroidSafeArea();
        applySafeAreaCSS(newInsets);
      }, 100);
    };
    
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);
    
    // Listen for visual viewport changes (keyboard)
    if (window.visualViewport) {
      const handleViewportChange = () => {
        const keyboardHeight = window.innerHeight - window.visualViewport!.height;
        if (keyboardHeight > 100) {
          // Keyboard is visible, adjust bottom inset
          const keyboardInsets = { ...safeArea, bottom: keyboardHeight };
          applySafeAreaCSS(keyboardInsets);
        } else {
          // Keyboard hidden, restore original insets
          applySafeAreaCSS(safeArea);
        }
      };
      
      window.visualViewport.addEventListener('resize', handleViewportChange);
      
      return () => {
        window.removeEventListener('orientationchange', handleOrientationChange);
        window.removeEventListener('resize', handleOrientationChange);
        window.visualViewport?.removeEventListener('resize', handleViewportChange);
      };
    }
    
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, [detectAndroidSafeArea, applySafeAreaCSS, safeArea]);

  return {
    safeArea,
    isAndroid,
    isNative,
    detectAndroidSafeArea,
    applySafeAreaCSS
  };
};
