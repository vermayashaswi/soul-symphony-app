
import { useState, useEffect } from 'react';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';
import { enhancedNotificationService } from '@/services/enhancedNotificationService';

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export const useNotificationPermission = () => {
  const [permission, setPermission] = useState<NotificationPermissionState>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [initializationComplete, setInitializationComplete] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  // Enhanced permission checking using the new service
  useEffect(() => {
    const checkPermission = async () => {
      console.log('[Notifications] Checking notification permission status with enhanced service');
      try {
        // Get debug info for troubleshooting
        const info = await enhancedNotificationService.getPermissionInfo();
        setDebugInfo(info);
        console.log('[Notifications] Permission debug info:', info);
        
        // Check current permission status
        const currentPermission = await enhancedNotificationService.checkPermissionStatus();
        console.log('[Notifications] Current permission status:', currentPermission);
        
        setPermission(currentPermission);
        setIsSupported(currentPermission !== 'unsupported');
      } catch (error) {
        console.error('[Notifications] Error checking permissions:', error);
        setPermission('unsupported');
        setIsSupported(false);
      } finally {
        setInitializationComplete(true);
        console.log('[Notifications] Permission check complete');
      }
    };

    checkPermission();
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    console.log('[Notifications] Permission request initiated using enhanced service', {
      currentPermission: permission,
      isSupported,
      debugInfo
    });

    try {
      // Use enhanced notification service for permission request
      const result = await enhancedNotificationService.requestPermissions();
      console.log('[Notifications] Enhanced service permission result:', result);
      
      // Update state based on result
      setPermission(result.state);
      
      // Update debug info
      const newDebugInfo = await enhancedNotificationService.getPermissionInfo();
      setDebugInfo(newDebugInfo);
      
      return result.granted;
    } catch (error) {
      console.error('[Notifications] Error requesting notification permission:', error);
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
