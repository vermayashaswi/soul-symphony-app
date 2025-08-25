
import { useState, useEffect } from 'react';
import { enhancedNotificationService, NotificationPermissionState } from '@/services/enhancedNotificationService';

export { type NotificationPermissionState };

export const useNotificationPermission = () => {
  const [permission, setPermission] = useState<NotificationPermissionState>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [initializationComplete, setInitializationComplete] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  // Enhanced permission checking using the enhanced service
  useEffect(() => {
    const checkPermission = async () => {
      console.log('[useNotificationPermission] Checking notification permission status with enhanced service');
      try {
        // Get debug info for troubleshooting
        const info = await enhancedNotificationService.getPermissionInfo();
        setDebugInfo(info);
        console.log('[useNotificationPermission] Permission debug info:', info);
        
        // Check current permission status
        const currentPermission = await enhancedNotificationService.checkPermissionStatus();
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
    console.log('[useNotificationPermission] Permission request initiated using enhanced service', {
      currentPermission: permission,
      isSupported,
      debugInfo
    });

    try {
      // Use enhanced notification service for permission request
      const result = await enhancedNotificationService.requestPermissions();
      console.log('[useNotificationPermission] Enhanced service permission result:', result);
      
      // Update state based on result
      setPermission(result.state);
      
      // Update debug info
      const newDebugInfo = await enhancedNotificationService.getPermissionInfo();
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
