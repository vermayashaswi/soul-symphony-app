import { useEffect } from 'react';
import { unifiedNotificationService } from '@/services/unifiedNotificationService';

export const useNotificationInitialization = () => {
  useEffect(() => {
    // Initialize notifications when the app starts
    const initializeNotifications = async () => {
      try {
        console.log('[useNotificationInitialization] Initializing notifications on app start');
        await unifiedNotificationService.initializeOnAppStart();
      } catch (error) {
        console.error('[useNotificationInitialization] Error initializing notifications:', error);
      }
    };

    initializeNotifications();
  }, []);
};