// Re-export native notification service for enhanced functionality
export * from './nativeNotificationService';
import { nativeNotificationService, NotificationPermissionState } from './nativeNotificationService';

// Enhanced compatibility exports with extended methods
class EnhancedNotificationServiceCompat {
  async requestPermissions() {
    return nativeNotificationService.requestPermissions();
  }
  
  async getPermissionInfo() {
    return nativeNotificationService.requestPermissions();
  }
  
  async checkPermissionStatus(): Promise<NotificationPermissionState> {
    return nativeNotificationService.checkPermissionStatus();
  }
}

export const enhancedNotificationService = new EnhancedNotificationServiceCompat();
export default enhancedNotificationService;