import { useState, useEffect, useCallback } from 'react';
import { enhancedNotificationService, NotificationPermissionState } from '@/services/enhancedNotificationService';
import { toast } from 'sonner';

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
  const [isRequesting, setIsRequesting] = useState(false);

  // Load settings without requesting permissions
  const loadSettings = useCallback(async () => {
    try {
      console.log('[useNotificationSettings] Loading notification settings (checking permissions only)');
      
      // Check permission status without requesting
      const permissionState = await enhancedNotificationService.checkPermissionStatus();
      
      // Load saved settings
      const savedEnabled = localStorage.getItem('notification_enabled') === 'true';
      const savedTimes = localStorage.getItem('notification_times');
      
      let times: string[] = [];
      if (savedTimes) {
        try {
          times = JSON.parse(savedTimes);
        } catch (e) {
          console.error('Error parsing saved notification times:', e);
        }
      }
      
      // Only consider enabled if permission is actually granted
      const actuallyEnabled = savedEnabled && permissionState === 'granted';
      
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

  // Request permissions when user explicitly enables notifications
  const requestPermissionAndEnable = useCallback(async (): Promise<boolean> => {
    if (isRequesting) {
      console.log('[useNotificationSettings] Permission request already in progress');
      return false;
    }
    
    setIsRequesting(true);
    
    try {
      console.log('[useNotificationSettings] User explicitly requested notification permissions');
      
      const result = await enhancedNotificationService.requestPermissions();
      console.log('[useNotificationSettings] Permission request result:', result);
      
      if (result.granted) {
        // Update settings to enabled
        const newSettings = {
          ...settings,
          enabled: true,
          permissionState: result.state
        };
        
        setSettings(newSettings);
        localStorage.setItem('notification_enabled', 'true');
        
        toast.success('Notification permissions granted!');
        return true;
      } else {
        // Update permission state but keep disabled
        setSettings(prev => ({
          ...prev,
          permissionState: result.state
        }));
        
        toast.error(result.error || 'Notification permission denied');
        return false;
      }
    } catch (error) {
      console.error('[useNotificationSettings] Error requesting permissions:', error);
      toast.error('Failed to request notification permissions');
      return false;
    } finally {
      setIsRequesting(false);
    }
  }, [settings, isRequesting]);

  // Toggle notifications (request permission if needed)
  const toggleNotifications = useCallback(async (enable: boolean): Promise<boolean> => {
    console.log('[useNotificationSettings] Toggle notifications:', enable);
    
    if (enable) {
      // Check if we already have permission
      if (settings.permissionState === 'granted') {
        setSettings(prev => ({ ...prev, enabled: true }));
        localStorage.setItem('notification_enabled', 'true');
        return true;
      } else {
        // Request permission
        return await requestPermissionAndEnable();
      }
    } else {
      // Disable notifications
      setSettings(prev => ({ ...prev, enabled: false }));
      localStorage.setItem('notification_enabled', 'false');
      return true;
    }
  }, [settings.permissionState, requestPermissionAndEnable]);

  // Update notification times
  const updateTimes = useCallback((times: string[]) => {
    console.log('[useNotificationSettings] Updating notification times:', times);
    setSettings(prev => ({ ...prev, times }));
    localStorage.setItem('notification_times', JSON.stringify(times));
  }, []);

  // Initialize settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    settings,
    isLoading,
    isRequesting,
    toggleNotifications,
    updateTimes,
    refreshPermissionStatus: loadSettings
  };
};
