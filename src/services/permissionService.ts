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
   * Check the current status of a permission with TWA delegation support
   */
  async checkPermission(type: PermissionType): Promise<PermissionStatus> {
    try {
      const twaEnv = detectTWAEnvironment();
      
      // If we have permission delegation, check with the native layer first
      if (twaEnv.hasPermissionDelegation) {
        const delegatedStatus = await this.checkDelegatedPermission(type);
        if (delegatedStatus) {
          console.log(`[PermissionService] Using delegated ${type} permission:`, delegatedStatus);
          return delegatedStatus;
        }
      }

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
   * Check permission status through TWA delegation
   */
  private async checkDelegatedPermission(type: PermissionType): Promise<PermissionStatus | null> {
    try {
      // Check if we have Capacitor available for permission checking
      if (typeof (window as any).Capacitor !== 'undefined') {
        const { Capacitor } = window as any;
        
        if (Capacitor.isNativePlatform()) {
          // Use Capacitor's permission checking
          const permissionName = type === 'microphone' ? 'microphone' : 'notifications';
          
          if (Capacitor.Plugins && Capacitor.Plugins.Permissions) {
            const result = await Capacitor.Plugins.Permissions.query({ name: permissionName });
            console.log(`[PermissionService] Capacitor ${type} permission:`, result);
            return result.state as PermissionStatus;
          }
        }
      }

      // Fallback to Android TWA permission delegation check
      if ('permissions' in navigator && typeof (navigator as any).permissions.request === 'function') {
        const permissionName = type === 'microphone' ? 'microphone' : 'notifications';
        const permission = await navigator.permissions.query({ name: permissionName as PermissionName });
        return permission.state as PermissionStatus;
      }

      return null;
    } catch (error) {
      console.warn(`[PermissionService] Delegated permission check failed for ${type}:`, error);
      return null;
    }
  }

  /**
   * Request a specific permission with TWA-optimized handling and delegation
   */
  async requestPermission(type: PermissionType): Promise<boolean> {
    try {
      console.log(`[PermissionService] Requesting ${type} permission`);
      
      const currentPath = window.location.pathname;
      const isTWAEnvironment = shouldApplyTWALogic(currentPath);
      const twaEnv = detectTWAEnvironment();
      
      if (isTWAEnvironment) {
        console.log(`[PermissionService] Using TWA-optimized ${type} permission request`);
        
        // Try delegation first if available
        if (twaEnv.hasPermissionDelegation) {
          const delegatedResult = await this.requestDelegatedPermission(type);
          if (delegatedResult !== null) {
            console.log(`[PermissionService] Delegated ${type} permission result:`, delegatedResult);
            return delegatedResult;
          }
        }
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
   * Request permission through TWA delegation
   */
  private async requestDelegatedPermission(type: PermissionType): Promise<boolean | null> {
    try {
      // Check if we have Capacitor available for permission requests
      if (typeof (window as any).Capacitor !== 'undefined') {
        const { Capacitor } = window as any;
        
        if (Capacitor.isNativePlatform()) {
          const permissionName = type === 'microphone' ? 'microphone' : 'notifications';
          
          if (Capacitor.Plugins && Capacitor.Plugins.Permissions) {
            const result = await Capacitor.Plugins.Permissions.request({ permissions: [permissionName] });
            console.log(`[PermissionService] Capacitor ${type} permission request result:`, result);
            
            const status = result[permissionName];
            const granted = status === 'granted';
            
            if (granted) {
              this.savePermissionToStorage(type, 'granted');
            } else {
              this.savePermissionToStorage(type, 'denied');
            }
            
            return granted;
          }
        }
      }

      return null;
    } catch (error) {
      console.warn(`[PermissionService] Delegated permission request failed for ${type}:`, error);
      return null;
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
   * Enhanced TWA permission monitoring with delegation support
   */
  async monitorPermissionChanges(callback: (type: PermissionType, status: PermissionStatus) => void): Promise<void> {
    const currentPath = window.location.pathname;
    if (!shouldApplyTWALogic(currentPath)) {
      return;
    }

    try {
      const twaEnv = detectTWAEnvironment();
      
      // Set up Capacitor permission monitoring if available
      if (twaEnv.hasPermissionDelegation && typeof (window as any).Capacitor !== 'undefined') {
        const { Capacitor } = window as any;
        
        if (Capacitor.isNativePlatform() && Capacitor.Plugins && Capacitor.Plugins.Permissions) {
          // Note: Capacitor doesn't have built-in permission change monitoring
          // We'll use periodic checking as a fallback
          setInterval(async () => {
            const micStatus = await this.checkPermission('microphone');
            const notifStatus = await this.checkPermission('notifications');
            
            const cachedMic = this.permissionCache.get('microphone');
            const cachedNotif = this.permissionCache.get('notifications');
            
            if (cachedMic !== micStatus) {
              this.permissionCache.set('microphone', micStatus);
              callback('microphone', micStatus);
            }
            
            if (cachedNotif !== notifStatus) {
              this.permissionCache.set('notifications', notifStatus);
              callback('notifications', notifStatus);
            }
          }, 5000); // Check every 5 seconds
          
          return;
        }
      }

      // Fallback to standard permission monitoring
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
