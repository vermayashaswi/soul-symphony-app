import React, { useEffect, useCallback, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import { statusBarAutoHideService } from '../services/statusBarAutoHideService';

interface StatusBarManagerProps {
  children: React.ReactNode;
}

const StatusBarManager: React.FC<StatusBarManagerProps> = ({ children }) => {
  const [isStatusBarVisible, setIsStatusBarVisible] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const updateStatusBarState = useCallback((visible: boolean) => {
    setIsStatusBarVisible(visible);
    
    // Update CSS classes for styling adjustments
    if (visible) {
      document.body.classList.add('status-bar-visible');
    } else {
      document.body.classList.remove('status-bar-visible');
    }
  }, []);

  const handleKeyboardStateChange = useCallback((visible: boolean) => {
    setIsKeyboardVisible(visible);
    
    // Update CSS classes for keyboard adjustments
    if (visible) {
      document.body.classList.add('keyboard-visible');
      // Pause auto-hide when keyboard is open
      statusBarAutoHideService.pauseAutoHide();
    } else {
      document.body.classList.remove('keyboard-visible');
      // Resume auto-hide when keyboard closes
      statusBarAutoHideService.resumeAutoHide();
    }
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      console.log('[StatusBarManager] Not running natively, skipping status bar configuration');
      return;
    }

    let isInitialized = false;

    const initializeStatusBar = async () => {
      if (isInitialized) return;
      
      try {
        console.log('[StatusBarManager] Initializing fullscreen status bar configuration...');

        // Configure for fullscreen immersive experience
        await StatusBar.hide();
        await StatusBar.setOverlaysWebView({ overlay: true });
        await StatusBar.setStyle({ style: 'Dark' as any });
        await StatusBar.setBackgroundColor({ color: '#000000' });
        
        // Initialize auto-hide service
        await statusBarAutoHideService.enable();
        
        console.log('[StatusBarManager] Fullscreen status bar configured successfully');
        isInitialized = true;
        
      } catch (error) {
        console.error('[StatusBarManager] Failed to configure status bar:', error);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[StatusBarManager] App became visible, re-applying status bar config');
        setTimeout(() => {
          initializeStatusBar();
          updateSafeAreaVariables();
        }, 100);
      }
    };

    const handleAppStateChange = (state: any) => {
      if (state.isActive) {
        console.log('[StatusBarManager] App resumed, re-applying status bar config');
        setTimeout(() => {
          initializeStatusBar();
          updateSafeAreaVariables();
        }, 100);
      }
    };

    const updateSafeAreaVariables = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isAndroid = userAgent.includes('android');
      const isIOS = /iphone|ipad|ipod/.test(userAgent);
      
      // Apply platform-specific classes
      document.body.classList.toggle('platform-android', isAndroid);
      document.body.classList.toggle('platform-ios', isIOS);
      document.body.classList.add('platform-native');
      
      // Get safe area values from CSS environment variables
      const computedStyle = window.getComputedStyle(document.documentElement);
      
      const safeAreaTop = computedStyle.getPropertyValue('--safe-area-inset-top') || '0px';
      const safeAreaBottom = computedStyle.getPropertyValue('--safe-area-inset-bottom') || '0px';
      const safeAreaLeft = computedStyle.getPropertyValue('--safe-area-inset-left') || '0px';
      const safeAreaRight = computedStyle.getPropertyValue('--safe-area-inset-right') || '0px';
      
      console.log('[StatusBarManager] Safe area insets:', {
        top: safeAreaTop,
        bottom: safeAreaBottom,
        left: safeAreaLeft,
        right: safeAreaRight,
        statusBarVisible: isStatusBarVisible,
        keyboardVisible: isKeyboardVisible
      });

      // Calculate fullscreen safe areas
      if (isAndroid) {
        // Android fullscreen configuration
        const cutoutSafeArea = 32; // Account for camera cutouts
        const topSafeArea = Math.max(
          parseInt(safeAreaTop.replace('px', '')) || 0,
          cutoutSafeArea
        );
        
        const bottomSafeArea = Math.max(
          parseInt(safeAreaBottom.replace('px', '')) || 0,
          8 // Minimum for gesture navigation
        );
        
        document.documentElement.style.setProperty('--fullscreen-content-top', `${topSafeArea}px`);
        document.documentElement.style.setProperty('--fullscreen-content-bottom', `${bottomSafeArea}px`);
        document.documentElement.style.setProperty('--cutout-safe-area', `${cutoutSafeArea}px`);
        
      } else if (isIOS) {
        // iOS fullscreen configuration  
        const cutoutSafeArea = 44; // Account for notch/dynamic island
        const topSafeArea = Math.max(
          parseInt(safeAreaTop.replace('px', '')) || 0,
          cutoutSafeArea
        );
        
        document.documentElement.style.setProperty('--fullscreen-content-top', `${topSafeArea}px`);
        document.documentElement.style.setProperty('--fullscreen-content-bottom', safeAreaBottom);
        document.documentElement.style.setProperty('--cutout-safe-area', `${cutoutSafeArea}px`);
      }
      
      // Set base safe area variables
      document.documentElement.style.setProperty('--calculated-safe-area-top', safeAreaTop);
      document.documentElement.style.setProperty('--calculated-safe-area-bottom', safeAreaBottom);
      document.documentElement.style.setProperty('--calculated-safe-area-left', safeAreaLeft);
      document.documentElement.style.setProperty('--calculated-safe-area-right', safeAreaRight);
    };

    // Set up keyboard listeners
    const setupKeyboardListeners = async () => {
      try {
        const keyboardShowListener = await Keyboard.addListener('keyboardDidShow', (info) => {
          console.log('[StatusBarManager] Keyboard shown:', info);
          handleKeyboardStateChange(true);
          updateSafeAreaVariables();
        });
        
        const keyboardHideListener = await Keyboard.addListener('keyboardDidHide', () => {
          console.log('[StatusBarManager] Keyboard hidden');
          handleKeyboardStateChange(false);
          updateSafeAreaVariables();
        });
        
        return () => {
          keyboardShowListener.remove();
          keyboardHideListener.remove();
        };
      } catch (error) {
        console.error('[StatusBarManager] Failed to set up keyboard listeners:', error);
        return () => {};
      }
    };

    // Initialize on mount
    initializeStatusBar();
    updateSafeAreaVariables();

    // Set up event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', initializeStatusBar);
    
    const handleOrientationChange = () => {
      setTimeout(() => {
        initializeStatusBar();
        updateSafeAreaVariables();
      }, 300);
    };
    
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', updateSafeAreaVariables);
    
    // Listen for visual viewport changes
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateSafeAreaVariables);
    }

    // Set up Capacitor listeners
    let appStateListener: any = null;
    let keyboardCleanup: (() => void) | null = null;

    const setupCapacitorListeners = async () => {
      try {
        const { App } = await import('@capacitor/app');
        appStateListener = await App.addListener('appStateChange', handleAppStateChange);
        keyboardCleanup = await setupKeyboardListeners();
      } catch (error) {
        console.error('[StatusBarManager] Failed to set up Capacitor listeners:', error);
      }
    };

    setupCapacitorListeners();

    // Cleanup function
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', initializeStatusBar);
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', updateSafeAreaVariables);
      
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateSafeAreaVariables);
      }

      // Remove Capacitor listeners
      if (appStateListener) {
        appStateListener.remove();
      }
      if (keyboardCleanup) {
        keyboardCleanup();
      }
      
      // Clean up auto-hide service
      statusBarAutoHideService.destroy();
    };
  }, [updateStatusBarState, handleKeyboardStateChange]);

  return <>{children}</>;
};

export default StatusBarManager;