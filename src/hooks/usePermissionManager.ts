
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
  hasEssentialPermissions: boolean;
}

export const usePermissionManager = (): PermissionManagerResult => {
  const [permissions, setPermissions] = useState<PermissionState>({
    microphone: 'prompt',
    notifications: 'prompt'
  });
  const [isLoading, setIsLoading] = useState(false);
  
  const currentPath = window.location.pathname;
  const isTWAEnvironment = shouldApplyTWALogic(currentPath);

  // Calculate if essential permissions are granted
  const hasEssentialPermissions = permissions.microphone === 'granted' && 
                                  permissions.notifications === 'granted';

  // Check all permissions on mount and set up monitoring
  useEffect(() => {
    checkAllPermissions();
    
    // Set up permission monitoring for TWA
    if (isTWAEnvironment) {
      console.log('[PermissionManager] Setting up permission monitoring for TWA');
      
      permissionService.monitorPermissionChanges((type, status) => {
        console.log(`[PermissionManager] Permission changed: ${type} -> ${status}`);
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
      
      // Show appropriate feedback
      if (granted) {
        const message = type === 'microphone' 
          ? 'Microphone access granted! You can now record voice entries.' 
          : 'Notifications enabled! You\'ll get helpful reminders.';
        
        toast.success(message, { duration: 2000 });
      } else {
        const message = type === 'microphone' 
          ? 'Microphone access is required for voice journaling. You can enable it in device settings.' 
          : 'Notifications help you stay consistent with journaling. You can enable them in device settings.';
        
        if (isTWAEnvironment) {
          toast.error(message, { duration: 4000 });
        } else {
          toast.warning(message, { duration: 4000 });
        }
      }
      
      return granted;
    } catch (error) {
      console.error(`[PermissionManager] Error requesting ${type} permission:`, error);
      toast.error(`Failed to request ${type} permission. Please try again or enable it in device settings.`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isTWAEnvironment]);

  const shouldShowPermissionPrompt = useCallback((type: PermissionType): boolean => {
    // In TWA environment, be more proactive about showing prompts
    if (isTWAEnvironment) {
      // Show prompt for 'prompt' state, and also for 'denied' state to guide users to settings
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
    isTWAEnvironment,
    hasEssentialPermissions
  };
};
