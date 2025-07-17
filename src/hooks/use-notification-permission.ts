
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
          // Use Capacitor's PushNotifications plugin for native apps
          const pushNotifications = nativeIntegrationService.getPlugin('PushNotifications');
          if (pushNotifications) {
            const result = await pushNotifications.checkPermissions();
            setIsSupported(true);
            setPermission(result.receive === 'granted' ? 'granted' : result.receive);
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
        const pushNotifications = nativeIntegrationService.getPlugin('PushNotifications');
        if (pushNotifications) {
          const result = await pushNotifications.requestPermissions();
          const granted = result.receive === 'granted';
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
