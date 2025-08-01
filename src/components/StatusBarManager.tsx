
import React, { useEffect } from 'react';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

interface StatusBarManagerProps {
  children: React.ReactNode;
}

export const StatusBarManager: React.FC<StatusBarManagerProps> = ({ children }) => {
  useEffect(() => {
    const initializeStatusBar = async () => {
      try {
        const isNative = nativeIntegrationService.isRunningNatively();
        const isAndroid = /Android/.test(navigator.userAgent);
        
        console.log('[StatusBarManager] ANDROID FIX: Initializing with native:', isNative, 'android:', isAndroid);
        
        if (isNative) {
          console.log('[StatusBarManager] Configuring native status bar for immersive experience...');
          
          // Hide status bar for full-screen immersive experience
          await nativeIntegrationService.hideStatusBar();
          
          const statusBarPlugin = nativeIntegrationService.getPlugin('StatusBar');
          if (statusBarPlugin) {
            // Configure status bar to overlay web view for true full-screen
            await statusBarPlugin.setOverlaysWebView({ overlay: true });
            await statusBarPlugin.setStyle({ style: 'dark' });
            
            console.log('[StatusBarManager] Status bar hidden and configured for immersive experience');
          }
        } else {
          console.log('[StatusBarManager] ANDROID FIX: Web environment - status bar styling handled by CSS');
        }
        
        // Enhanced safe area detection and CSS variable setup
        updateSafeAreaVariables();
        
      } catch (error) {
        console.error('[StatusBarManager] ANDROID FIX: Failed to configure status bar:', error);
      }
    };

    // FIX: Re-hide status bar when app becomes visible/active
    const handleVisibilityChange = async () => {
      if (!document.hidden && nativeIntegrationService.isRunningNatively()) {
        console.log('[StatusBarManager] App became visible, re-hiding status bar');
        try {
          await nativeIntegrationService.hideStatusBar();
          const statusBarPlugin = nativeIntegrationService.getPlugin('StatusBar');
          if (statusBarPlugin) {
            await statusBarPlugin.setOverlaysWebView({ overlay: true });
          }
        } catch (error) {
          console.error('[StatusBarManager] Failed to re-hide status bar:', error);
        }
      }
    };

    const handleAppStateChange = async (event: any) => {
      console.log('[StatusBarManager] App state changed:', event);
      if (event?.isActive && nativeIntegrationService.isRunningNatively()) {
        console.log('[StatusBarManager] App resumed, re-hiding status bar');
        try {
          await nativeIntegrationService.hideStatusBar();
          const statusBarPlugin = nativeIntegrationService.getPlugin('StatusBar');
          if (statusBarPlugin) {
            await statusBarPlugin.setOverlaysWebView({ overlay: true });
          }
        } catch (error) {
          console.error('[StatusBarManager] Failed to re-hide status bar on resume:', error);
        }
      }
    };

    const updateSafeAreaVariables = () => {
      // Detect platform and set appropriate CSS variables
      const isAndroid = /Android/.test(navigator.userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                   (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      let statusBarHeight = '0px';
      let bottomInset = '0px';
      
      if (isAndroid) {
        statusBarHeight = '24px';
        // ANDROID FIX: Force bottom inset for Android
        bottomInset = '8px';
        document.documentElement.classList.add('platform-android');
        document.documentElement.classList.remove('platform-ios');
        
        console.log('[StatusBarManager] ANDROID FIX: Android platform detected, setting bottom inset to 8px');
      } else if (isIOS) {
        statusBarHeight = '44px';
        document.documentElement.classList.add('platform-ios');
        document.documentElement.classList.remove('platform-android');
      }
      
      // Set CSS custom properties for safe area handling
      const root = document.documentElement;
      root.style.setProperty('--status-bar-height', statusBarHeight);
      
      // ANDROID FIX: Force bottom inset for Android
      if (isAndroid) {
        root.style.setProperty('--safe-area-inset-bottom', bottomInset);
      }
      
      // Try to get actual safe area values from CSS env() if available
      const computedStyle = getComputedStyle(root);
      const actualTop = computedStyle.getPropertyValue('--safe-area-inset-top') || 'env(safe-area-inset-top, 0px)';
      const actualBottom = computedStyle.getPropertyValue('--safe-area-inset-bottom') || 'env(safe-area-inset-bottom, 0px)';
      const actualLeft = computedStyle.getPropertyValue('--safe-area-inset-left') || 'env(safe-area-inset-left, 0px)';
      const actualRight = computedStyle.getPropertyValue('--safe-area-inset-right') || 'env(safe-area-inset-right, 0px)';
      
      // ANDROID FIX: For Android, ensure minimum bottom inset
      if (isAndroid) {
        const bottomValue = actualBottom.includes('env(') ? bottomInset : actualBottom;
        root.style.setProperty('--safe-area-inset-bottom', bottomValue);
        console.log('[StatusBarManager] ANDROID FIX: Forced bottom inset to:', bottomValue);
      } else {
        root.style.setProperty('--safe-area-inset-bottom', actualBottom);
      }
      
      // Update other CSS variables
      root.style.setProperty('--safe-area-inset-top', actualTop);
      root.style.setProperty('--safe-area-inset-left', actualLeft);
      root.style.setProperty('--safe-area-inset-right', actualRight);
      
      console.log('[StatusBarManager] ANDROID FIX: Safe area variables updated:', {
        statusBarHeight,
        bottomInset,
        top: actualTop,
        bottom: isAndroid ? bottomInset : actualBottom,
        left: actualLeft,
        right: actualRight,
        platform: isAndroid ? 'android' : isIOS ? 'ios' : 'web'
      });
    };

    initializeStatusBar();
    
    // FIX: Add listeners for app visibility and focus changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    
    // Add native app state listeners if available
    const appPlugin = nativeIntegrationService.getPlugin('App');
    if (appPlugin) {
      appPlugin.addListener('appStateChange', handleAppStateChange);
    }
    
    // Update on orientation change and resize with debounce
    let updateTimeout: NodeJS.Timeout;
    const handleOrientationChange = () => {
      clearTimeout(updateTimeout);
      updateTimeout = setTimeout(() => {
        console.log('[StatusBarManager] ANDROID FIX: Orientation/resize detected, updating safe area');
        updateSafeAreaVariables();
        // Also re-hide status bar on orientation change
        if (nativeIntegrationService.isRunningNatively()) {
          handleVisibilityChange();
        }
      }, 200);
    };
    
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);
    
    // Also update when the visual viewport changes (for keyboard handling)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleOrientationChange);
    }
    
    return () => {
      clearTimeout(updateTimeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
      
      // Remove native app state listeners
      const appPlugin = nativeIntegrationService.getPlugin('App');
      if (appPlugin) {
        appPlugin.removeAllListeners();
      }
      
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleOrientationChange);
      }
    };
  }, []);

  return <>{children}</>;
};

export default StatusBarManager;
