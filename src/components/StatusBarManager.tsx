
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
        
        componentLogger.debug('Universal safe area calculation', {
          viewportHeight,
          userAgent: navigator.userAgent.substring(0, 50) + '...'
        });

        // Check if native CSS env() provides sufficient safe area
        const envSafeAreaTop = parseInt(
          getComputedStyle(document.documentElement)
            .getPropertyValue('--safe-area-inset-top')
            .replace('px', '') || '0'
        );

        let calculatedFallback = 0;
        
        // Only calculate fallback if env() returns 0 or insufficient value
        if (envSafeAreaTop < 20) {
          // Universal calculation - no device-specific logic
          let systemUIHeight = 0;
          
          if (window.visualViewport && window.visualViewport.offsetTop > 0) {
            systemUIHeight = window.visualViewport.offsetTop;
            componentLogger.debug('Using visualViewport.offsetTop', { offsetTop: systemUIHeight });
          } else {
            // Fallback: calculate from viewport difference
            const screenHeight = window.screen.availHeight;
            systemUIHeight = Math.max(0, screenHeight - viewportHeight);
            componentLogger.debug('Using viewport difference', { systemUIHeight });
          }

          // Universal buffer: 2.5% of viewport height for all devices
          const universalBuffer = viewportHeight * 0.025;
          
          // Universal minimum: 24px for all platforms
          const universalMinimum = 24;
          
          // Calculate with universal logic
          calculatedFallback = Math.max(
            universalMinimum,
            systemUIHeight + universalBuffer
          );
          
          // Universal maximum: 8% of viewport height
          const universalMaximum = viewportHeight * 0.08;
          calculatedFallback = Math.min(calculatedFallback, universalMaximum);
        }

        componentLogger.info('Universal safe area values', {
          envSafeAreaTop,
          calculatedFallback: Math.round(calculatedFallback),
          willUseEnv: envSafeAreaTop >= 20
        });

        // Set the fallback value for CSS max() function
        document.documentElement.style.setProperty(
          '--safe-area-fallback',
          `${Math.round(calculatedFallback)}px`
        );

        // Set other safe areas with simplified universal logic
        const universalSideBuffer = Math.max(8, viewportHeight * 0.01);
        document.documentElement.style.setProperty(
          '--safe-area-bottom-fallback',
          `${Math.max(12, Math.round(viewportHeight * 0.015))}px`
        );
        document.documentElement.style.setProperty(
          '--safe-area-left-fallback',
          `${Math.round(universalSideBuffer)}px`
        );
        document.documentElement.style.setProperty(
          '--safe-area-right-fallback',
          `${Math.round(universalSideBuffer)}px`
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
