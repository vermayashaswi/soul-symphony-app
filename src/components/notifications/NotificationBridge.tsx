
/**
 * Notification Bridge Component
 * Unified interface for notification functionality across web and native
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { nativePermissionService, PermissionResult } from '@/services/nativePermissionService';
import { vibrationService } from '@/services/vibrationService';
import { webToNativeDetection, DeviceInfo } from '@/services/webToNativeDetectionService';

interface NotificationBridgeContextType {
  deviceInfo: DeviceInfo | null;
  permissionStatus: PermissionResult | null;
  isLoading: boolean;
  requestPermission: () => Promise<PermissionResult>;
  checkPermission: () => Promise<PermissionResult>;
  vibrate: (pattern?: number | number[]) => Promise<boolean>;
  hapticFeedback: (style?: 'light' | 'medium' | 'heavy') => Promise<boolean>;
  showNotification: (title: string, body: string, options?: any) => Promise<boolean>;
}

const NotificationBridgeContext = createContext<NotificationBridgeContextType | null>(null);

export const useNotificationBridge = () => {
  const context = useContext(NotificationBridgeContext);
  if (!context) {
    throw new Error('useNotificationBridge must be used within a NotificationBridgeProvider');
  }
  return context;
};

interface NotificationBridgeProviderProps {
  children: React.ReactNode;
}

export const NotificationBridgeProvider: React.FC<NotificationBridgeProviderProps> = ({ children }) => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeBridge = async () => {
      try {
        const info = await webToNativeDetection.getDeviceInfo();
        setDeviceInfo(info);

        const permission = await nativePermissionService.checkNotificationPermission();
        setPermissionStatus(permission);
      } catch (error) {
        console.error('Failed to initialize notification bridge:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeBridge();
  }, []);

  const requestPermission = async (): Promise<PermissionResult> => {
    setIsLoading(true);
    try {
      const result = await nativePermissionService.requestNotificationPermission();
      setPermissionStatus(result);
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const checkPermission = async (): Promise<PermissionResult> => {
    const result = await nativePermissionService.checkNotificationPermission();
    setPermissionStatus(result);
    return result;
  };

  const vibrate = async (pattern?: number | number[]): Promise<boolean> => {
    return vibrationService.vibrate(pattern);
  };

  const hapticFeedback = async (style: 'light' | 'medium' | 'heavy' = 'light'): Promise<boolean> => {
    return vibrationService.hapticImpact(style);
  };

  const showNotification = async (title: string, body: string, options: any = {}): Promise<boolean> => {
    if (!deviceInfo) return false;

    if (deviceInfo.isNative) {
      return showNativeNotification(title, body, options);
    } else {
      return showWebNotification(title, body, options);
    }
  };

  const showNativeNotification = async (title: string, body: string, options: any): Promise<boolean> => {
    try {
      const dynamicImport = new Function('specifier', 'return import(specifier)');
      const { LocalNotifications } = await dynamicImport('@capacitor/local-notifications');

      await LocalNotifications.schedule({
        notifications: [{
          title,
          body,
          id: Date.now(),
          schedule: { at: new Date(Date.now() + 1000) }, // Show after 1 second
          extra: options.data || {},
          ...options
        }]
      });

      return true;
    } catch (error) {
      console.error('Failed to show native notification:', error);
      return false;
    }
  };

  const showWebNotification = async (title: string, body: string, options: any): Promise<boolean> => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return false;
    }

    try {
      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'journal-reminder',
        requireInteraction: false,
        silent: false,
        ...options
      });

      // Auto-close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

      // Handle notification click
      notification.onclick = () => {
        window.focus();
        notification.close();
        if (options.onClick) {
          options.onClick();
        }
      };

      return true;
    } catch (error) {
      console.error('Failed to show web notification:', error);
      return false;
    }
  };

  const value: NotificationBridgeContextType = {
    deviceInfo,
    permissionStatus,
    isLoading,
    requestPermission,
    checkPermission,
    vibrate,
    hapticFeedback,
    showNotification
  };

  return (
    <NotificationBridgeContext.Provider value={value}>
      {children}
    </NotificationBridgeContext.Provider>
  );
};
