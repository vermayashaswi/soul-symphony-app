
import { permissionService, PermissionType } from '@/services/permissionService';
import { detectTWAEnvironment, shouldApplyTWALogic } from '@/utils/twaDetection';
import { toast } from 'sonner';

interface PermissionBootstrapResult {
  microphone: boolean;
  notifications: boolean;
  allGranted: boolean;
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
      return { microphone: false, notifications: false, allGranted: false };
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
      allGranted: false
    };

    try {
      // Check current permission states first
      const microphoneStatus = await permissionService.checkPermission('microphone');
      const notificationsStatus = await permissionService.checkPermission('notifications');

      console.log('[TWAPermissionBootstrap] Current permission states:', {
        microphone: microphoneStatus,
        notifications: notificationsStatus
      });

      // Only request permissions that are in 'prompt' state
      const permissionsToRequest: PermissionType[] = [];
      
      if (microphoneStatus === 'prompt') {
        permissionsToRequest.push('microphone');
      } else if (microphoneStatus === 'granted') {
        result.microphone = true;
      }

      if (notificationsStatus === 'prompt') {
        permissionsToRequest.push('notifications');
      } else if (notificationsStatus === 'granted') {
        result.notifications = true;
      }

      if (permissionsToRequest.length === 0) {
        console.log('[TWAPermissionBootstrap] No permissions need to be requested');
        result.allGranted = result.microphone && result.notifications;
        return result;
      }

      // Request permissions sequentially with proper user interaction
      for (const permissionType of permissionsToRequest) {
        try {
          console.log(`[TWAPermissionBootstrap] Requesting ${permissionType} permission`);
          
          // Add a small delay to ensure user interaction context
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const granted = await permissionService.requestPermission(permissionType);
          result[permissionType] = granted;

          if (granted) {
            console.log(`[TWAPermissionBootstrap] ${permissionType} permission granted`);
          } else {
            console.log(`[TWAPermissionBootstrap] ${permissionType} permission denied`);
          }

          // Small delay between permission requests
          await new Promise(resolve => setTimeout(resolve, 300));
          
        } catch (error) {
          console.error(`[TWAPermissionBootstrap] Error requesting ${permissionType} permission:`, error);
          result[permissionType] = false;
        }
      }

      result.allGranted = result.microphone && result.notifications;
      
      // Show success message if all permissions were granted
      if (result.allGranted) {
        toast.success('All permissions granted! You can now use all features of Soulo.', {
          duration: 3000
        });
      } else if (result.microphone || result.notifications) {
        toast.success('Some permissions granted. You can enable the rest in Settings if needed.', {
          duration: 3000
        });
      }

      console.log('[TWAPermissionBootstrap] Bootstrap completed:', result);
      return result;
      
    } catch (error) {
      console.error('[TWAPermissionBootstrap] Error during permission bootstrap:', error);
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
      return microphoneStatus === 'prompt' || notificationsStatus === 'prompt';
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
