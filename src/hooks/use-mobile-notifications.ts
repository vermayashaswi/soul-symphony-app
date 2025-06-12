
/**
 * Mobile Notifications Hook
 * Custom hook for managing notifications with mobile-first approach
 */

import { useState, useEffect } from 'react';
import { useNotificationBridge } from '@/components/notifications/NotificationBridge';
import { setupJournalReminder, NotificationTime } from '@/services/notificationService';
import { toast } from 'sonner';

interface MobileNotificationSettings {
  enabled: boolean;
  times: NotificationTime[];
  vibrationEnabled: boolean;
  soundEnabled: boolean;
}

interface UseMobileNotificationsReturn {
  settings: MobileNotificationSettings;
  isLoading: boolean;
  hasPermission: boolean;
  canRequestPermission: boolean;
  requestPermission: () => Promise<boolean>;
  updateSettings: (newSettings: Partial<MobileNotificationSettings>) => Promise<void>;
  testNotification: () => Promise<void>;
  enableNotifications: (times: NotificationTime[]) => Promise<boolean>;
  disableNotifications: () => Promise<void>;
}

export const useMobileNotifications = (): UseMobileNotificationsReturn => {
  const { 
    permissionStatus, 
    isLoading: bridgeLoading, 
    requestPermission: bridgeRequestPermission,
    checkPermission,
    showNotification,
    vibrate,
    hapticFeedback
  } = useNotificationBridge();

  const [settings, setSettings] = useState<MobileNotificationSettings>({
    enabled: false,
    times: ['evening'],
    vibrationEnabled: true,
    soundEnabled: true
  });

  const [isLoading, setIsLoading] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const loadSettings = () => {
      try {
        const enabled = localStorage.getItem('notification_enabled') === 'true';
        const timesStr = localStorage.getItem('notification_times');
        const vibrationEnabled = localStorage.getItem('notification_vibration') !== 'false';
        const soundEnabled = localStorage.getItem('notification_sound') !== 'false';

        let times: NotificationTime[] = ['evening'];
        if (timesStr) {
          try {
            const parsed = JSON.parse(timesStr);
            if (Array.isArray(parsed) && parsed.length > 0) {
              times = parsed;
            }
          } catch (e) {
            console.error('Error parsing notification times:', e);
          }
        }

        setSettings({
          enabled,
          times,
          vibrationEnabled,
          soundEnabled
        });
      } catch (error) {
        console.error('Error loading notification settings:', error);
      }
    };

    loadSettings();
  }, []);

  // Check permission status periodically
  useEffect(() => {
    if (!bridgeLoading) {
      const interval = setInterval(() => {
        checkPermission();
      }, 5000); // Check every 5 seconds

      return () => clearInterval(interval);
    }
  }, [bridgeLoading, checkPermission]);

  const hasPermission = permissionStatus?.status === 'granted';
  const canRequestPermission = permissionStatus?.canRequest ?? true;

  const requestPermission = async (): Promise<boolean> => {
    if (isLoading) return false;

    setIsLoading(true);
    try {
      // Add haptic feedback for permission request
      await hapticFeedback('light');

      const result = await bridgeRequestPermission();
      
      if (result.status === 'granted') {
        await hapticFeedback('medium');
        toast.success(result.message || 'Notifications enabled!');
        return true;
      } else {
        await vibrate(200);
        toast.error(result.message || 'Permission denied');
        return false;
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
      toast.error('Failed to request permission');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = (newSettings: MobileNotificationSettings) => {
    try {
      localStorage.setItem('notification_enabled', newSettings.enabled.toString());
      localStorage.setItem('notification_times', JSON.stringify(newSettings.times));
      localStorage.setItem('notification_vibration', newSettings.vibrationEnabled.toString());
      localStorage.setItem('notification_sound', newSettings.soundEnabled.toString());
      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving notification settings:', error);
    }
  };

  const updateSettings = async (partialSettings: Partial<MobileNotificationSettings>): Promise<void> => {
    const newSettings = { ...settings, ...partialSettings };
    saveSettings(newSettings);

    // If enabling notifications, set up reminders
    if (newSettings.enabled && newSettings.times.length > 0) {
      setupJournalReminder(true, 'once', newSettings.times);
    } else if (!newSettings.enabled) {
      setupJournalReminder(false, 'once', []);
    }

    // Provide haptic feedback for settings changes
    await hapticFeedback('light');
  };

  const enableNotifications = async (times: NotificationTime[]): Promise<boolean> => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) return false;
    }

    await updateSettings({ enabled: true, times });
    await hapticFeedback('medium');
    toast.success(`Notifications enabled for ${times.length} time${times.length > 1 ? 's' : ''}`);
    return true;
  };

  const disableNotifications = async (): Promise<void> => {
    await updateSettings({ enabled: false });
    await hapticFeedback('light');
    toast.info('Notifications disabled');
  };

  const testNotification = async (): Promise<void> => {
    if (!hasPermission) {
      toast.error('Permission required to test notifications');
      return;
    }

    try {
      // Haptic feedback before showing test notification
      await hapticFeedback('medium');

      const success = await showNotification(
        'Test Notification 🧪',
        'This is a test notification to verify your settings are working correctly.',
        {
          tag: 'test-notification',
          onClick: () => {
            toast.success('Test notification clicked!');
          }
        }
      );

      if (success) {
        toast.success('Test notification sent!');
      } else {
        toast.error('Failed to send test notification');
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast.error('Failed to send test notification');
    }
  };

  return {
    settings,
    isLoading: bridgeLoading || isLoading,
    hasPermission,
    canRequestPermission,
    requestPermission,
    updateSettings,
    testNotification,
    enableNotifications,
    disableNotifications
  };
};
