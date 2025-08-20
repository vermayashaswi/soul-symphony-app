
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
      
      // Enhanced viewport detection using available height for better accuracy
      const screenHeight = window.screen.availHeight || window.screen.height;
      const viewportHeight = window.innerHeight;
      const devicePixelRatio = window.devicePixelRatio || 1;
      
      // Smart Universal Safe Area Calculation
      let baseHeight = 0;
      let calculatedTopInset = '0px';
      let bottomInset = '0px';
      
      if (isAndroid) {
        // Layer 1: Enhanced base calculation with device density
        const heightDifference = screenHeight - viewportHeight;
        const densityAdjustedHeight = Math.max(24, Math.min(56, heightDifference / 2));
        baseHeight = densityAdjustedHeight;
        
        // Layer 2: Intelligent buffer system
        const viewportBuffer = Math.max(48, viewportHeight * 0.08); // 8% of viewport height
        const deviceMultiplier = devicePixelRatio > 2.5 ? 1.25 : 1.15; // High-DPI gets +25%, standard +15%
        const intelligentBuffer = viewportBuffer * deviceMultiplier;
        
        // Layer 3: Platform-specific minimum (56px for Android)
        const minimumAndroidHeight = 56;
        const calculatedHeight = Math.max(minimumAndroidHeight, baseHeight + intelligentBuffer);
        
        // Layer 4: Fallback maximum (15% of viewport height)
        const maximumHeight = viewportHeight * 0.15;
        const finalHeight = Math.min(calculatedHeight, maximumHeight);
        
        calculatedTopInset = `${Math.round(finalHeight)}px`;
        bottomInset = '12px'; // Standard Android navigation gesture area
        
        document.documentElement.classList.add('platform-android');
        document.documentElement.classList.remove('platform-ios');
        
        componentLogger.debug('Android smart safe area calculated', { 
          screenHeight, 
          viewportHeight, 
          devicePixelRatio,
          baseHeight,
          intelligentBuffer,
          finalHeight: Math.round(finalHeight),
          minimumAndroidHeight,
          maximumHeight: Math.round(maximumHeight)
        });
      } else if (isIOS) {
        // Layer 1: Base iOS calculation
        baseHeight = 44;
        
        // Layer 2: Intelligent buffer for iOS
        const viewportBuffer = Math.max(64, viewportHeight * 0.08);
        const deviceMultiplier = devicePixelRatio > 2.5 ? 1.25 : 1.15;
        const intelligentBuffer = viewportBuffer * deviceMultiplier;
        
        // Layer 3: Platform-specific minimum (64px for iOS)
        const minimumIOSHeight = 64;
        const calculatedHeight = Math.max(minimumIOSHeight, baseHeight + intelligentBuffer);
        
        // Layer 4: Fallback maximum
        const maximumHeight = viewportHeight * 0.15;
        const finalHeight = Math.min(calculatedHeight, maximumHeight);
        
        calculatedTopInset = `${Math.round(finalHeight)}px`;
        
        document.documentElement.classList.add('platform-ios');
        document.documentElement.classList.remove('platform-android');
        
        componentLogger.debug('iOS smart safe area calculated', { 
          baseHeight,
          intelligentBuffer,
          finalHeight: Math.round(finalHeight),
          minimumIOSHeight,
          maximumHeight: Math.round(maximumHeight)
        });
      } else {
        // Web platform - Layer 3: minimum 32px for browser chrome
        const minimumWebHeight = 32;
        const viewportBuffer = Math.max(32, viewportHeight * 0.05); // 5% for web
        const finalHeight = Math.min(minimumWebHeight + viewportBuffer, viewportHeight * 0.1);
        
        calculatedTopInset = `${Math.round(finalHeight)}px`;
        
        componentLogger.debug('Web smart safe area calculated', { 
          finalHeight: Math.round(finalHeight),
          viewportBuffer
        });
      }
      
      // Set CSS custom properties for safe area handling with smart calculated values
      const root = document.documentElement;
      root.style.setProperty('--status-bar-height', calculatedTopInset); // Use smart calculation
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
      
      componentLogger.debug('Smart safe area variables updated', {
        calculatedTopInset,
        bottomInset,
        top: finalTopInset,
        bottom: finalBottomInset,
        platform: isAndroid ? 'android' : isIOS ? 'ios' : 'web',
        viewportHeight,
        devicePixelRatio
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
