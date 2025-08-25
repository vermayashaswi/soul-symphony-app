import { useEffect } from 'react';
import { unifiedNotificationService } from '@/services/unifiedNotificationService';

export const AppInitializer: React.FC = () => {
  useEffect(() => {
    // Initialize unified notification service
    console.log('[AppInitializer] Initializing app services');
    
    unifiedNotificationService.initialize().catch(error => {
      console.error('[AppInitializer] Error initializing notification service:', error);
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