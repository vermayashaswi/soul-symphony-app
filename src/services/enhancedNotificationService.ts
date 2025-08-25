// Re-export unified notification service for backward compatibility
export * from './unifiedNotificationService';
import { unifiedNotificationService, NotificationPermissionState } from './unifiedNotificationService';

// Enhanced compatibility exports with extended methods
class EnhancedNotificationServiceCompat {
  async requestPermissions() {
    return unifiedNotificationService.requestPermissionsEnhanced();
  }
  
  async getPermissionInfo() {
    return unifiedNotificationService.requestPermissionsEnhanced();
  }
  
  async checkPermissionStatus(): Promise<NotificationPermissionState> {
    return unifiedNotificationService.checkPermissionStatus();
  }
}

export const enhancedNotificationService = new EnhancedNotificationServiceCompat();
export default enhancedNotificationService;