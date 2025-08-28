import { useState, useEffect, useCallback } from 'react';
import { fcmNotificationService, NotificationPermissionState } from '@/services/fcmNotificationService';

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
      
      // Check permission status using async method
      const permissionState = await fcmNotificationService.checkPermissionStatus();
      
      // Get journal reminder settings (default to empty for now)
      const reminderSettings = { enabled: false, times: [] };
      
      // Only consider enabled if permission is granted
      const actuallyEnabled = reminderSettings.enabled && permissionState === 'granted';
      
      setSettings({
        enabled: actuallyEnabled,
        times: reminderSettings.times,
        permissionState
      });
      
      console.log('[useNotificationSettings] Settings loaded:', {
        enabled: actuallyEnabled,
        timesCount: reminderSettings.times.length,
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
