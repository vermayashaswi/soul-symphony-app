
import React, { useEffect } from 'react';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';
import { logger } from '@/utils/logger';
import { useNotificationPanelDetector } from '@/hooks/use-notification-panel-detector';

interface StatusBarManagerProps {
  children: React.ReactNode;
}

export const StatusBarManager: React.FC<StatusBarManagerProps> = ({ children }) => {
  const componentLogger = logger.createLogger('StatusBarManager');
  
  // Add notification panel gesture detection for immediate status bar hide
  useNotificationPanelDetector({
    onNotificationPanelClosed: () => {
      componentLogger.info('Notification panel closed via gesture - status bar hidden');
    },
    topThreshold: 50,
    swipeThreshold: 100,
    debounceMs: 300
  });
  
  useEffect(() => {
    const initializeStatusBar = async () => {
      try {
        const isNative = nativeIntegrationService.isRunningNatively();
        const isAndroid = /Android/.test(navigator.userAgent);
        
        componentLogger.info('Initializing status bar', { native: isNative, android: isAndroid });
        
        if (isNative) {
          componentLogger.info('Configuring native status bar for immersive experience');
          
          // Hide status bar for full-screen immersive experience
          await nativeIntegrationService.hideStatusBar();
          
          const statusBarPlugin = nativeIntegrationService.getPlugin('StatusBar');
          if (statusBarPlugin) {
            // Configure status bar to NOT overlay web view to prevent header overlap
            await statusBarPlugin.setOverlaysWebView({ overlay: false });
            await statusBarPlugin.setStyle({ style: 'dark' });
            
            componentLogger.info('Status bar hidden and configured for immersive experience');
          }
        } else {
          componentLogger.debug('Web environment - status bar styling handled by CSS');
        }
        
        // Enhanced safe area detection and CSS variable setup
        updateSafeAreaVariables();
        
      } catch (error) {
        componentLogger.error('Failed to configure status bar', error);
      }
    };

    // FIX: Re-hide status bar when app becomes visible/active
    const handleVisibilityChange = async () => {
      if (!document.hidden && nativeIntegrationService.isRunningNatively()) {
        componentLogger.debug('App became visible, re-hiding status bar');
        try {
          await nativeIntegrationService.hideStatusBar();
          const statusBarPlugin = nativeIntegrationService.getPlugin('StatusBar');
          if (statusBarPlugin) {
            await statusBarPlugin.setOverlaysWebView({ overlay: false });
          }
        } catch (error) {
          componentLogger.error('Failed to re-hide status bar', error);
        }
      }
    };

    const handleAppStateChange = async (event: any) => {
      componentLogger.debug('App state changed', { event });
      if (event?.isActive && nativeIntegrationService.isRunningNatively()) {
        componentLogger.debug('App resumed, re-hiding status bar');
        try {
          await nativeIntegrationService.hideStatusBar();
          const statusBarPlugin = nativeIntegrationService.getPlugin('StatusBar');
          if (statusBarPlugin) {
            await statusBarPlugin.setOverlaysWebView({ overlay: false });
          }
        } catch (error) {
          componentLogger.error('Failed to re-hide status bar on resume', error);
        }
      }
    };

    const updateSafeAreaVariables = () => {
      try {
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const isNative = nativeIntegrationService.isRunningNatively();
        
        // Enhanced environment detection
        const userAgent = navigator.userAgent.toLowerCase();
        const isMobileWebBrowser = !isNative && (
          /android/.test(userAgent) || 
          /iphone|ipad|ipod/.test(userAgent) ||
          ('ontouchstart' in window && viewportWidth < 1024)
        );
        const isDesktopBrowser = !isNative && !isMobileWebBrowser;
        
        // Detect specific mobile browsers
        const isChromeMovile = isMobileWebBrowser && /chrome/.test(userAgent);
        const isSafariMobile = isMobileWebBrowser && /safari/.test(userAgent) && !/chrome/.test(userAgent);
        const isSamsungBrowser = isMobileWebBrowser && /samsungbrowser/.test(userAgent);
        
        // Browser UI detection for mobile web
        const screenHeight = window.screen.availHeight;
        const heightDifference = Math.max(0, screenHeight - viewportHeight);
        const hasBrowserUI = isMobileWebBrowser && heightDifference > 50; // Browser UI likely present
        
        componentLogger.debug('Environment-aware safe area calculation', {
          viewportHeight,
          viewportWidth,
          isNative,
          isMobileWebBrowser,
          isDesktopBrowser,
          isChromeMovile,
          isSafariMobile,
          isSamsungBrowser,
          hasBrowserUI,
          heightDifference,
          userAgent: userAgent.substring(0, 50) + '...'
        });

        // Check if native CSS env() provides sufficient safe area
        const envSafeAreaTop = parseInt(
          getComputedStyle(document.documentElement)
            .getPropertyValue('--safe-area-inset-top')
            .replace('px', '') || '0'
        );

        // Add debug CSS variables
        document.documentElement.style.setProperty('--env-safe-area-top', `${envSafeAreaTop}px`);

        let calculatedFallback = 0;
        
        // Environment-aware fallback calculation
        if (envSafeAreaTop < 20) {
          let systemUIHeight = 0;
          
          if (window.visualViewport && window.visualViewport.offsetTop > 0) {
            systemUIHeight = window.visualViewport.offsetTop;
            componentLogger.debug('Using visualViewport.offsetTop', { offsetTop: systemUIHeight });
          } else if (hasBrowserUI) {
            systemUIHeight = heightDifference;
            componentLogger.debug('Using browser UI height difference', { systemUIHeight });
          }

          // Environment-specific calculations
          if (isMobileWebBrowser) {
            // Mobile Web Browser: Larger fallbacks for browser UI
            const mobileBuffer = viewportHeight * 0.045; // 4.5% buffer for mobile web
            const mobileMinimum = 32; // Larger minimum for mobile web browsers
            const mobileMaximum = viewportHeight * 0.12; // 12% maximum for mobile web
            
            calculatedFallback = Math.max(
              mobileMinimum,
              systemUIHeight + mobileBuffer
            );
            calculatedFallback = Math.min(calculatedFallback, mobileMaximum);
            
            componentLogger.debug('Mobile web browser calculation', {
              mobileBuffer: Math.round(mobileBuffer),
              mobileMinimum,
              mobileMaximum: Math.round(mobileMaximum),
              systemUIHeight,
              calculatedFallback: Math.round(calculatedFallback)
            });
            
          } else if (isDesktopBrowser) {
            // Desktop Browser: Minimal padding
            const desktopBuffer = viewportHeight * 0.01; // 1% buffer for desktop
            const desktopMinimum = 8; // Minimal for desktop
            const desktopMaximum = 16; // Small maximum for desktop
            
            calculatedFallback = Math.max(
              desktopMinimum,
              systemUIHeight + desktopBuffer
            );
            calculatedFallback = Math.min(calculatedFallback, desktopMaximum);
            
          } else {
            // Native App: Current universal logic
            const nativeBuffer = viewportHeight * 0.025; // 2.5% buffer for native
            const nativeMinimum = 24; // Current minimum for native
            const nativeMaximum = viewportHeight * 0.08; // 8% maximum for native
            
            calculatedFallback = Math.max(
              nativeMinimum,
              systemUIHeight + nativeBuffer
            );
            calculatedFallback = Math.min(calculatedFallback, nativeMaximum);
          }
        }

        // Add debug CSS variable for calculated fallback
        document.documentElement.style.setProperty('--calculated-fallback', `${Math.round(calculatedFallback)}px`);

        componentLogger.info('Environment-aware safe area values', {
          environment: isNative ? 'native' : isMobileWebBrowser ? 'mobile-web' : 'desktop',
          envSafeAreaTop,
          calculatedFallback: Math.round(calculatedFallback),
          willUseEnv: envSafeAreaTop >= 20,
          hasBrowserUI
        });

        // Set the fallback value for CSS max() function
        document.documentElement.style.setProperty(
          '--safe-area-fallback',
          `${Math.round(calculatedFallback)}px`
        );

        // Environment-aware side and bottom safe areas
        let sideBuffer, bottomBuffer;
        
        if (isMobileWebBrowser) {
          sideBuffer = Math.max(12, viewportHeight * 0.015); // Larger for mobile web
          bottomBuffer = Math.max(16, viewportHeight * 0.02); // Larger for mobile web
        } else if (isDesktopBrowser) {
          sideBuffer = Math.max(4, viewportHeight * 0.005); // Minimal for desktop
          bottomBuffer = Math.max(6, viewportHeight * 0.008); // Minimal for desktop
        } else {
          sideBuffer = Math.max(8, viewportHeight * 0.01); // Current for native
          bottomBuffer = Math.max(12, viewportHeight * 0.015); // Current for native
        }
        
        document.documentElement.style.setProperty(
          '--safe-area-bottom-fallback',
          `${Math.round(bottomBuffer)}px`
        );
        document.documentElement.style.setProperty(
          '--safe-area-left-fallback',
          `${Math.round(sideBuffer)}px`
        );
        document.documentElement.style.setProperty(
          '--safe-area-right-fallback',
          `${Math.round(sideBuffer)}px`
        );

      } catch (error) {
        componentLogger.error('Error updating safe area variables', error);
        
        // Universal fallback values
        document.documentElement.style.setProperty('--safe-area-fallback', '24px');
        document.documentElement.style.setProperty('--safe-area-bottom-fallback', '12px');
        document.documentElement.style.setProperty('--safe-area-left-fallback', '8px');
        document.documentElement.style.setProperty('--safe-area-right-fallback', '8px');
      }
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
        componentLogger.debug('Orientation/resize detected, updating safe area');
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
