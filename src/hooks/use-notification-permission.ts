
import { useState, useEffect } from 'react';
import { nativeNotificationService, NotificationPermissionState } from '@/services/nativeNotificationService';

export { type NotificationPermissionState };

export const useNotificationPermission = () => {
  const [permission, setPermission] = useState<NotificationPermissionState>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [initializationComplete, setInitializationComplete] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  // Native permission checking using the native service
  useEffect(() => {
    const checkPermission = async () => {
      console.log('[useNotificationPermission] Checking notification permission status with native service');
      try {
        // Get debug info for troubleshooting
        const info = await nativeNotificationService.getDetailedStatus();
        setDebugInfo(info);
        console.log('[useNotificationPermission] Permission debug info:', info);
        
        // Check current permission status
        const currentPermission = await nativeNotificationService.checkPermissionStatus();
        console.log('[useNotificationPermission] Current permission status:', currentPermission);
        
        setPermission(currentPermission);
        setIsSupported(currentPermission !== 'unsupported');
      } catch (error) {
        console.error('[useNotificationPermission] Error checking permissions:', error);
        setPermission('unsupported');
        setIsSupported(false);
      } finally {
        setInitializationComplete(true);
        console.log('[useNotificationPermission] Permission check complete');
      }
    };

    checkPermission();
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    console.log('[useNotificationPermission] Permission request initiated using native service', {
      currentPermission: permission,
      isSupported,
      debugInfo
    });

    try {
      // Use native notification service for permission request
      const result = await nativeNotificationService.requestPermissions();
      console.log('[useNotificationPermission] Native service permission result:', result);
      
      // Update state based on result
      setPermission(result.state);
      
      // Update debug info
      const newDebugInfo = await nativeNotificationService.getDetailedStatus();
      setDebugInfo(newDebugInfo);
      
      return result.granted;
    } catch (error) {
      console.error('[useNotificationPermission] Error requesting notification permission:', error);
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
    requestPermission,
    debugInfo
  };
};
