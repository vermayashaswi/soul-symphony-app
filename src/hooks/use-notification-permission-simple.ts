
import { useState, useEffect } from 'react';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export const useNotificationPermissionSimple = () => {
  const [permission, setPermission] = useState<NotificationPermissionState>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [initializationComplete, setInitializationComplete] = useState(false);

  useEffect(() => {
    const checkPermission = async () => {
      console.log('[NotificationPermission] Starting permission check');
      
      try {
        // Check if running natively first
        if (nativeIntegrationService.isRunningNatively()) {
          console.log('[NotificationPermission] Native environment detected');
          
          // Try to use native permissions API
          try {
            const result = await nativeIntegrationService.requestPermissions(['notifications']);
            if (result && result.notifications) {
              setIsSupported(true);
              setPermission(result.notifications === 'granted' ? 'granted' : 'denied');
              console.log('[NotificationPermission] Native permission status:', result.notifications);
              setInitializationComplete(true);
              return;
            }
          } catch (error) {
            console.warn('[NotificationPermission] Native permission check failed:', error);
          }
        }

        // Fallback to web API
        if ('Notification' in window) {
          setIsSupported(true);
          const webPermission = Notification.permission;
          setPermission(webPermission as NotificationPermissionState);
          console.log('[NotificationPermission] Web permission status:', webPermission);
        } else {
          console.log('[NotificationPermission] Notifications not supported');
          setIsSupported(false);
          setPermission('unsupported');
        }
      } catch (error) {
        console.error('[NotificationPermission] Error checking permission:', error);
        setIsSupported(false);
        setPermission('unsupported');
      } finally {
        setInitializationComplete(true);
      }
    };

    checkPermission();
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    console.log('[NotificationPermission] Permission request initiated');

    if (!isSupported) {
      console.log('[NotificationPermission] Notifications not supported');
      return false;
    }

    if (permission === 'granted') {
      return true;
    }

    try {
      // Try native first if available
      if (nativeIntegrationService.isRunningNatively()) {
        console.log('[NotificationPermission] Requesting native permission');
        const result = await nativeIntegrationService.requestPermissions(['notifications']);
        if (result && result.notifications) {
          const granted = result.notifications === 'granted';
          setPermission(granted ? 'granted' : 'denied');
          console.log('[NotificationPermission] Native permission result:', granted);
          return granted;
        }
      }

      // Fallback to web API
      try {
        console.log('[NotificationPermission] Requesting web permission');
        const result = await Notification.requestPermission();
        setPermission(result as NotificationPermissionState);
        console.log('[NotificationPermission] Web permission result:', result);
        return result === 'granted';
      } catch (error: any) {
        console.error('[NotificationPermission] Web permission request failed:', error);
        setPermission('denied');
        return false;
      }
    } catch (error) {
      console.error('[NotificationPermission] Error requesting permission:', error);
      setPermission('denied');
      return false;
    }
  };

  const isGranted = permission === 'granted';
  const isDenied = permission === 'denied';
  const isDefault = permission === 'default';

  return {
    permission,
    isSupported,
    isGranted,
    isDenied,
    isDefault,
    initializationComplete,
    requestPermission
  };
};
