
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
      
      // Enhanced measurement using visualViewport for accuracy
      const viewportHeight = window.innerHeight;
      const screenHeight = window.screen.availHeight || window.screen.height;
      const devicePixelRatio = window.devicePixelRatio || 1;
      const viewportWidth = window.innerWidth;
      
      // Use visualViewport.offsetTop for precise system UI measurement when available
      let accurateSystemUIHeight = 0;
      if (window.visualViewport && window.visualViewport.offsetTop > 0) {
        accurateSystemUIHeight = window.visualViewport.offsetTop;
        componentLogger.debug('Using visualViewport.offsetTop for accurate measurement', { 
          offsetTop: accurateSystemUIHeight 
        });
      } else {
        // Fallback to screen vs viewport calculation
        accurateSystemUIHeight = Math.max(0, screenHeight - viewportHeight);
      }
      
      // Smart Universal Safe Area Calculation with refined logic
      let calculatedTopInset = '0px';
      let bottomInset = '0px';
      
      if (isAndroid) {
        // Samsung Galaxy S24 specific detection (high DPI, specific dimensions)
        const isSamsungGalaxy = devicePixelRatio >= 3.0 && 
                               viewportWidth >= 360 && viewportWidth <= 430 &&
                               viewportHeight >= 800;
        
        // Layer 1: Base measurement using accurate system UI height
        let baseHeight = Math.max(24, accurateSystemUIHeight);
        
        // Layer 2: Adaptive buffer system (reduced from 8% to 4-5%)
        let bufferPercentage = 0.04; // Default 4%
        if (viewportWidth >= 600) bufferPercentage = 0.05; // Large screens 5%
        if (isSamsungGalaxy) bufferPercentage = 0.03; // Samsung specific 3%
        
        const adaptiveBuffer = viewportHeight * bufferPercentage;
        
        // Layer 3: Reduced platform minimum (32px instead of 56px)
        const minimumAndroidHeight = 32;
        const calculatedHeight = Math.max(minimumAndroidHeight, baseHeight + adaptiveBuffer);
        
        // Layer 4: Reduced maximum cap (10% instead of 15%)
        const maximumHeight = viewportHeight * 0.10;
        const finalHeight = Math.min(calculatedHeight, maximumHeight);
        
        calculatedTopInset = `${Math.round(finalHeight)}px`;
        bottomInset = '12px';
        
        document.documentElement.classList.add('platform-android');
        document.documentElement.classList.remove('platform-ios');
        
        componentLogger.debug('Android refined safe area calculated', { 
          screenHeight, 
          viewportHeight,
          viewportWidth,
          devicePixelRatio,
          accurateSystemUIHeight,
          baseHeight,
          adaptiveBuffer: Math.round(adaptiveBuffer),
          finalHeight: Math.round(finalHeight),
          minimumAndroidHeight,
          maximumHeight: Math.round(maximumHeight),
          isSamsungGalaxy,
          bufferPercentage
        });
      } else if (isIOS) {
        // Layer 1: Base iOS calculation
        let baseHeight = Math.max(44, accurateSystemUIHeight);
        
        // Layer 2: Reduced buffer for iOS (5% instead of 8%)
        const adaptiveBuffer = viewportHeight * 0.05;
        
        // Layer 3: Keep minimum for notched devices
        const minimumIOSHeight = 44;
        const calculatedHeight = Math.max(minimumIOSHeight, baseHeight + adaptiveBuffer);
        
        // Layer 4: Reduced maximum
        const maximumHeight = viewportHeight * 0.10;
        const finalHeight = Math.min(calculatedHeight, maximumHeight);
        
        calculatedTopInset = `${Math.round(finalHeight)}px`;
        
        document.documentElement.classList.add('platform-ios');
        document.documentElement.classList.remove('platform-android');
        
        componentLogger.debug('iOS refined safe area calculated', { 
          baseHeight,
          adaptiveBuffer: Math.round(adaptiveBuffer),
          finalHeight: Math.round(finalHeight),
          minimumIOSHeight,
          maximumHeight: Math.round(maximumHeight)
        });
      } else {
        // Web platform - minimal safe area
        const minimumWebHeight = 24;
        const adaptiveBuffer = viewportHeight * 0.03; // 3% for web
        const finalHeight = Math.min(minimumWebHeight + adaptiveBuffer, viewportHeight * 0.08);
        
        calculatedTopInset = `${Math.round(finalHeight)}px`;
        
        componentLogger.debug('Web refined safe area calculated', { 
          finalHeight: Math.round(finalHeight),
          adaptiveBuffer: Math.round(adaptiveBuffer)
        });
      }
      
      // Single source of truth - only set calculated-safe-area-top
      const root = document.documentElement;
      root.style.setProperty('--calculated-safe-area-top', calculatedTopInset);
      root.style.setProperty('--calculated-safe-area-bottom', bottomInset);
      
      // Update other variables for compatibility but don't use them for padding
      root.style.setProperty('--status-bar-height', calculatedTopInset);
      root.style.setProperty('--safe-area-inset-top', calculatedTopInset);
      root.style.setProperty('--safe-area-inset-bottom', bottomInset);
      root.style.setProperty('--safe-area-inset-left', 'env(safe-area-inset-left, 0px)');
      root.style.setProperty('--safe-area-inset-right', 'env(safe-area-inset-right, 0px)');
      
      componentLogger.info('Refined safe area variables updated', {
        calculatedTopInset,
        bottomInset,
        platform: isAndroid ? 'android' : isIOS ? 'ios' : 'web',
        viewportHeight,
        viewportWidth,
        devicePixelRatio,
        accurateSystemUIHeight
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
