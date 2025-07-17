
import { useState, useEffect } from 'react';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export const useNotificationPermission = () => {
  const [permission, setPermission] = useState<NotificationPermissionState>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const checkPermission = async () => {
      // Check if running natively first
      if (nativeIntegrationService.isRunningNatively()) {
        try {
          // Use Capacitor's LocalNotifications plugin for local/scheduled notifications
          const localNotifications = nativeIntegrationService.getPlugin('LocalNotifications');
          if (localNotifications) {
            const result = await localNotifications.checkPermissions();
            setIsSupported(true);
            setPermission(result.display === 'granted' ? 'granted' : result.display);
            return;
          }
        } catch (error) {
          console.error('Error checking native notification permission:', error);
        }
      }

      // Fallback to web API
      if ('Notification' in window) {
        setIsSupported(true);
        setPermission(Notification.permission);
      } else {
        setIsSupported(false);
        setPermission('unsupported');
      }
    };

    checkPermission();
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    if (!isSupported) {
      console.log('Notifications not supported');
      return false;
    }

    if (permission === 'granted') {
      return true;
    }

    try {
      // Try native first if available
      if (nativeIntegrationService.isRunningNatively()) {
        const localNotifications = nativeIntegrationService.getPlugin('LocalNotifications');
        if (localNotifications) {
          const result = await localNotifications.requestPermissions();
          const granted = result.display === 'granted';
          setPermission(granted ? 'granted' : 'denied');
          return granted;
        }
      }

      // Fallback to web API
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
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
    requestPermission
  };
};
