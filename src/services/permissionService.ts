
import { detectTWAEnvironment, shouldApplyTWALogic } from '@/utils/twaDetection';

export type PermissionType = 'microphone' | 'notifications';
export type PermissionStatus = 'granted' | 'denied' | 'prompt';

export interface PermissionResult {
  granted: boolean;
  status: PermissionStatus;
}

class PermissionService {
  private readonly PERMISSION_STORAGE_KEY = 'soulo_permissions';
  private permissionCache: Map<PermissionType, PermissionStatus> = new Map();

  /**
   * Check the current status of a permission
   */
  async checkPermission(type: PermissionType): Promise<PermissionStatus> {
    try {
      switch (type) {
        case 'microphone':
          return await this.checkMicrophonePermission();
        case 'notifications':
          return await this.checkNotificationPermission();
        default:
          return 'prompt';
      }
    } catch (error) {
      console.error(`[PermissionService] Error checking ${type} permission:`, error);
      return 'prompt';
    }
  }

  /**
   * Request a specific permission with TWA-optimized handling
   */
  async requestPermission(type: PermissionType): Promise<boolean> {
    try {
      console.log(`[PermissionService] Requesting ${type} permission`);
      
      const currentPath = window.location.pathname;
      const isTWAEnvironment = shouldApplyTWALogic(currentPath);
      
      if (isTWAEnvironment) {
        console.log(`[PermissionService] Using TWA-optimized ${type} permission request`);
      }
      
      switch (type) {
        case 'microphone':
          return await this.requestMicrophonePermission();
        case 'notifications':
          return await this.requestNotificationPermission(isTWAEnvironment);
        default:
          return false;
      }
    } catch (error) {
      console.error(`[PermissionService] Error requesting ${type} permission:`, error);
      return false;
    }
  }

