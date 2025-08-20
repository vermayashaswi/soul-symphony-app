
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
      // Detect platform and calculate actual safe area values
      const isAndroid = /Android/.test(navigator.userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                   (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      // Enhanced safe area detection using viewport measurements
      const screenHeight = window.screen.height;
      const viewportHeight = window.innerHeight;
      const heightDifference = screenHeight - viewportHeight;
      
      let statusBarHeight = '0px';
      let calculatedTopInset = '0px';
      let bottomInset = '0px';
      
      if (isAndroid) {
        // Calculate actual status bar height for Android
        const actualStatusBarHeight = Math.max(24, Math.min(48, heightDifference / 2));
        statusBarHeight = `${actualStatusBarHeight}px`;
        calculatedTopInset = statusBarHeight;
        bottomInset = '12px'; // Standard Android navigation gesture area
        
        document.documentElement.classList.add('platform-android');
        document.documentElement.classList.remove('platform-ios');
        
        componentLogger.debug('Android platform detected', { 
          screenHeight, 
          viewportHeight, 
          heightDifference, 
          calculatedStatusBarHeight: actualStatusBarHeight 
        });
      } else if (isIOS) {
        statusBarHeight = '44px';
        calculatedTopInset = statusBarHeight;
        document.documentElement.classList.add('platform-ios');
        document.documentElement.classList.remove('platform-android');
      }
      
      // Set CSS custom properties for safe area handling with calculated values
      const root = document.documentElement;
      root.style.setProperty('--status-bar-height', statusBarHeight);
      root.style.setProperty('--calculated-safe-area-top', calculatedTopInset);
      root.style.setProperty('--calculated-safe-area-bottom', bottomInset);
      
      // Update safe area inset variables with calculated or env() values
      const envTop = getComputedStyle(root).getPropertyValue('--safe-area-inset-top');
      const envBottom = getComputedStyle(root).getPropertyValue('--safe-area-inset-bottom');
      
      // Use calculated values as fallback when env() values are not available
      const finalTopInset = envTop && !envTop.includes('env(') ? envTop : calculatedTopInset;
      const finalBottomInset = envBottom && !envBottom.includes('env(') ? envBottom : bottomInset;
      
      root.style.setProperty('--safe-area-inset-top', finalTopInset);
      root.style.setProperty('--safe-area-inset-bottom', finalBottomInset);
      root.style.setProperty('--safe-area-inset-left', 'env(safe-area-inset-left, 0px)');
      root.style.setProperty('--safe-area-inset-right', 'env(safe-area-inset-right, 0px)');
      
      componentLogger.debug('Safe area variables updated', {
        statusBarHeight,
        bottomInset,
        top: finalTopInset,
        bottom: finalBottomInset,
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
