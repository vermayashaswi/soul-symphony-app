
import { useState, useEffect } from 'react';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export const useNotificationPermission = () => {
  const [permission, setPermission] = useState<NotificationPermissionState>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [initializationComplete, setInitializationComplete] = useState(false);

  // Check permissions on mount with enhanced debugging
  useEffect(() => {
    const checkPermission = async () => {
      console.log('[Notifications] Checking notification permission status');
      
      // Check if running natively first
      if (nativeIntegrationService.isRunningNatively()) {
        console.log('[Notifications] Running in native environment, checking native permissions');
        try {
          // Enhanced logging for plugin availability
          const isPluginAvailable = nativeIntegrationService.isPluginAvailable('LocalNotifications');
          console.log('[Notifications] LocalNotifications plugin availability:', isPluginAvailable);
          
          // Use Capacitor's LocalNotifications plugin for local/scheduled notifications
          const localNotifications = nativeIntegrationService.getPlugin('LocalNotifications');
          if (localNotifications) {
            console.log('[Notifications] Got LocalNotifications plugin, checking permissions');
            const result = await localNotifications.checkPermissions();
            console.log('[Notifications] Native permission check result:', result);
            
            setIsSupported(true);
            setPermission(result.display === 'granted' ? 'granted' : result.display);
            console.log('[Notifications] Set permission status to:', result.display);
          } else {
            console.warn('[Notifications] LocalNotifications plugin not found despite native environment');
          }
        } catch (error) {
          console.error('[Notifications] Error checking native notification permission:', error);
        }
      } else {
        console.log('[Notifications] Running in web environment, using Web Notifications API');
      }

      // Fallback to web API
      if (!nativeIntegrationService.isRunningNatively() && 'Notification' in window) {
        console.log('[Notifications] Using Web Notifications API, permission:', Notification.permission);
        setIsSupported(true);
        setPermission(Notification.permission);
      } else if (!nativeIntegrationService.isRunningNatively()) {
        console.log('[Notifications] Notifications not supported in this browser');
        setIsSupported(false);
        setPermission('unsupported');
      }
      
      setInitializationComplete(true);
      console.log('[Notifications] Permission check complete');
    };

    checkPermission();
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    console.log('[Notifications] Permission request initiated', {
      isSupported,
      currentPermission: permission,
      isNative: nativeIntegrationService.isRunningNatively()
    });
    
    if (!isSupported) {
      console.log('[Notifications] Notifications not supported on this device');
      return false;
    }

    if (permission === 'granted') {
      console.log('[Notifications] Permission already granted');
      return true;
    }

    try {
      // Try native first if available
      if (nativeIntegrationService.isRunningNatively()) {
        console.log('[Notifications] Requesting native notification permission');
        
        // Use the requestPermissions method directly from nativeIntegrationService
        // This helps bypass potential plugin initialization issues
        const results = await nativeIntegrationService.requestPermissions(['notifications']);
        console.log('[Notifications] Native permission request results:', results);
        
        if (results.notifications === 'granted') {
          console.log('[Notifications] Native permission granted');
          setPermission('granted');
          return true;
        }
        
        // Fallback to direct plugin access if the service method failed
        const localNotifications = nativeIntegrationService.getPlugin('LocalNotifications');
        if (localNotifications) {
          console.log('[Notifications] Using plugin directly to request permission');
          try {
            const result = await localNotifications.requestPermissions();
            console.log('[Notifications] Direct plugin permission result:', result);
            
            const granted = result.display === 'granted';
            setPermission(granted ? 'granted' : 'denied');
            console.log('[Notifications] Permission ' + (granted ? 'granted' : 'denied'));
            return granted;
          } catch (pluginError) {
            console.error('[Notifications] Error requesting permission via plugin:', pluginError);
            // Continue to web fallback
          }
        } else {
          console.warn('[Notifications] LocalNotifications plugin not available');
        }
      }

      // Fallback to web API
      if ('Notification' in window) {
        console.log('[Notifications] Requesting web notification permission');
        const result = await Notification.requestPermission();
        console.log('[Notifications] Web permission result:', result);
        setPermission(result);
        return result === 'granted';
      }
      
      console.warn('[Notifications] No permission request method available');
      return false;
    } catch (error) {
      console.error('[Notifications] Error requesting notification permission:', error);
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