  /**
   * Check microphone permission status
   */
  private async checkMicrophonePermission(): Promise<PermissionStatus> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('[PermissionService] MediaDevices API not supported');
      return 'denied';
    }

    try {
      // Try to query the permission state
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        const status = permission.state as PermissionStatus;
        console.log('[PermissionService] Microphone permission status:', status);
        return status;
      }

      // Fallback: Check if we have a cached permission
      const cached = this.permissionCache.get('microphone');
      if (cached) {
        return cached;
      }

      return 'prompt';
    } catch (error) {
      console.error('[PermissionService] Error checking microphone permission:', error);
      return 'prompt';
    }
  }

  /**
   * Request microphone permission with enhanced error handling for TWA
   */
  private async requestMicrophonePermission(): Promise<boolean> {
    try {
      console.log('[PermissionService] Requesting microphone access via getUserMedia');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      // Permission granted, clean up the stream
      stream.getTracks().forEach(track => track.stop());
      
      this.permissionCache.set('microphone', 'granted');
      this.savePermissionToStorage('microphone', 'granted');
      
      console.log('[PermissionService] Microphone permission granted');
      return true;
    } catch (error) {
      console.error('[PermissionService] Microphone permission denied:', error);
      
      this.permissionCache.set('microphone', 'denied');
      this.savePermissionToStorage('microphone', 'denied');
      
      return false;
    }
  }

  /**
   * Check notification permission status
   */
  private async checkNotificationPermission(): Promise<PermissionStatus> {
    if (!('Notification' in window)) {
      console.warn('[PermissionService] Notifications not supported');
      return 'denied';
    }

    const permission = Notification.permission;
    console.log('[PermissionService] Notification permission status:', permission);
    
    return permission as PermissionStatus;
  }

  /**
   * Request notification permission with TWA optimization
   */
  private async requestNotificationPermission(isTWAEnvironment: boolean = false): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('[PermissionService] Notifications not supported');
      return false;
    }

    try {
      let permission: NotificationPermission;
      
      if (isTWAEnvironment) {
        console.log('[PermissionService] Using TWA-optimized notification request');
        
        // For TWA, be more aggressive about requesting permission
        if (Notification.permission === 'default') {
          // Use the newer async API if available
          if ('requestPermission' in Notification && typeof Notification.requestPermission === 'function') {
            permission = await Notification.requestPermission();
          } else {
            // Fallback - though this is rare in modern browsers
            permission = Notification.permission;
          }
        } else {
          permission = Notification.permission;
        }
      } else {
        // Standard web request
        if ('requestPermission' in Notification && typeof Notification.requestPermission === 'function') {
          permission = await Notification.requestPermission();
        } else {
          permission = Notification.permission;
        }
      }
      
      const granted = permission === 'granted';
      
      console.log('[PermissionService] Notification permission result:', permission);
      
      if (granted) {
        this.savePermissionToStorage('notifications', 'granted');
      } else {
        this.savePermissionToStorage('notifications', 'denied');
      }
      
      return granted;
    } catch (error) {
      console.error('[PermissionService] Error requesting notification permission:', error);
      return false;
    }
  }

  /**
   * Save permission status to local storage for persistence
   */
  private savePermissionToStorage(type: PermissionType, status: PermissionStatus): void {
    try {
      const stored = localStorage.getItem(this.PERMISSION_STORAGE_KEY);
      const permissions = stored ? JSON.parse(stored) : {};
      
      permissions[type] = {
        status,
        timestamp: Date.now()
      };
      
      localStorage.setItem(this.PERMISSION_STORAGE_KEY, JSON.stringify(permissions));
    } catch (error) {
      console.error('[PermissionService] Error saving permission to storage:', error);
    }
  }

  /**
   * Get permission status from local storage
   */
  private getPermissionFromStorage(type: PermissionType): PermissionStatus | null {
    try {
      const stored = localStorage.getItem(this.PERMISSION_STORAGE_KEY);
      if (!stored) return null;
      
      const permissions = JSON.parse(stored);
      const permission = permissions[type];
      
      if (!permission) return null;
      
      // Check if the stored permission is recent (within 24 hours)
      const isRecent = Date.now() - permission.timestamp < 24 * 60 * 60 * 1000;
      
      return isRecent ? permission.status : null;
    } catch (error) {
      console.error('[PermissionService] Error reading permission from storage:', error);
      return null;
    }
  }

  /**
   * Clear all stored permissions
   */
  clearStoredPermissions(): void {
    try {
      localStorage.removeItem(this.PERMISSION_STORAGE_KEY);
      this.permissionCache.clear();
      console.log('[PermissionService] Cleared all stored permissions');
    } catch (error) {
      console.error('[PermissionService] Error clearing stored permissions:', error);
    }
  }

  /**
   * Get TWA-specific permission recommendations
   */
  getTWAPermissionRecommendations(): { type: PermissionType; priority: number; reason: string }[] {
    const currentPath = window.location.pathname;
    const isTWAEnvironment = shouldApplyTWALogic(currentPath);
    
    if (!isTWAEnvironment) {
      return [];
    }

    return [
      {
        type: 'microphone',
        priority: 1,
        reason: 'Required for voice journaling - the core feature of Soulo'
      },
      {
        type: 'notifications',
        priority: 2,
        reason: 'Get reminders for daily journaling and insights updates'
      }
    ];
  }

  /**
   * Monitor permission changes for TWA
   */
  async monitorPermissionChanges(callback: (type: PermissionType, status: PermissionStatus) => void): Promise<void> {
    const currentPath = window.location.pathname;
    if (!shouldApplyTWALogic(currentPath)) {
      return;
    }

    try {
      if ('permissions' in navigator) {
        // Monitor microphone permission
        const micPermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        micPermission.addEventListener('change', () => {
          console.log('[PermissionService] Microphone permission changed:', micPermission.state);
          callback('microphone', micPermission.state as PermissionStatus);
        });

        // Monitor notifications permission (if supported)
        try {
          const notificationPermission = await navigator.permissions.query({ name: 'notifications' as PermissionName });
          notificationPermission.addEventListener('change', () => {
            console.log('[PermissionService] Notification permission changed:', notificationPermission.state);
            callback('notifications', notificationPermission.state as PermissionStatus);
          });
        } catch (error) {
          // Notifications permission query might not be supported
          console.log('[PermissionService] Notification permission monitoring not supported');
        }
      }
    } catch (error) {
      console.error('[PermissionService] Error setting up permission monitoring:', error);
    }
  }
}

export const permissionService = new PermissionService();
