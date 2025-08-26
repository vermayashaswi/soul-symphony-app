import { useState, useEffect, useCallback } from 'react';
import { nativeNotificationService, NotificationPermissionState } from '@/services/nativeNotificationService';

interface NotificationSettings {
  enabled: boolean;
  times: string[];
  permissionState: NotificationPermissionState;
}

export const useNotificationSettings = () => {
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: false,
    times: [],
    permissionState: 'default'
  });
  
  const [isLoading, setIsLoading] = useState(true);

  // Load settings
  const loadSettings = useCallback(async () => {
    try {
      console.log('[useNotificationSettings] Loading notification settings');
      
      // Check permission status
      const permissionState = await nativeNotificationService.checkPermissionStatus();
      
      // Get journal reminder settings
      const reminderSettings = await nativeNotificationService.getReminderSettings();
      
      // Only consider enabled if permission is granted
      const hasEnabledReminders = reminderSettings?.reminders?.some(r => r.enabled) || false;
      const actuallyEnabled = hasEnabledReminders && permissionState === 'granted';
      const times = reminderSettings?.reminders?.map(r => r.time) || [];
      
      setSettings({
        enabled: actuallyEnabled,
        times,
        permissionState
      });
      
      console.log('[useNotificationSettings] Settings loaded:', {
        enabled: actuallyEnabled,
        timesCount: times.length,
        permissionState
      });
      
    } catch (error) {
      console.error('[useNotificationSettings] Error loading settings:', error);
      setSettings({
        enabled: false,
        times: [],
        permissionState: 'unsupported'
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    loadSettings();
    
    // Reload settings every 5 seconds to keep in sync
    const interval = setInterval(loadSettings, 5000);
    
    return () => clearInterval(interval);
  }, [loadSettings]);

  return {
    settings,
    isLoading,
    refreshPermissionStatus: loadSettings
  };
};
