
import { useState, useEffect, useCallback } from 'react';
import { useMobileNotifications } from './use-mobile-notifications';
import { useNotificationPermission } from './use-notification-permission';
import { useIsMobile } from './use-mobile';
import { getNotificationSettings, setupJournalReminder, type NotificationTime } from '@/services/notificationService';
import { toast } from 'sonner';

interface SettingsNotificationState {
  enabled: boolean;
  times: NotificationTime[];
  isLoading: boolean;
  permissionGranted: boolean;
  permissionDenied: boolean;
  canRequest: boolean;
}

export const useSettingsNotifications = () => {
  const isMobile = useIsMobile();
  
  // Use appropriate permission hook based on device
  const mobileNotifications = useMobileNotifications();
  const webNotifications = useNotificationPermission();
  
  // Select the appropriate notification system
  const notifications = isMobile ? mobileNotifications : webNotifications;
  
  const [state, setState] = useState<SettingsNotificationState>({
    enabled: false,
    times: [],
    isLoading: false,
    permissionGranted: notifications.isGranted || false,
    permissionDenied: notifications.isDenied || false,
    canRequest: notifications.isDefault || false
  });

  // Load initial settings
  useEffect(() => {
    const settings = getNotificationSettings();
    setState(prev => ({
      ...prev,
      enabled: settings.enabled,
      times: settings.times,
      permissionGranted: notifications.isGranted || false,
      permissionDenied: notifications.isDenied || false,
      canRequest: notifications.isDefault || false
    }));
  }, [notifications.isGranted, notifications.isDenied, notifications.isDefault]);

  const requestPermissionAndEnable = useCallback(async (times: NotificationTime[]): Promise<boolean> => {
    console.log('[useSettingsNotifications] Requesting permission and enabling notifications');
    
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const granted = await notifications.requestPermission();
      
      if (granted) {
        // Permission granted, enable notifications
        setupJournalReminder(true, 'once', times);
        
        setState(prev => ({
          ...prev,
          enabled: true,
          times,
          permissionGranted: true,
          permissionDenied: false,
          canRequest: false,
          isLoading: false
        }));
        
        toast.success('Notifications enabled successfully!');
        return true;
      } else {
        // Permission denied
        setState(prev => ({
          ...prev,
          enabled: false,
          permissionGranted: false,
          permissionDenied: true,
          canRequest: false,
          isLoading: false
        }));
        
        toast.error('Notification permission was denied. Please enable it in your device settings.');
        return false;
      }
    } catch (error) {
      console.error('[useSettingsNotifications] Error requesting permission:', error);
      
      setState(prev => ({
        ...prev,
        enabled: false,
        isLoading: false
      }));
      
      toast.error('Failed to request notification permission. Please try again.');
      return false;
    }
  }, [notifications]);

  const disableNotifications = useCallback(() => {
    console.log('[useSettingsNotifications] Disabling notifications');
    
    setupJournalReminder(false, 'once', []);
    
    setState(prev => ({
      ...prev,
      enabled: false,
      times: []
    }));
    
    toast.success('Notifications disabled');
  }, []);

  const updateSettings = useCallback((enabled: boolean, times: NotificationTime[]) => {
    console.log('[useSettingsNotifications] Updating settings:', { enabled, times });
    
    setupJournalReminder(enabled, 'once', times);
    
    setState(prev => ({
      ...prev,
      enabled,
      times
    }));
  }, []);

  const resetToggleState = useCallback(() => {
    console.log('[useSettingsNotifications] Resetting toggle state');
    
    setState(prev => ({
      ...prev,
      enabled: false,
      times: []
    }));
  }, []);

  return {
    ...state,
    isMobile,
    isWebToNative: isMobile ? mobileNotifications.isWebToNative : false,
    requestPermissionAndEnable,
    disableNotifications,
    updateSettings,
    resetToggleState,
    showTestNotification: notifications.showNotification || (() => {}),
    vibrate: isMobile ? mobileNotifications.vibrate : undefined
  };
};
