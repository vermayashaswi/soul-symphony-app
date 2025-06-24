
import { useState, useEffect, useCallback } from 'react';
import { detectTWAEnvironment, shouldApplyTWALogic } from '@/utils/twaDetection';
import { permissionService, PermissionType, PermissionStatus } from '@/services/permissionService';
import { toast } from 'sonner';

export interface PermissionState {
  microphone: PermissionStatus;
  notifications: PermissionStatus;
}

export interface PermissionManagerResult {
  permissions: PermissionState;
  isLoading: boolean;
  requestPermission: (type: PermissionType) => Promise<boolean>;
  checkAllPermissions: () => Promise<void>;
  shouldShowPermissionPrompt: (type: PermissionType) => boolean;
  isTWAEnvironment: boolean;
}

export const usePermissionManager = (): PermissionManagerResult => {
  const [permissions, setPermissions] = useState<PermissionState>({
    microphone: 'prompt',
    notifications: 'prompt'
  });
  const [isLoading, setIsLoading] = useState(false);
  
  const currentPath = window.location.pathname;
  const isTWAEnvironment = shouldApplyTWALogic(currentPath);

  // Check all permissions on mount and set up monitoring
  useEffect(() => {
    checkAllPermissions();
    
    // Set up permission monitoring for TWA
    if (isTWAEnvironment) {
      permissionService.monitorPermissionChanges((type, status) => {
        setPermissions(prev => ({
          ...prev,
          [type]: status
        }));
      });
    }
  }, [isTWAEnvironment]);

  const checkAllPermissions = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const microphoneStatus = await permissionService.checkPermission('microphone');
      const notificationsStatus = await permissionService.checkPermission('notifications');
      
      setPermissions({
        microphone: microphoneStatus,
        notifications: notificationsStatus
      });
      
      console.log('[PermissionManager] Permissions checked:', {
        microphone: microphoneStatus,
        notifications: notificationsStatus,
        isTWA: isTWAEnvironment
      });
    } catch (error) {
      console.error('[PermissionManager] Error checking permissions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isTWAEnvironment]);

  const requestPermission = useCallback(async (type: PermissionType): Promise<boolean> => {
    try {
      setIsLoading(true);
      console.log(`[PermissionManager] Requesting ${type} permission`);
      
      const granted = await permissionService.requestPermission(type);
      
      // Update the specific permission status
      setPermissions(prev => ({
        ...prev,
        [type]: granted ? 'granted' : 'denied'
      }));
      
      if (granted) {
        const message = type === 'microphone' 
          ? 'Microphone access granted!' 
          : 'Notifications enabled!';
        
        if (isTWAEnvironment) {
          toast.success(message, { duration: 2000 });
        } else {
          toast.success(message, { duration: 2000 });
        }
      } else {
        const message = type === 'microphone' 
          ? 'Microphone access denied. You can enable it in your device settings.' 
          : 'Notification permission denied. You can enable it in your device settings.';
        
        if (isTWAEnvironment) {
          toast.error(message, { duration: 4000 });
        } else {
          toast.error(message, { duration: 4000 });
        }
      }
      
      return granted;
    } catch (error) {
      console.error(`[PermissionManager] Error requesting ${type} permission:`, error);
      toast.error(`Failed to request ${type} permission. Please try again.`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isTWAEnvironment]);

  const shouldShowPermissionPrompt = useCallback((type: PermissionType): boolean => {
    // In TWA environment, be more aggressive about showing prompts
    if (isTWAEnvironment) {
      return permissions[type] === 'prompt' || permissions[type] === 'denied';
    }
    
    // In regular web environment, only show for 'prompt' status
    return permissions[type] === 'prompt';
  }, [permissions, isTWAEnvironment]);

  return {
    permissions,
    isLoading,
    requestPermission,
    checkAllPermissions,
    shouldShowPermissionPrompt,
    isTWAEnvironment
  };
};
