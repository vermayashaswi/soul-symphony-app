
import React, { useEffect } from 'react';
import { detectPWABuilder, configurePWABuilderSettings } from '@/utils/pwaBuilderDetection';
import { versionManager } from '@/utils/versionManager';
import { toast } from 'sonner';

const PWABuilderManager: React.FC = () => {
  useEffect(() => {
    const initializePWABuilder = async () => {
      try {
        console.log('[PWABuilder] Initializing PWABuilder manager...');
        
        // Detect PWABuilder environment
        const pwaInfo = detectPWABuilder();
        
        if (pwaInfo.isPWABuilder) {
          console.log('[PWABuilder] PWABuilder environment detected:', pwaInfo);
          
          // Configure PWABuilder-specific settings
          configurePWABuilderSettings(pwaInfo);
          
          // Add PWABuilder class to body for styling
          document.body.classList.add('pwa-builder-app');
          document.body.classList.add(`pwa-${pwaInfo.platform}`);
          
          // Store PWABuilder info for other components
          localStorage.setItem('pwa_builder_info', JSON.stringify(pwaInfo));
          
          // Force version check for PWABuilder apps
          setTimeout(() => {
            versionManager.checkForUpdates();
          }, 3000);
          
          // Show PWABuilder detection notification (only in dev mode)
          if (process.env.NODE_ENV === 'development') {
            toast.info(`PWABuilder ${pwaInfo.platform} app detected`);
          }
          
          // Handle PWABuilder-specific navigation
          handlePWABuilderNavigation();
          
        } else {
          console.log('[PWABuilder] Not running in PWABuilder environment');
          document.body.classList.add('web-app');
        }
        
      } catch (error) {
        console.error('[PWABuilder] Error during initialization:', error);
      }
    };
    
    initializePWABuilder();
  }, []);
  
  const handlePWABuilderNavigation = () => {
    // Handle deep links for PWABuilder apps
    const currentPath = window.location.pathname;
    
    // If we're on the root path in a PWABuilder app, redirect to /app
    if (currentPath === '/' || currentPath === '/index.html') {
      console.log('[PWABuilder] Redirecting to app from root path');
      window.history.replaceState(null, '', '/app');
    }
    
    // Add cache-busting parameter to all navigation
    const addCacheBusting = () => {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('_cb')) {
        url.searchParams.set('_cb', Date.now().toString());
        window.history.replaceState(null, '', url.toString());
      }
    };
    
    addCacheBusting();
  };

  // This component doesn't render anything
  return null;
};

export default PWABuilderManager;
