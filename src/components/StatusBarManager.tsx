
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
        
        if (isNative) {
          console.log('[StatusBarManager] Configuring native status bar...');
          
          const statusBarPlugin = nativeIntegrationService.getPlugin('StatusBar');
          if (statusBarPlugin) {
            // Configure status bar for proper safe area handling
            await statusBarPlugin.setStyle({ style: 'dark' });
            await statusBarPlugin.setBackgroundColor({ color: '#FFFFFF' });
            await statusBarPlugin.setOverlaysWebView({ overlay: false });
            
            console.log('[StatusBarManager] Status bar configured successfully');
          }
        } else {
          console.log('[StatusBarManager] Web environment - status bar styling handled by CSS');
        }
        
        // Enhanced safe area detection and CSS variable setup
        updateSafeAreaVariables();
        
      } catch (error) {
        console.error('[StatusBarManager] Failed to configure status bar:', error);
      }
    };

    const updateSafeAreaVariables = () => {
      // Detect platform and set appropriate CSS variables
      const isAndroid = /Android/.test(navigator.userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                   (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      let statusBarHeight = '0px';
      
      if (isAndroid) {
        statusBarHeight = '24px';
        document.documentElement.classList.add('platform-android');
        document.documentElement.classList.remove('platform-ios');
      } else if (isIOS) {
        statusBarHeight = '44px';
        document.documentElement.classList.add('platform-ios');
        document.documentElement.classList.remove('platform-android');
      }
      
      // Set CSS custom properties for safe area handling
      const root = document.documentElement;
      root.style.setProperty('--status-bar-height', statusBarHeight);
      
      // Try to get actual safe area values from CSS env() if available
      const computedStyle = getComputedStyle(root);
      const actualTop = computedStyle.getPropertyValue('--safe-area-inset-top') || 'env(safe-area-inset-top, 0px)';
      const actualBottom = computedStyle.getPropertyValue('--safe-area-inset-bottom') || 'env(safe-area-inset-bottom, 0px)';
      const actualLeft = computedStyle.getPropertyValue('--safe-area-inset-left') || 'env(safe-area-inset-left, 0px)';
      const actualRight = computedStyle.getPropertyValue('--safe-area-inset-right') || 'env(safe-area-inset-right, 0px)';
      
      // Update CSS variables with safe area values
      root.style.setProperty('--safe-area-inset-top', actualTop);
      root.style.setProperty('--safe-area-inset-bottom', actualBottom);
      root.style.setProperty('--safe-area-inset-left', actualLeft);
      root.style.setProperty('--safe-area-inset-right', actualRight);
      
      console.log('[StatusBarManager] Safe area variables updated:', {
        statusBarHeight,
        top: actualTop,
        bottom: actualBottom,
        left: actualLeft,
        right: actualRight,
        platform: isAndroid ? 'android' : isIOS ? 'ios' : 'web'
      });
    };

    initializeStatusBar();
    
    // Update on orientation change and resize
    const handleOrientationChange = () => {
      console.log('[StatusBarManager] Orientation/resize detected, updating safe area');
      setTimeout(updateSafeAreaVariables, 100);
    };
    
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);
    
    // Also update when the visual viewport changes (for keyboard handling)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleOrientationChange);
    }
    
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleOrientationChange);
      }
    };
  }, []);

  return <>{children}</>;
};

export default StatusBarManager;
