
import { unifiedNativeAppService } from '@/services/unifiedNativeAppService';
import { initializeServiceWorker } from '@/utils/serviceWorker';

export async function initializeUnifiedSystem(): Promise<void> {
  console.log('[UnifiedSystem] Initializing unified system');
  
  try {
    // Check if we're on an app route
    const isAppRoute = window.location.pathname.startsWith('/app');
    
    if (isAppRoute) {
      console.log('[UnifiedSystem] App route detected, initializing native app service');
      
      // Initialize unified native app service
      await unifiedNativeAppService.initialize();
      
      // Initialize service worker with native app optimizations
      const swResult = await initializeServiceWorker();
      
      if (swResult.success) {
        console.log('[UnifiedSystem] Service worker initialized successfully');
        
        // Notify service worker about native app
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'NATIVE_APP_READY',
            appInfo: unifiedNativeAppService.getAppInfo()
          });
        }
      } else {
        console.warn('[UnifiedSystem] Service worker initialization failed:', swResult.error);
      }
    } else {
      console.log('[UnifiedSystem] Non-app route, skipping native app initialization');
    }
    
    console.log('[UnifiedSystem] Unified system initialized successfully');
    
  } catch (error) {
    console.error('[UnifiedSystem] Unified system initialization failed:', error);
  }
}

// Auto-initialize when module is loaded if on app route
if (typeof window !== 'undefined' && window.location.pathname.startsWith('/app')) {
  // Delay initialization to ensure DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeUnifiedSystem);
  } else {
    setTimeout(initializeUnifiedSystem, 100);
  }
}
