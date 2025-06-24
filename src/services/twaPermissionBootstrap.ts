
import { permissionService, PermissionType } from '@/services/permissionService';
import { detectTWAEnvironment, shouldApplyTWALogic } from '@/utils/twaDetection';
import { toast } from 'sonner';

interface PermissionBootstrapResult {
  microphone: boolean;
  notifications: boolean;
  allGranted: boolean;
  bootstrapAttempted: boolean;
}

class TWAPermissionBootstrap {
  private isBootstrapping = false;
  private bootstrapPromise: Promise<PermissionBootstrapResult> | null = null;

  async requestEssentialPermissions(): Promise<PermissionBootstrapResult> {
    // Prevent multiple concurrent bootstrap attempts
    if (this.isBootstrapping && this.bootstrapPromise) {
      console.log('[TWAPermissionBootstrap] Bootstrap already in progress, returning existing promise');
      return this.bootstrapPromise;
    }

    const currentPath = window.location.pathname;
    const shouldBootstrap = shouldApplyTWALogic(currentPath);

    if (!shouldBootstrap) {
      console.log('[TWAPermissionBootstrap] Not a TWA environment, skipping bootstrap');
      return { 
        microphone: false, 
        notifications: false, 
        allGranted: false, 
        bootstrapAttempted: false 
      };
    }

    this.isBootstrapping = true;
    console.log('[TWAPermissionBootstrap] Starting permission bootstrap for TWA');

    this.bootstrapPromise = this.performBootstrap();
    const result = await this.bootstrapPromise;
    
    this.isBootstrapping = false;
    this.bootstrapPromise = null;
    
    return result;
  }

  private async performBootstrap(): Promise<PermissionBootstrapResult> {
    const result: PermissionBootstrapResult = {
      microphone: false,
      notifications: false,
      allGranted: false,
      bootstrapAttempted: true
    };

    try {
      // Check current permission states first
      const microphoneStatus = await permissionService.checkPermission('microphone');
      const notificationsStatus = await permissionService.checkPermission('notifications');

      console.log('[TWAPermissionBootstrap] Current permission states:', {
        microphone: microphoneStatus,
        notifications: notificationsStatus
      });

      // Update result for already granted permissions
      if (microphoneStatus === 'granted') {
        result.microphone = true;
      }
      
      if (notificationsStatus === 'granted') {
        result.notifications = true;
      }

      // Only request permissions that are in 'prompt' state
      const permissionsToRequest: PermissionType[] = [];
      
      if (microphoneStatus === 'prompt') {
        permissionsToRequest.push('microphone');
      }

      if (notificationsStatus === 'prompt') {
        permissionsToRequest.push('notifications');
      }

      if (permissionsToRequest.length === 0) {
        console.log('[TWAPermissionBootstrap] No permissions need to be requested');
        result.allGranted = result.microphone && result.notifications;
        return result;
      }

      // Show initial bootstrap message
      toast.info('Setting up app permissions for the best experience...', {
        duration: 2000
      });

      // Request permissions sequentially with proper user interaction
      for (const permissionType of permissionsToRequest) {
        try {
          console.log(`[TWAPermissionBootstrap] Requesting ${permissionType} permission`);
          
          // Add a small delay to ensure user interaction context
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const granted = await permissionService.requestPermission(permissionType);
          result[permissionType] = granted;

          if (granted) {
            console.log(`[TWAPermissionBootstrap] ${permissionType} permission granted`);
            
            // Show specific success message
            const message = permissionType === 'microphone' 
              ? 'Microphone access granted! You can now record voice entries.' 
              : 'Notifications enabled! You\'ll get helpful reminders.';
              
            toast.success(message, { duration: 2000 });
          } else {
            console.log(`[TWAPermissionBootstrap] ${permissionType} permission denied`);
            
            // Show helpful message for denied permissions
            const message = permissionType === 'microphone' 
              ? 'Microphone access is needed for voice journaling. You can enable it in Settings.' 
              : 'Notifications help you stay consistent. You can enable them in Settings.';
              
            toast.warning(message, { duration: 3000 });
          }

          // Small delay between permission requests
          await new Promise(resolve => setTimeout(resolve, 800));
          
        } catch (error) {
          console.error(`[TWAPermissionBootstrap] Error requesting ${permissionType} permission:`, error);
          result[permissionType] = false;
          
          toast.error(`Failed to request ${permissionType} permission. Please try manually in Settings.`, {
            duration: 3000
          });
        }
      }

      result.allGranted = result.microphone && result.notifications;
      
      // Show final status message
      if (result.allGranted) {
        toast.success('All permissions granted! Soulo is ready to use.', {
          duration: 3000
        });
      } else if (result.microphone || result.notifications) {
        toast.info('Some permissions granted. You can enable others in Settings if needed.', {
          duration: 3000
        });
      } else {
        toast.warning('Permissions were not granted. You can enable them manually in Settings for the best experience.', {
          duration: 4000
        });
      }

      console.log('[TWAPermissionBootstrap] Bootstrap completed:', result);
      return result;
      
    } catch (error) {
      console.error('[TWAPermissionBootstrap] Error during permission bootstrap:', error);
      toast.error('Permission setup encountered an issue. You can enable permissions manually in Settings.');
      return result;
    }
  }

  async checkBootstrapNeeded(): Promise<boolean> {
    const currentPath = window.location.pathname;
    const shouldBootstrap = shouldApplyTWALogic(currentPath);

    if (!shouldBootstrap) {
      return false;
    }

    try {
      const microphoneStatus = await permissionService.checkPermission('microphone');
      const notificationsStatus = await permissionService.checkPermission('notifications');

      // Bootstrap is needed if any permission is in prompt state
      const isNeeded = microphoneStatus === 'prompt' || notificationsStatus === 'prompt';
      
      console.log('[TWAPermissionBootstrap] Bootstrap needed check:', {
        microphone: microphoneStatus,
        notifications: notificationsStatus,
        isNeeded
      });
      
      return isNeeded;
    } catch (error) {
      console.error('[TWAPermissionBootstrap] Error checking if bootstrap is needed:', error);
      return false;
    }
  }

  reset(): void {
    this.isBootstrapping = false;
    this.bootstrapPromise = null;
    console.log('[TWAPermissionBootstrap] Bootstrap state reset');
  }
}

export const twaPermissionBootstrap = new TWAPermissionBootstrap();
