import { useEffect } from 'react';
import { unifiedNotificationService } from '@/services/unifiedNotificationService';

export const AppInitializer: React.FC = () => {
  useEffect(() => {
    // Initialize unified notification service (non-blocking)
    console.log('[AppInitializer] Initializing app services (non-blocking)');
    
    // Don't await - let it initialize in background
    unifiedNotificationService.initialize().catch(error => {
      console.error('[AppInitializer] Error initializing notification service:', error);
      // App continues regardless of notification service errors
    });

    // Cleanup on unmount
    return () => {
      unifiedNotificationService.cleanup().catch(error => {
        console.error('[AppInitializer] Error cleaning up notification service:', error);
      });
    };
  }, []);

  return null; // This component doesn't render anything
};