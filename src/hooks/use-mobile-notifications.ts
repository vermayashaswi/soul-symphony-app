
import { useState, useEffect, useCallback } from 'react';
import { webToNativeNotificationService } from '@/services/webToNativeNotificationService';

export type MobileNotificationPermission = 'default' | 'granted' | 'denied' | 'unsupported';

interface MobileNotificationState {
  permission: MobileNotificationPermission;
  isSupported: boolean;
  isWebToNative: boolean;
  isGranted: boolean;
  isDenied: boolean;
  isDefault: boolean;
}

export const useMobileNotifications = () => {
  const [state, setState] = useState<MobileNotificationState>({
    permission: 'default',
    isSupported: false,
    isWebToNative: false,
    isGranted: false,
    isDenied: false,
    isDefault: true
  });

  useEffect(() => {
    const updateState = () => {
      const permission = webToNativeNotificationService.getPermissionStatus();
      const isSupported = webToNativeNotificationService.isSupported();
      const isWebToNative = webToNativeNotificationService.isWebToNativeEnvironment();
      
      setState({
        permission: isSupported ? permission : 'unsupported',
        isSupported,
        isWebToNative,
        isGranted: permission === 'granted',
        isDenied: permission === 'denied',
        isDefault: permission === 'default'
      });
    };

    updateState();
    
    // Check for permission changes
    const interval = setInterval(updateState, 1000);
    
    return () => clearInterval(interval);
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      console.log('[useMobileNotifications] Notifications not supported');
      return false;
    }

    if (state.isGranted) {
      return true;
    }

    try {
      const granted = await webToNativeNotificationService.requestPermission();
      
      // Update state immediately
      setState(prev => ({
        ...prev,
        permission: granted ? 'granted' : 'denied',
        isGranted: granted,
        isDenied: !granted,
        isDefault: false
      }));
      
      return granted;
    } catch (error) {
      console.error('[useMobileNotifications] Error requesting permission:', error);
      return false;
    }
  }, [state.isSupported, state.isGranted]);

  const showNotification = useCallback((title: string, body?: string, options?: NotificationOptions) => {
    if (!state.isGranted) {
      console.warn('[useMobileNotifications] Cannot show notification - permission not granted');
      return;
    }

    webToNativeNotificationService.showNotification(title, {
      body,
      icon: '/icons/icon-192x192.png',
      ...options
    });
  }, [state.isGranted]);

  const scheduleNotification = useCallback((title: string, body: string, scheduledTime: Date) => {
    if (!state.isGranted) {
      console.warn('[useMobileNotifications] Cannot schedule notification - permission not granted');
      return;
    }

    webToNativeNotificationService.scheduleNotification(title, body, scheduledTime);
  }, [state.isGranted]);

  const vibrate = useCallback((pattern: number | number[] = 200) => {
    webToNativeNotificationService.vibrate(pattern);
  }, []);

  return {
    ...state,
    requestPermission,
    showNotification,
    scheduleNotification,
    vibrate
  };
};
