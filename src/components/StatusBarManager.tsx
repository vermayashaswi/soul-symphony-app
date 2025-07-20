
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
            // Configure status bar for light content on dark background
            await statusBarPlugin.setStyle({ style: 'dark' });
            await statusBarPlugin.setBackgroundColor({ color: '#FFFFFF' });
            // CRITICAL: Ensure status bar does not overlay the web view
            await statusBarPlugin.setOverlaysWebView({ overlay: false });
            
            console.log('[StatusBarManager] Status bar configured successfully');
          }
        } else {
          console.log('[StatusBarManager] Web environment - status bar styling handled by CSS');
        }
        
        // Set CSS custom properties for status bar height
        updateStatusBarHeight();
        
      } catch (error) {
        console.error('[StatusBarManager] Failed to configure status bar:', error);
      }
    };

    const updateStatusBarHeight = () => {
      // Set CSS variables for different device types
      const isAndroid = /Android/.test(navigator.userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                   (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      let statusBarHeight = '0px';
      
      if (isAndroid) {
        // Android status bar is typically 24dp, which translates to different px values
        statusBarHeight = '24px';
        document.body.classList.add('android-device');
      } else if (isIOS) {
        // iOS status bar height varies by device
        statusBarHeight = '44px'; // Safe default for most iOS devices
        document.body.classList.add('ios-device');
      }
      
      document.documentElement.style.setProperty('--status-bar-height', statusBarHeight);
      document.documentElement.style.setProperty('--safe-area-inset-top', `max(${statusBarHeight}, env(safe-area-inset-top, 0px))`);
      
      console.log('[StatusBarManager] Status bar height set to:', statusBarHeight);
      
      // Add debug class to visualize safe areas (remove in production)
      if (isAndroid || isIOS) {
        document.body.classList.add('debug-safe-areas');
      }
    };

    initializeStatusBar();
    
    // Update on orientation change
    const handleOrientationChange = () => {
      setTimeout(updateStatusBarHeight, 100);
    };
    
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);
    
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, []);

  return <>{children}</>;
};

export default StatusBarManager;
